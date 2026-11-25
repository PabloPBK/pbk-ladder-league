begin;

alter table public.league_listings
  add column registration_sessions jsonb not null default '[]'::jsonb
  constraint league_registration_sessions_array
    check (jsonb_typeof(registration_sessions) = 'array' and jsonb_array_length(registration_sessions) <= 40);

notify pgrst, 'reload schema';

commit;
