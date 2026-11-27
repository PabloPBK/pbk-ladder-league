begin;

grant insert on table public.league_season_schedule to service_role;

create function public.create_league_with_seasons(
  plan_id uuid,
  league_name text,
  league_description text,
  season_plans jsonb
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  plan record;
  dates date[];
  new_season uuid;
begin
  if jsonb_array_length(season_plans) is null or jsonb_array_length(season_plans) = 0 then
    raise exception 'At least one season is required';
  end if;

  insert into public.leagues (id, name, description)
  values (plan_id, league_name, league_description)
  on conflict (id) do nothing;
  if not found then return plan_id; end if;

  for plan in
    select value, ordinality from jsonb_array_elements(season_plans) with ordinality
  loop
    select coalesce(array_agg(value::date order by value::date), '{}'::date[])
      into dates from jsonb_array_elements_text(plan.value);

    insert into public.seasons (league_id, name, start_date, end_date)
    values (plan_id, 'Season ' || plan.ordinality, dates[1], dates[cardinality(dates)])
    returning id into new_season;

    insert into public.league_season_schedule (season_id, event_date, session_number)
    select new_season, event_date, ordinality::int
    from unnest(dates) with ordinality as schedule(event_date, ordinality);
  end loop;

  return plan_id;
end;
$$;

revoke all on function public.create_league_with_seasons(uuid, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_league_with_seasons(uuid, text, text, jsonb) to service_role;
notify pgrst, 'reload schema';

commit;
