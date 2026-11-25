begin;

create function public.open_play_no_show_player_groups(
  report_facility uuid, queue_status text, group_offset integer, group_limit integer
)
returns table (player_key text, entries jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  with outcomes as (
    select case when player_email is not null and left(n.player_key, 6) = 'email:'
                  then n.player_key else 'entry:' || id::text end as group_key,
           id, session_date, session_time, session_name, player_name, player_email,
           claimed_by, staff_name, claimed_at, resolved_at, skip_reason, status,
           charge_cents, reversal_cents, reversed_at, reversal_staff_name, reversal_reason,
           notes, notes_updated_at, notes_staff_name
    from public.open_play_no_shows n
    where facility_id = report_facility
      and ((queue_status = 'charged' and status = 'charged')
        or (queue_status = 'reversed' and status in ('reversed', 'skipped')))
  ),
  groups as (
    select group_key, max(coalesce(reversed_at, resolved_at)) as latest_outcome
    from outcomes
    group by group_key
    order by latest_outcome desc, group_key
    offset group_offset limit least(group_limit, 101)
  )
  select g.group_key, jsonb_agg(to_jsonb(c) - 'group_key' order by c.session_date desc, c.session_time desc, c.id)
  from groups g join outcomes c using (group_key)
  group by g.group_key, g.latest_outcome
  order by g.latest_outcome desc, g.group_key
$$;

revoke all on function public.open_play_no_show_player_groups(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.open_play_no_show_player_groups(uuid, text, integer, integer) to service_role;

-- Keep the previous deployment's entry point available during rollout.
create or replace function public.open_play_no_show_charge_groups(report_facility uuid, group_offset integer)
returns table (player_key text, entries jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.open_play_no_show_player_groups(report_facility, 'charged', group_offset, 51)
$$;

notify pgrst, 'reload schema';

commit;
