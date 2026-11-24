begin;

create function public.edit_pb101_guest_details(
  p_guest_id uuid,
  p_expected_updated_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_completed_at date,
  p_trial_start_date date
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  guest public.pb101_guests%rowtype;
  date_shift integer;
begin
  if p_first_name is null or char_length(btrim(p_first_name)) not between 1 and 100
      or p_last_name is null or char_length(btrim(p_last_name)) not between 1 and 100
      or p_completed_at is null or not isfinite(p_completed_at)
      or p_trial_start_date is null or not isfinite(p_trial_start_date) then
    return 'invalid';
  end if;

  select * into guest from public.pb101_guests
  where id = p_guest_id for update;

  if not found then
    return 'missing';
  end if;
  if guest.updated_at is distinct from p_expected_updated_at then
    return 'stale';
  end if;

  date_shift := p_trial_start_date - guest.trial_start_date;
  if date_shift <> 0 then
    -- Coordinate with the email worker's atomic claim before changing its schedule.
    perform 1 from public.pb101_email_log
    where guest_id = guest.id and status in ('pending', 'processing')
    order by id for update;

    if exists (select 1 from public.pb101_email_log
      where guest_id = guest.id and status = 'processing') then
      return 'email_processing';
    end if;

    -- Keep the same local send time across daylight saving transitions.
    update public.pb101_email_log
    set scheduled_at = (
      (scheduled_at at time zone 'America/Los_Angeles') + date_shift * interval '1 day'
    ) at time zone 'America/Los_Angeles'
    where guest_id = guest.id and status = 'pending';
  end if;

  update public.pb101_guests
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      pb101_completed_at = p_completed_at,
      trial_start_date = p_trial_start_date,
      status = case
        when date_shift = 0 or guest.status not in ('active', 'expired') then guest.status
        when p_trial_start_date + 7 < (now() at time zone 'America/Los_Angeles')::date then 'expired'
        else 'active'
      end,
      updated_at = clock_timestamp()
  where id = guest.id;

  return 'saved';
end;
$function$;

revoke execute on function public.edit_pb101_guest_details(uuid, timestamptz, text, text, date, date)
  from public, anon, authenticated;
grant execute on function public.edit_pb101_guest_details(uuid, timestamptz, text, text, date, date)
  to service_role;

notify pgrst, 'reload schema';

commit;
