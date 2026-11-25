begin;

alter table public.open_play_no_shows
  add column charge_cents integer check (charge_cents between 1 and 1000000),
  add column reversal_cents integer check (reversal_cents between 0 and 1000000),
  add column reversed_at timestamptz,
  add column reversed_by uuid,
  add column reversal_staff_name text check (char_length(btrim(reversal_staff_name)) between 1 and 100),
  add column reversal_reason text check (char_length(btrim(reversal_reason)) between 1 and 500),
  add column notes text check (char_length(notes) between 1 and 2000),
  add column notes_updated_at timestamptz,
  add column notes_updated_by uuid,
  add column notes_staff_name text check (char_length(btrim(notes_staff_name)) between 1 and 100),
  drop constraint open_play_no_shows_status_check,
  drop constraint open_play_no_shows_check1,
  add constraint open_play_no_shows_lifecycle_check check (
    (status = 'pending' and resolved_at is null and skip_reason is null and charge_cents is null and notes_updated_at is null)
    or (status = 'charged' and claimed_by is not null and resolved_at is not null and skip_reason is null)
    or (status = 'skipped' and claimed_by is not null and resolved_at is not null and skip_reason is not null and charge_cents is null)
    or (status = 'reversed' and claimed_by is not null and resolved_at is not null and skip_reason is null
      and ((reversal_cents = 0 and charge_cents is null and resolved_at = reversed_at)
        or (reversal_cents > 0 and resolved_at <= reversed_at and (charge_cents is null or reversal_cents <= charge_cents))))
  ),
  add constraint open_play_no_shows_reversal_check check (
    (status = 'reversed' and num_nonnulls(reversal_cents, reversed_at, reversed_by, reversal_staff_name, reversal_reason) = 5)
    or (status <> 'reversed' and num_nonnulls(reversal_cents, reversed_at, reversed_by, reversal_staff_name, reversal_reason) = 0)
  ),
  add constraint open_play_no_shows_note_check check (
    (notes is null and num_nonnulls(notes_updated_at, notes_updated_by, notes_staff_name) = 0)
    or num_nonnulls(notes_updated_at, notes_updated_by, notes_staff_name) = 3
  );

create index open_play_no_shows_report_resolved_idx
  on public.open_play_no_shows (facility_id, resolved_at) where resolved_at is not null;
create index open_play_no_shows_report_reversed_idx
  on public.open_play_no_shows (facility_id, reversed_at) where reversed_at is not null;

create function public.open_play_no_show_daily_report(report_facility uuid, report_date date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with day_bounds as (
    select report_date::timestamp at time zone 'America/Los_Angeles' as starts_at,
           (report_date + 1)::timestamp at time zone 'America/Los_Angeles' as ends_at
  ),
  events as (
    select n.id, n.session_date, n.session_time, n.session_name, n.player_name,
           n.resolved_at as recorded_at, n.staff_name, n.notes,
           case when n.status = 'skipped' then 'Exception' else 'Charge' end as event,
           case when n.status = 'skipped' then 0 else n.charge_cents end as amount_cents,
           n.skip_reason as reason
    from public.open_play_no_shows n cross join day_bounds d
    where n.facility_id = report_facility
      and n.resolved_at >= d.starts_at and n.resolved_at < d.ends_at
      and (n.status in ('charged', 'skipped') or n.reversal_cents > 0)
    union all
    select n.id, n.session_date, n.session_time, n.session_name, n.player_name,
           n.reversed_at, n.reversal_staff_name, n.notes,
           case when n.reversal_cents = 0 then 'Exception' else 'Refund' end,
           n.reversal_cents, n.reversal_reason
    from public.open_play_no_shows n cross join day_bounds d
    where n.facility_id = report_facility
      and n.reversed_at >= d.starts_at and n.reversed_at < d.ends_at
  )
  select coalesce(jsonb_agg(to_jsonb(events) order by recorded_at, event, id), '[]'::jsonb)
  from events
$$;

revoke all on function public.open_play_no_show_daily_report(uuid, date) from public, anon, authenticated;
grant execute on function public.open_play_no_show_daily_report(uuid, date) to service_role;

notify pgrst, 'reload schema';

commit;
