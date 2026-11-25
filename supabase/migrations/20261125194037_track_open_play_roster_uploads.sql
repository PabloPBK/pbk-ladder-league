begin;

create table public.open_play_roster_uploads (
  facility_id uuid not null references public.tournament_facilities(id),
  session_date date not null check (session_date >= date '2026-11-26'),
  session_time time not null,
  session_end time check (session_end > session_time),
  session_name_key text not null check (char_length(session_name_key) between 1 and 160),
  unique nulls not distinct (facility_id, session_date, session_time, session_name_key, session_end)
);
alter table public.open_play_roster_uploads enable row level security;
revoke all on public.open_play_roster_uploads from public, anon, authenticated, service_role;
grant select, insert on public.open_play_roster_uploads to service_role;

create function public.open_play_roster_name_key(session_name text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select coalesce(nullif(btrim(regexp_replace(lower(session_name), '[[:space:]·]+', ' ', 'g')), ''), btrim(session_name))
$$;
revoke all on function public.open_play_roster_name_key(text) from public, anon, authenticated;
grant execute on function public.open_play_roster_name_key(text) to service_role;

create function public.import_open_play_no_show_rosters(import_facility uuid, recorded_by uuid, rosters jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with files as (
    select * from jsonb_to_recordset(rosters) as f(
      session_date date, session_time time, session_end time, session_name text, source_file text, file_order integer, players jsonb
    )
  ),
  recorded_uploads as (
    insert into public.open_play_roster_uploads(facility_id, session_date, session_time, session_name_key, session_end)
    select import_facility, session_date, session_time, public.open_play_roster_name_key(session_name), session_end
    from files
    order by session_date, session_time, public.open_play_roster_name_key(session_name), session_end
    on conflict (facility_id, session_date, session_time, session_name_key, session_end) do nothing
  ),
  candidates as (
    select f.session_date, f.session_time, f.session_name, f.source_file, f.file_order,
           p.player_name, p.player_email, p.player_key
    from files f cross join lateral jsonb_to_recordset(f.players)
      as p(player_name text, player_email text, player_key text)
  ),
  added as (
    insert into public.open_play_no_shows(
      facility_id, session_date, session_time, session_name, source_file, imported_by, player_name, player_email, player_key
    )
    select import_facility, session_date, session_time, session_name, source_file, recorded_by,
           player_name, player_email, player_key
    from candidates
    order by session_date, session_time, player_key, file_order
    on conflict (facility_id, session_date, session_time, player_key) do nothing
    returning id
  )
  select jsonb_build_object('added', count(*), 'duplicates', (select count(*) from candidates) - count(*)) from added
$$;
revoke all on function public.import_open_play_no_show_rosters(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_open_play_no_show_rosters(uuid, uuid, jsonb) to service_role;

create function public.open_play_uploaded_sessions(schedule_facility uuid, schedule_date date, sessions jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with slots as (
    select idx, start_time, end_time, public.open_play_roster_name_key(name) as name_key
    from jsonb_to_recordset(sessions) as s(idx integer, start_time time, end_time time, name text)
  ),
  keyed as (
    select *, count(*) over (partition by start_time, name_key) as same_name_and_time from slots
  )
  select coalesce(jsonb_agg(slot.idx), '[]'::jsonb)
  from keyed slot
  where exists (
    select from public.open_play_roster_uploads upload
    where upload.facility_id = schedule_facility and upload.session_date = schedule_date
      and upload.session_time = slot.start_time and upload.session_name_key = slot.name_key
      and (upload.session_end = slot.end_time or (upload.session_end is null and slot.same_name_and_time = 1))
  )
  or (slot.same_name_and_time = 1 and exists (
    select from public.open_play_no_shows legacy
    where legacy.facility_id = schedule_facility and legacy.session_date = schedule_date
      and legacy.session_time = slot.start_time and public.open_play_roster_name_key(legacy.session_name) = slot.name_key
  ))
$$;
revoke all on function public.open_play_uploaded_sessions(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.open_play_uploaded_sessions(uuid, date, jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
