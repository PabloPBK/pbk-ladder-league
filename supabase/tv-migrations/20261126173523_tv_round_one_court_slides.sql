-- Apply to the database configured by TV_SUPABASE_URL.
begin;

set local lock_timeout = '3s';

alter table public.tv_slides
  drop constraint tv_slides_media_type_check,
  drop constraint tv_slides_live_roster_valid,
  add constraint tv_slides_media_type_check
    check (media_type in ('image', 'video', 'roster_teams', 'roster_free_agents', 'roster_round_one')),
  add constraint tv_slides_live_roster_valid
    check (
      (media_type in ('image', 'video') and storage_path is not null)
      or
      (media_type in ('roster_teams', 'roster_free_agents', 'roster_round_one')
        and storage_path is null and roster_event_id is not null)
    );

commit;
