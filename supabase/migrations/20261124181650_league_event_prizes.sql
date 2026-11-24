begin;

create table public.league_event_prizes (
  event_id uuid primary key references public.league_events(id) on delete cascade,
  amount_cents integer check (amount_cents between 0 and 99999999)
);

alter table public.league_event_prizes enable row level security;
revoke all on table public.league_event_prizes from public, anon, authenticated, service_role;
grant select, insert, update on table public.league_event_prizes to service_role;

notify pgrst, 'reload schema';

commit;
