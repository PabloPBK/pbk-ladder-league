begin;

create table public.league_season_schedule (
  season_id uuid not null references public.seasons(id) on delete cascade,
  event_date date not null,
  session_number integer not null check (session_number > 0),
  primary key (season_id, event_date, session_number)
);

create table public.league_session_revenue (
  event_id uuid primary key references public.league_events(id) on delete cascade,
  member_count integer not null check (member_count between 0 and 10000),
  nonmember_count integer not null check (nonmember_count between 0 and 10000),
  revision uuid not null default gen_random_uuid(),
  updated_by uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.league_season_schedule enable row level security;
alter table public.league_session_revenue enable row level security;
revoke all on public.league_season_schedule, public.league_session_revenue from public, anon, authenticated, service_role;
grant select on public.league_season_schedule to service_role;
grant select, insert, update on public.league_session_revenue to service_role;

-- The Season 5 finale was registered through a single PodPlay link.
insert into public.league_season_schedule (season_id, event_date, session_number)
select id, date '2026-11-28', 5
from public.seasons
where id = '1ed5c456-9114-4970-9de4-b275979e37dc'
  and league_id = 'ddb1df99-eca5-404c-9576-ac230f15c74b'
  and name = 'Season 5';

notify pgrst, 'reload schema';

commit;
