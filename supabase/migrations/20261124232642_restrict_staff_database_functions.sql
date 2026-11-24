begin;

alter function public.publish_initial_club_rating(uuid) set search_path = '';
alter function public.set_updated_at() set search_path = '';

revoke execute on function public.correct_club_rating_video_completed(uuid, uuid, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.correct_club_rating_video_completed(uuid, uuid, jsonb, text, uuid)
  to service_role;

-- Existing tournament policies reference the function by OID. Moving it keeps
-- those policies in place while removing the helper from the public Data API.
alter function public.is_tournament_staff() set schema pbk_staff;

notify pgrst, 'reload schema';

commit;
