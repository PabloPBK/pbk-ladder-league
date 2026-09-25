-- PBK Ladder League upgrade: session support + DUPR player identifiers.
alter table if exists public.players
  add column if not exists dupr_id text;

create unique index if not exists players_dupr_id_unique
  on public.players (dupr_id)
  where dupr_id is not null and length(trim(dupr_id)) > 0;

alter table if exists public.league_events
  add column if not exists session_number integer not null default 1;

alter table if exists public.league_events
  add column if not exists session_note text;

create unique index if not exists league_events_season_date_session_unique
  on public.league_events (season_id, event_date, session_number);
