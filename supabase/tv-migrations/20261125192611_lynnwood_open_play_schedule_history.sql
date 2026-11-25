-- Apply to the database configured by TV_SUPABASE_URL.
begin;

create extension if not exists pg_cron;

create table public.lynnwood_open_play_schedule_history (
  schedule_date date primary key,
  open_plays jsonb not null check (jsonb_typeof(open_plays) = 'array')
);
alter table public.lynnwood_open_play_schedule_history enable row level security;
revoke all on public.lynnwood_open_play_schedule_history from public, anon, authenticated, service_role;
grant select on public.lynnwood_open_play_schedule_history to service_role;

create function public.extract_scheduled_open_plays(schedule jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'start', event->>'start',
    'end', event->>'end',
    'levels', (
      select coalesce(jsonb_agg(
        case when assignment->>'level' = 'Custom' then assignment->>'customLevel' else assignment->>'level' end
        order by position
      ), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(event->'assignments') = 'array'
        then event->'assignments' else '[]'::jsonb end) with ordinality groups(assignment, position)
    )
  ) order by position), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(schedule->'events') = 'array'
    then schedule->'events' else '[]'::jsonb end) with ordinality events(event, position)
  where event->>'type' = 'Open Play'
$$;
revoke all on function public.extract_scheduled_open_plays(jsonb) from public, anon, authenticated;
grant execute on function public.extract_scheduled_open_plays(jsonb) to service_role;

create function public.archive_lynnwood_open_play_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_date text := old.schedule_data->>'schedule_date';
  today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if prior_date ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(prior_date, 'date') then
    if prior_date::date >= today - 3 and prior_date::date < today then
      insert into public.lynnwood_open_play_schedule_history(schedule_date, open_plays)
      values (prior_date::date, public.extract_scheduled_open_plays(old.schedule_data))
      on conflict (schedule_date) do update set open_plays = excluded.open_plays;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.archive_lynnwood_open_play_schedule() from public, anon, authenticated;

create trigger archive_lynnwood_open_play_schedule
after update of schedule_data on public.facility_schedule
for each row when (
  old.facility_id = 'lynnwood' and new.facility_id = 'lynnwood'
  and (old.schedule_data->>'schedule_date') is distinct from (new.schedule_data->>'schedule_date')
)
execute function public.archive_lynnwood_open_play_schedule();

create function public.lynnwood_scheduled_open_plays(requested_date date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select public.extract_scheduled_open_plays(schedule_data) from public.facility_schedule
      where facility_id = 'lynnwood' and schedule_data->>'schedule_date' = to_char(requested_date, 'YYYY-MM-DD')),
    (select open_plays from public.lynnwood_open_play_schedule_history where schedule_date = requested_date)
  )
  where requested_date between (now() at time zone 'America/Los_Angeles')::date - 3
    and (now() at time zone 'America/Los_Angeles')::date - 1
$$;
revoke all on function public.lynnwood_scheduled_open_plays(date) from public, anon, authenticated;
grant execute on function public.lynnwood_scheduled_open_plays(date) to service_role;

select cron.schedule(
  'lynnwood-expire-open-play-schedule',
  '15 * * * *',
  $$delete from public.lynnwood_open_play_schedule_history
    where schedule_date < (now() at time zone 'America/Los_Angeles')::date - 3$$
);

notify pgrst, 'reload schema';

commit;
