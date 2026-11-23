begin;

-- Player contacts and import receipts are private, even if public.players is
-- readable through PostgREST. A missing contact row means no email is saved.
create schema pbk_staff;
revoke all on schema pbk_staff from public, anon, authenticated;

create function pbk_staff.email_key(value text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select nullif(lower(regexp_replace(value, '^[[:space:]]+|[[:space:]]+$', '', 'g')), '');
$$;

create function pbk_staff.dupr_key(value text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select nullif(upper(regexp_replace(value, '^[[:space:]]+|[[:space:]]+$', '', 'g')), '');
$$;

-- If legacy DUPR IDs collide after normalization, stop without changing them.
do $$
begin
  if exists (
    select 1
    from public.players
    where pbk_staff.dupr_key(dupr_id) is not null
    group by pbk_staff.dupr_key(dupr_id)
    having count(*) > 1
  ) then
    raise exception 'Existing DUPR IDs collide after normalization. Review the affected player UUIDs before applying this migration.';
  end if;
end;
$$;

create unique index players_normalized_dupr_id_unique
  on public.players (pbk_staff.dupr_key(dupr_id))
  where pbk_staff.dupr_key(dupr_id) is not null;

create table pbk_staff.player_contacts (
  player_id uuid primary key references public.players(id),
  email text not null unique,
  constraint normalized_email check (
    pbk_staff.email_key(email) is not null and email = pbk_staff.email_key(email)
  )
);

create table pbk_staff.player_import_receipts (
  request_id uuid primary key,
  actor_id uuid not null,
  input_hash bytea not null,
  result jsonb not null,
  applied_at timestamptz not null default now()
);

alter table pbk_staff.player_contacts enable row level security;
alter table pbk_staff.player_import_receipts enable row level security;
revoke all on all tables in schema pbk_staff from public, anon, authenticated;

-- Some deployments already have a legacy email column on players. Carry its
-- usable identifiers forward without rewriting the public profile or history.
do $legacy_email$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'players' and column_name = 'email'
  ) then
    lock table public.players in share row exclusive mode;

    if exists (
      select 1 from public.players
      where pbk_staff.email_key(email) ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+[.][^@[:space:][:cntrl:]]+$'
      group by pbk_staff.email_key(email)
      having count(*) > 1
    ) then
      raise exception 'Existing player emails collide after normalization. Review the affected player UUIDs before applying this migration.';
    end if;

    insert into pbk_staff.player_contacts (player_id, email)
    select id, pbk_staff.email_key(email)
    from public.players
    where pbk_staff.email_key(email) ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+[.][^@[:space:][:cntrl:]]+$';
  end if;
end;
$legacy_email$;

create function public.prepare_player_import(
  p_rows jsonb,
  p_actor uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  committing boolean := p_request_id is not null;
  input_hash bytea;
  receipt pbk_staff.player_import_receipts%rowtype;
  results jsonb := '[]'::jsonb;
  entry jsonb;
  source_id bigint;
  source_name text;
  source_rating numeric;
  email_key_input text;
  dupr_id_input text;
  dupr_key text;
  by_dupr uuid;
  by_email uuid;
  candidate uuid;
  target uuid;
  action text;
  status text;
  reason text;
  saves_email boolean;
  saves_dupr boolean;
  player public.players%rowtype;
  player_email text;
  player_json jsonb;
  used_players uuid[] := array[]::uuid[];
  used_emails text[] := array[]::text[];
  used_dupr_ids text[] := array[]::text[];
begin
  if p_actor is null or p_rows is null or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'Invalid roster request.';
  end if;

  if committing then
    -- Serialize short imports with other player writers (including manual DUPR
    -- edits). Resolve again under the lock. A failure rolls back the whole batch.
    lock table public.players in share row exclusive mode;
    input_hash := sha256(convert_to(p_rows::text, 'UTF8'));
    select * into receipt
    from pbk_staff.player_import_receipts
    where request_id = p_request_id;
    if found then
      if receipt.actor_id <> p_actor or receipt.input_hash <> input_hash then
        raise exception 'This import request ID is already in use.';
      end if;
      return receipt.result;
    end if;
  end if;

  for entry in select value from jsonb_array_elements(p_rows)
  loop
    source_id := (entry->>'rowId')::bigint;
    source_name := entry->>'name';
    source_rating := (entry->>'rating')::numeric;
    email_key_input := pbk_staff.email_key(entry->>'email');
    dupr_id_input := entry->>'duprId';
    dupr_key := pbk_staff.dupr_key(dupr_id_input);
    action := entry->'decision'->>'action';
    target := nullif(entry->'decision'->>'playerId', '')::uuid;

    if committing and action = 'skip' then
      results := results || jsonb_build_object(
        'rowId', source_id, 'status', 'skipped', 'player', null, 'rating', null
      );
      continue;
    end if;

    by_dupr := null;
    by_email := null;
    candidate := null;
    player := null;
    player_email := null;
    player_json := null;
    saves_email := false;
    saves_dupr := false;
    status := 'review';
    reason := 'no_identifier_match';

    if (email_key_input is not null and email_key_input !~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+[.][^@[:space:][:cntrl:]]+$')
      or (dupr_key is not null and dupr_key ~ '[[:space:][:cntrl:]]') then
      status := 'conflict';
      reason := 'invalid_identifier';
    else
      if dupr_key is not null then
        select p.id into by_dupr
        from public.players p
        where pbk_staff.dupr_key(p.dupr_id) = dupr_key;
      end if;
      if email_key_input is not null then
        select c.player_id into by_email
        from pbk_staff.player_contacts c
        where c.email = email_key_input;
      end if;

      candidate := coalesce(by_dupr, by_email);
      if committing and action = 'link' and candidate is null then
        candidate := target;
      end if;
      if candidate is not null then
        select p.* into player from public.players p where p.id = candidate;
        select c.email into player_email from pbk_staff.player_contacts c where c.player_id = candidate;
      end if;

      if by_dupr is not null and by_email is not null and by_dupr <> by_email then
        status := 'conflict';
        reason := 'different_players';
      elsif (dupr_key is not null and pbk_staff.dupr_key(player.dupr_id) is not null
          and dupr_key <> pbk_staff.dupr_key(player.dupr_id))
        or (email_key_input is not null and player_email is not null and email_key_input <> player_email) then
        status := 'conflict';
        reason := 'different_identifier';
      elsif by_dupr is not null then
        status := 'match';
        reason := 'dupr_id';
        saves_email := email_key_input is not null and player_email is null;
      elsif by_email is not null and dupr_key is not null then
        reason := 'verify_new_dupr_id';
      elsif by_email is not null then
        status := 'match';
        reason := 'email';
      elsif email_key_input is null and dupr_key is null then
        reason := 'no_identifier';
      end if;
    end if;

    if committing then
      if status = 'conflict' and action <> 'check-in' then
        raise exception 'Row % has conflicting or invalid identifiers. Review it again or skip it.', source_id;
      end if;
      if action <> 'check-in' and (email_key_input = any(used_emails) or dupr_key = any(used_dupr_ids)) then
        raise exception 'Row % repeats an identifier in this roster. Skip the extra row or correct its identifiers.', source_id;
      end if;

      case action
        when 'check-in' then
          select p.* into player from public.players p where p.id = target;
          if player.id is null then
            raise exception 'The player selected for row % is no longer available.', source_id;
          end if;
          -- A staff member may resolve a roster slot without claiming its identifiers.
          saves_email := false;
          saves_dupr := false;
          email_key_input := null;
          dupr_key := null;
          status := 'matched';
          reason := 'staff_check_in';
        when 'match' then
          if status <> 'match' or target is distinct from candidate then
            raise exception 'The match for row % has changed. Review the roster again.', source_id;
          end if;
          status := 'matched';
        when 'link' then
          if target is null or target is distinct from candidate or player.id is null then
            raise exception 'The player selected for row % does not match its saved identifiers.', source_id;
          end if;
          saves_email := email_key_input is not null and player_email is null;
          saves_dupr := dupr_key is not null and pbk_staff.dupr_key(player.dupr_id) is null;
          status := 'linked';
        when 'new' then
          if candidate is not null then
            raise exception 'Row % now matches an existing player. Review the roster again.', source_id;
          end if;
          insert into public.players (name, dupr, dupr_id)
          values (source_name, 0, dupr_id_input)
          returning * into player;
          saves_email := email_key_input is not null;
          saves_dupr := dupr_key is not null;
          status := 'created';
        else
          raise exception 'Row % needs a decision.', source_id;
      end case;

      if player.id = any(used_players) then
        raise exception 'Row % repeats a player in this roster. Skip the extra row.', source_id;
      end if;
      if saves_email then
        insert into pbk_staff.player_contacts (player_id, email)
        values (player.id, email_key_input);
      end if;
      if saves_dupr and status = 'linked' then
        update public.players p set dupr_id = dupr_id_input
        where p.id = player.id returning p.* into player;
      end if;

      used_players := array_append(used_players, player.id);
      if email_key_input is not null then used_emails := array_append(used_emails, email_key_input); end if;
      if dupr_key is not null then used_dupr_ids := array_append(used_dupr_ids, dupr_key); end if;
    end if;

    if player.id is not null then
      player_json := jsonb_build_object('id', player.id, 'name', player.name, 'dupr', player.dupr, 'dupr_id', player.dupr_id);
    end if;
    results := results || jsonb_build_object(
      'rowId', source_id, 'status', status, 'reason', reason, 'player', player_json,
      'savesEmail', saves_email, 'savesDuprId', saves_dupr, 'rating', source_rating
    );
  end loop;

  if committing then
    insert into pbk_staff.player_import_receipts (request_id, actor_id, input_hash, result)
    values (p_request_id, p_actor, input_hash, results);
  end if;
  return results;
end;
$$;

revoke all on function public.prepare_player_import(jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_player_import(jsonb, uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
