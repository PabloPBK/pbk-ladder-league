begin;

create table public.open_play_no_shows (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.tournament_facilities(id),
  session_date date not null check (session_date >= date '2026-11-26'),
  session_time time not null,
  session_name text not null check (char_length(btrim(session_name)) between 1 and 160),
  player_name text not null check (char_length(btrim(player_name)) between 1 and 160),
  player_email text,
  player_key text not null,
  source_file text not null check (char_length(source_file) between 1 and 255),
  imported_by uuid not null,
  imported_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'charged', 'skipped')),
  claimed_by uuid,
  staff_name text check (char_length(btrim(staff_name)) between 1 and 100),
  claimed_at timestamptz,
  resolved_at timestamptz,
  skip_reason text check (char_length(btrim(skip_reason)) between 1 and 500),
  unique (facility_id, session_date, session_time, player_key),
  check (
    (claimed_by is null and claimed_at is null and staff_name is null)
    or (claimed_by is not null and claimed_at is not null and staff_name is not null)
  ),
  check (
    (status = 'pending' and resolved_at is null and skip_reason is null)
    or (status = 'charged' and claimed_by is not null and resolved_at is not null and skip_reason is null)
    or (status = 'skipped' and claimed_by is not null and resolved_at is not null and skip_reason is not null)
  )
);

create index open_play_no_shows_queue_idx
  on public.open_play_no_shows (status, session_date desc, session_time desc, id);

alter table public.open_play_no_shows enable row level security;
revoke all on public.open_play_no_shows from public, anon, authenticated;
grant select, insert, update on public.open_play_no_shows to service_role;

notify pgrst, 'reload schema';

commit;
