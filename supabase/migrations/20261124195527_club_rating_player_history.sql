begin;

create function public.get_club_rating_player_history(p_player_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  with player as (
    select id, pbk_player_id, full_name, club_rating, rating_status, period_deadline
    from public.club_rating_players
    where id = p_player_id
  ), modern_scores as (
    select g.session_id, jsonb_agg(
      jsonb_build_object('number', g.game_number, 'rating', g.rating_after)
      order by g.game_number nulls last, g.created_at, g.id
    ) as games
    from public.club_rating_games g
    where g.club_rating_player_id = p_player_id and g.session_id is not null
      and g.video_id is not null and g.game_data->>'source' = 'pb_vision'
      and g.rating_after between 0 and 8
    group by g.session_id
  ), session_ids as (
    select sp.session_id from public.club_rating_session_players sp
    where sp.club_rating_player_id = p_player_id
    union
    select session_id from modern_scores
  ), sessions as (
    select s.id::text as key, s.session_name as name, s.session_date as played_at,
      s.status, s.created_at, 'pb_vision' as source, coalesce(g.games, '[]'::jsonb) as games
    from session_ids i
    join public.club_rating_sessions s on s.id = i.session_id
    left join modern_scores g on g.session_id = s.id
    union all
    select a.source_session_id, null::text, a.session_date, 'completed', null::timestamptz,
      'verified_archive', (
        select jsonb_agg(jsonb_build_object('number', score_number, 'rating', score) order by score_number)
        from unnest(a.scores) with ordinality as records(score, score_number)
      )
    from pbk_staff.club_rating_legacy_scores a
    where a.club_rating_player_id = p_player_id
  )
  select jsonb_build_object(
    'player', to_jsonb(p),
    'rolling_rating', r.rolling_rating,
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', s.key, 'name', s.name, 'date', s.played_at, 'status', s.status,
          'source', s.source, 'games', s.games)
        order by s.played_at desc, s.created_at desc nulls last, s.key desc
      )
      from sessions s
    ), '[]'::jsonb)
  )
  from player p
  cross join lateral public.calculate_club_rating_rolling(p.id) r;
$function$;

revoke execute on function public.get_club_rating_player_history(uuid) from public, anon, authenticated;
grant execute on function public.get_club_rating_player_history(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
