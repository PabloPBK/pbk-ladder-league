create table public.league_tv_overrides (
  screen_id uuid primary key,
  event_id uuid not null references public.league_events (id) on delete cascade,
  mode text not null check (mode in ('courts', 'standings'))
);
create index league_tv_overrides_event_id_idx on public.league_tv_overrides (event_id);

alter table public.league_tv_overrides enable row level security;
revoke all on public.league_tv_overrides from public, anon, authenticated, service_role;
grant select, insert, update on public.league_tv_overrides to service_role;

create function public.clear_completed_league_tv_overrides()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.league_tv_overrides where event_id = new.id;
  return new;
end;
$$;

revoke all on function public.clear_completed_league_tv_overrides() from public, anon, authenticated;
grant delete on public.league_tv_overrides to service_role;

create trigger clear_completed_league_tv_overrides
after update of status on public.league_events
for each row
when (old.status is distinct from new.status and new.status = 'complete')
execute function public.clear_completed_league_tv_overrides();

create function public.assign_league_session_tv(p_screen_id uuid, p_event_id uuid, p_mode text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serialize assignment with completion and deletion for this session.
  perform id from public.league_events
  where id = p_event_id and status = 'active' for share;
  if not found or not exists (
    select 1 from public.rounds where event_id = p_event_id and round_number = 1
  ) then
    return false;
  end if;

  insert into public.league_tv_overrides(screen_id, event_id, mode)
  values (p_screen_id, p_event_id, p_mode)
  on conflict (screen_id) do update set event_id = excluded.event_id, mode = excluded.mode;
  return true;
end;
$$;

revoke all on function public.assign_league_session_tv(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_league_session_tv(uuid, uuid, text) to service_role;
