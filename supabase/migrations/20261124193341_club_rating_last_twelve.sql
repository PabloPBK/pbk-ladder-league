begin;

-- Historical score records are retained independently from native games so the
-- existing migration baseline and game counters continue to count them once.
create table pbk_staff.club_rating_legacy_scores (
  source_record_id text primary key,
  source_session_id text not null,
  club_rating_player_id uuid not null references public.club_rating_players(id) on delete restrict,
  session_date date not null check (session_date < date '2026-11-17'),
  scores numeric[] not null check (
    array_ndims(scores) = 1 and cardinality(scores) = 6
    and array_position(scores, null) is null and 0 <= all(scores) and 8 >= all(scores)
  ),
  unique (club_rating_player_id, source_session_id)
);

alter table pbk_staff.club_rating_legacy_scores enable row level security;
revoke all on table pbk_staff.club_rating_legacy_scores from public, anon, authenticated, service_role;
grant usage on schema pbk_staff to service_role;
grant select on table pbk_staff.club_rating_legacy_scores to service_role;

create or replace function public.calculate_club_rating_rolling(p_player_id uuid)
returns table(qualifying_sessions integer, latest_session_date date, rolling_rating numeric)
language sql stable
set search_path = ''
as $function$
  with native_scores as (
    select s.id::text as session_key, s.session_date, s.created_at as session_created_at,
      g.rating_after as score, g.game_number as game_order, g.created_at as score_created_at, g.id::text as score_key
    from public.club_rating_games g
    join public.club_rating_sessions s on s.id = g.session_id
    where g.club_rating_player_id = p_player_id and s.status = 'completed'
      and s.session_date >= date '2026-11-17'
      and g.video_id is not null and g.game_data->>'source' = 'pb_vision'
      and g.rating_after between 0 and 8
      and s.id not in (
        '91864b18-3d11-4521-b761-9a81ae91a839',
        '364ba1c2-a4f7-439d-b461-de81b654eb53',
        '18533709-f9f2-49f0-984d-00877fe71510',
        '4972022c-f377-4b89-b158-4f6d8fd5c94a',
        '84d1802f-fe9f-4ff6-816f-df3e8e6df5c6'
      )
  ), scored_games as (
    select * from native_scores
    union all
    select l.source_session_id, l.session_date, null::timestamptz, g.score, g.ordinal::integer, null::timestamptz, l.source_record_id
    from pbk_staff.club_rating_legacy_scores l
    cross join lateral unnest(l.scores) with ordinality as g(score, ordinal)
    where l.club_rating_player_id = p_player_id
  ), ranked as (
    select g.*, row_number() over (
      partition by g.session_key
      order by g.score desc, g.game_order desc nulls last, g.score_created_at desc nulls last, g.score_key desc
    ) as session_score_rank
    from scored_games g
    join public.club_rating_players p on p.id = p_player_id
    where p.rating_status <> 'requalification_required'
      or (p.requalification_started_at is not null and g.session_date > p.requalification_started_at::date)
  ), eligible as (
    -- The six scored slots per session policy still applies when extra games were played.
    select * from ranked where session_score_rank <= 6
  ), qualifying as (
    select session_key, session_date
    from eligible
    group by session_key, session_date
    having count(*) = 6
  ), eligibility as (
    select least(count(*), 2)::integer as qualifying_count, max(session_date) as most_recent
    from qualifying
  ), last_twelve as (
    select score
    from eligible
    order by session_date desc, session_created_at desc nulls last, session_key desc,
      game_order desc nulls last, score_created_at desc nulls last, score_key desc
    limit 12
  )
  select e.qualifying_count, e.most_recent,
    case when e.qualifying_count = 2 then (select round(avg(score), 3) from last_twelve) end
  from eligibility e;
$function$;

revoke execute on function public.calculate_club_rating_rolling(uuid) from public, anon, authenticated;
grant execute on function public.calculate_club_rating_rolling(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.complete_club_rating_session(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.club_rating_sessions%ROWTYPE;
  v_player record;
  v_rating record;
  v_games integer;
  v_sessions integer;
  v_published integer := 0;
  v_player_emails integer := 0;
  v_staff_emails integer := 0;
  v_missing_emails integer := 0;
  v_valid_email boolean;
  v_subject text;
  v_body text;
  v_current_rating numeric;
  v_action text;
  v_rolling numeric;
  v_deadline date;
  v_new_rating numeric;
  v_previous_rating numeric;
  v_result jsonb;
  v_transition record;
BEGIN
  -- Lock the session to prevent concurrent completion.
  SELECT *
  INTO v_session
  FROM public.club_rating_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.status NOT IN (
    'scheduled', 'in_progress'
  ) THEN
    RAISE EXCEPTION
      'Session cannot be completed from status %',
      v_session.status;
  END IF;

  -- Require at least one attended player.
  IF NOT EXISTS (
    SELECT 1
    FROM public.club_rating_session_players
    WHERE session_id = p_session_id
      AND attendance_status = 'attended'
  ) THEN
    RAISE EXCEPTION
      'No attended players in this session';
  END IF;

  -- Require recorded scores.
  IF NOT EXISTS (
    SELECT 1
    FROM public.club_rating_games
    WHERE session_id = p_session_id
  ) THEN
    RAISE EXCEPTION
      'Session has no recorded games';
  END IF;

  -- Validate every recorded score.
  IF EXISTS (
    SELECT 1
    FROM public.club_rating_games g
    LEFT JOIN public.club_rating_session_players sp
      ON sp.session_id = g.session_id
     AND sp.club_rating_player_id =
         g.club_rating_player_id
    WHERE g.session_id = p_session_id
      AND (
        g.video_id IS NULL
        OR g.game_data->>'source' IS DISTINCT FROM
           'pb_vision'
        OR g.rating_after IS NULL
        OR g.rating_after < 0
        OR g.rating_after > 8
        OR g.session_date <> v_session.session_date
        OR sp.attendance_status IS DISTINCT FROM
           'attended'
      )
  ) THEN
    RAISE EXCEPTION
      'Session contains invalid PB Vision scores';
  END IF;


  -- Identify games by session and game number.
  -- The same players may participate in multiple games.
  IF EXISTS (
    SELECT 1
    FROM public.club_rating_games
    WHERE session_id = p_session_id
      AND (
        game_number IS NULL
        OR game_number < 1
      )
  ) THEN
    RAISE EXCEPTION
      'Every score must have a valid game number';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_rating_games
    WHERE session_id = p_session_id
    GROUP BY game_number
    HAVING COUNT(*) <> 4
       OR COUNT(DISTINCT club_rating_player_id) <> 4
       OR COUNT(DISTINCT video_id) <> 1
  ) THEN
    RAISE EXCEPTION
      'Every game must contain four distinct players and one recording';
  END IF;

  -- Completion and all following database writes
  -- occur in the same transaction.
  UPDATE public.club_rating_sessions
  SET
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_session_id;

  -- Process each attended player.
  FOR v_player IN
    SELECT
      p.id,
      p.full_name,
      p.email,
      p.club_rating,
      p.rating_status,
      p.qualification_date,
      p.period_deadline,
      COUNT(g.id)::integer AS game_count
    FROM public.club_rating_session_players sp
    JOIN public.club_rating_players p
      ON p.id = sp.club_rating_player_id
    LEFT JOIN public.club_rating_games g
      ON g.session_id = sp.session_id
     AND g.club_rating_player_id = p.id
    WHERE sp.session_id = p_session_id
      AND sp.attendance_status = 'attended'
    GROUP BY
      p.id,
      p.full_name,
      p.email,
      p.club_rating,
      p.rating_status,
      p.qualification_date,
      p.period_deadline
    ORDER BY p.id
  LOOP
    v_games := v_player.game_count;
    v_action := 'none';

    -- Count qualifying sessions after this
    -- session has been marked completed.
    SELECT r.qualifying_sessions
    INTO v_sessions
    FROM public.calculate_club_rating_rolling(
      v_player.id
    ) r;


    v_valid_email :=
      v_player.email IS NOT NULL
      AND TRIM(v_player.email) ~*
        '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';


    -- Missing email: alert staff, but do not
    -- prevent session completion.
    IF NOT v_valid_email THEN
      v_missing_emails := v_missing_emails + 1;

      INSERT INTO public.club_rating_notifications (
        session_id,
        club_rating_player_id,
        notification_type,
        recipient_email,
        subject,
        message_body
      )
      VALUES (
        p_session_id,
        v_player.id,
        'missing_email',
        'info@pickleballkingdomlynnwood.com',
        'Club Rating: Missing Player Email',
        format(
          'Player: %s%sSession: %s%sGames recorded: %s%s%sPlease add or correct this player''s email address in the Club Rating system.',
          v_player.full_name,
          E'\\\\n',
          COALESCE(
            v_session.session_name,
            v_session.session_date::text
          ),
          E'\\\\n',
          v_games,
          E'\\\\n',
          E'\\\\n'
        )
      )
      ON CONFLICT (
        session_id,
        club_rating_player_id,
        notification_type
      ) DO NOTHING;

      v_staff_emails := v_staff_emails + 1;
    END IF;

    -- Initial qualification only.
    -- Existing official ratings remain unchanged.
    IF v_player.rating_status = 'provisional'
       AND v_games >= 6
       AND v_sessions = 2 THEN

      SELECT *
      INTO v_rating
      FROM public.publish_initial_club_rating(
        v_player.id
      );

      v_published := v_published + 1;
      v_action := 'initial_qualification';

      INSERT INTO public.club_rating_podplay_updates (
        club_rating_player_id,
        session_id,
        rating,
        player_email_missing,
        staff_notes
      )
      VALUES (
        v_player.id,
        p_session_id,
        v_rating.published_rating,
        NOT v_valid_email,
        'Initial Club Rating qualification'
      )
      ON CONFLICT (
        session_id,
        club_rating_player_id
      ) DO NOTHING;

      -- Notify staff to update PodPlay.
      INSERT INTO public.club_rating_notifications (
        session_id,
        club_rating_player_id,
        notification_type,
        recipient_email,
        subject,
        message_body
      )
      VALUES (
        p_session_id,
        v_player.id,
        'podplay_update',
        'info@pickleballkingdomlynnwood.com',
        'PodPlay Update Required: ' ||
          v_player.full_name,
        format(
          'New PBK Club Rating qualification%s%s%sOfficial rating: %s%sQualification date: %s%sRenewal deadline: %s%s%sPlease update this player''s rating in PodPlay and mark the update complete in the Club Rating dashboard.%sPlayer email missing: %s',
          E'\\\\n',
          v_player.full_name,
          E'\\\\n',
          v_rating.published_rating,
          E'\\\\n',
          v_rating.qualification_date,
          E'\\\\n',
          v_rating.renewal_deadline,
          E'\\\\n',
          E'\\\\n',
          E'\\\\n',
          CASE
            WHEN v_valid_email THEN 'No'
            ELSE 'Yes'
          END
        )
      )
      ON CONFLICT (
        session_id,
        club_rating_player_id,
        notification_type
      ) DO NOTHING;

      v_staff_emails := v_staff_emails + 1;

      IF v_valid_email AND NOT COALESCE((SELECT email_opted_out FROM public.club_rating_players WHERE id = v_player.id), true) THEN
        v_subject :=
          'Your Official PBK Club Rating Is Ready';

        v_body := format(
          'Hi %s,%s%sCongratulations! You have completed your PBK Club Rating qualification.%s%sYour official Club Rating: %s%sQualification date: %s%sNext mandatory renewal: %s%s%sYou can attend optional Club Rating sessions to improve your rating before your renewal deadline. Optional sessions can increase your official rating but will not lower it. Mandatory renewal results may increase or decrease your rating.%s%sYour PBK Club Rating is used for our club''s open play programs. Tournaments and other competitive events continue to use DUPR or other rating systems according to their rules.%s%sSee you on the courts!%sPickleball Kingdom Lynnwood',
          split_part(v_player.full_name, ' ', 1),
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          v_rating.published_rating,
          E'\\\\n',
          v_rating.qualification_date,
          E'\\\\n',
          v_rating.renewal_deadline,
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          E'\\\\n'
        );

        INSERT INTO public.club_rating_notifications (
          session_id,
          club_rating_player_id,
          notification_type,
          recipient_email,
          subject,
          message_body
        )
        VALUES (
          p_session_id,
          v_player.id,
          'initial_qualification',
          TRIM(v_player.email),
          v_subject,
          v_body
        )
        ON CONFLICT (
          session_id,
          club_rating_player_id,
          notification_type
        ) DO NOTHING;

        v_player_emails := v_player_emails + 1;
      END IF;

    -- Provisional players: send progress.
    ELSIF v_player.rating_status = 'provisional'
      AND v_valid_email
      AND NOT COALESCE((SELECT email_opted_out FROM public.club_rating_players WHERE id = v_player.id), true) THEN

      v_subject :=
        'Your PBK Club Rating Progress';

      IF v_games >= 6 AND v_sessions = 1 THEN
        v_body := format(
          'Hi %s,%s%sYou have completed your first qualifying Club Rating session!%s%sYou have completed 1 of 2 required qualifying sessions. You need one more session with at least 6 PB Vision games to establish your official rating.%s%sYour PBK Club Rating will be used for club open plays. Tournaments and other competitive events continue to use DUPR or other rating systems as required.%s%sSee you on the courts!%sPickleball Kingdom Lynnwood',
          split_part(v_player.full_name, ' ', 1),
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          E'\\\\n'
        );
      ELSE
        v_body := format(
          'Hi %s,%s%sThank you for participating in your Club Rating session.%s%sGames recorded this session: %s%sQualifying sessions completed: %s of 2%s%sA qualifying session requires at least 6 PB Vision games played within that same session. Games from separate incomplete sessions cannot be combined.%s%sPlease register for another Club Rating session to continue your qualification.%s%sYour PBK Club Rating is for club open plays. Tournaments and other competitive events use DUPR or other rating systems according to their rules.%s%sPickleball Kingdom Lynnwood',
          split_part(v_player.full_name, ' ', 1),
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          v_games,
          E'\\\\n',
          COALESCE(v_sessions, 0),
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n',
          E'\\\\n', E'\\\\n'
        );
      END IF;

      INSERT INTO public.club_rating_notifications (
        session_id,
        club_rating_player_id,
        notification_type,
        recipient_email,
        subject,
        message_body
      )
      VALUES (
        p_session_id,
        v_player.id,
        'first_session',
        TRIM(v_player.email),
        v_subject,
        v_body
      )
      ON CONFLICT (
        session_id,
        club_rating_player_id,
        notification_type
      ) DO NOTHING;

      v_player_emails := v_player_emails + 1;

    -- Already-qualified players: optional improvement or renewal.
    ELSIF v_player.rating_status = 'qualified'
      AND v_games >= 6 THEN

      SELECT r.rolling_rating
      INTO v_rolling
      FROM public.calculate_club_rating_rolling(v_player.id) r;


      -- Retain the migration blend as a fallback when verified game history cannot provide 12 scores.
      IF v_rolling IS NULL
         AND public.classify_club_rating_session(
           v_player.id, p_session_id
         ) = 'mandatory_renewal'
         AND NOT EXISTS (
           SELECT 1
           FROM public.club_rating_transition_renewals t
           WHERE t.club_rating_player_id = v_player.id
         )

         AND NOT EXISTS (
           SELECT 1
           FROM public.club_rating_history h
           WHERE h.club_rating_player_id = v_player.id
             AND h.reason = 'requalification'
         )
      THEN
        SELECT *
        INTO v_transition
        FROM public.calculate_club_rating_transition(
          v_player.id, p_session_id
        );

        IF FOUND THEN
          v_previous_rating := v_player.club_rating;
          v_new_rating := v_transition.blended_rating;
          v_action := 'historical_transition';

          INSERT INTO public.club_rating_transition_renewals (
            club_rating_player_id,
            session_id,
            historical_rating,
            pb_vision_rating,
            blended_rating
          )
          VALUES (
            v_player.id,
            p_session_id,
            v_transition.historical_rating,
            v_transition.pb_vision_rating,
            v_new_rating
          );

          UPDATE public.club_rating_players
          SET club_rating = v_new_rating,
              period_start = v_session.session_date,
              period_deadline =
                (v_session.session_date + INTERVAL '3 months')::date,
              updated_at = now()
          WHERE id = v_player.id;

          INSERT INTO public.club_rating_history (
            club_rating_player_id,
            source_record_id,
            rating_date,
            previous_rating,
            new_rating,
            rating_change,
            reason,
            notes,
            source_data
          )
          VALUES (
            v_player.id,
            'club-rating-session:' || p_session_id::text,
            v_session.session_date,
            v_previous_rating,
            v_new_rating,
            v_new_rating - v_previous_rating,
            'historical_transition',
            'First renewal after historical import: 60/40 blend',
            jsonb_build_object(
              'session_id', p_session_id,
              'historical_rating', v_transition.historical_rating,
              'pb_vision_rating', v_transition.pb_vision_rating,
              'historical_weight', 0.60,
              'pb_vision_weight', 0.40
            )
          );

          v_published := v_published + 1;

          IF v_new_rating IS DISTINCT FROM v_previous_rating THEN
            INSERT INTO public.club_rating_podplay_updates (
              club_rating_player_id,
              session_id,
              rating,
              player_email_missing,
              staff_notes
            )
            VALUES (
              v_player.id,
              p_session_id,
              v_new_rating,
              NOT v_valid_email,
              'Historical transition: 60/40 blend'
            )
            ON CONFLICT (
              session_id, club_rating_player_id
            ) DO NOTHING;

            INSERT INTO public.club_rating_notifications (
              session_id,
              club_rating_player_id,
              notification_type,
              recipient_email,
              subject,
              message_body
            )
            VALUES (
              p_session_id,
              v_player.id,
              'podplay_update',
              'info@pickleballkingdomlynnwood.com',
              'PodPlay Update Required: ' || v_player.full_name,
              format(
                'Player: %s. Action: Historical 60/40 renewal. Old rating: %s. New rating: %s. Please update PodPlay.',
                v_player.full_name,
                v_previous_rating,
                v_new_rating
              )
            )
            ON CONFLICT (
              session_id,
              club_rating_player_id,
              notification_type
            ) DO NOTHING;

            v_staff_emails := v_staff_emails + 1;
          END IF;

          IF v_valid_email AND NOT COALESCE((SELECT email_opted_out FROM public.club_rating_players WHERE id = v_player.id), true) THEN
            INSERT INTO public.club_rating_notifications (
              session_id,
              club_rating_player_id,
              notification_type,
              recipient_email,
              subject,
              message_body
            )
            VALUES (
              p_session_id,
              v_player.id,
              'historical_transition',
              TRIM(v_player.email),
              'Your PBK Club Rating Renewal',
              format(
                'Hi %s, Your renewed Club Rating is %s. Your next renewal deadline is %s.',
                split_part(v_player.full_name, ' ', 1),
                v_new_rating,
                (v_session.session_date + INTERVAL '3 months')::date
              )
            )
            ON CONFLICT (
              session_id, club_rating_player_id, notification_type
            ) DO NOTHING;
          END IF;
        END IF;
      END IF;

      -- A qualified player may have an imported official rating

      -- without two completed qualifying PB Vision sessions.
      -- Preserve their rating and deadline until rolling data exists.
      IF v_rolling IS NOT NULL
         AND v_action = 'none' THEN

      v_action := public.classify_club_rating_session(
        v_player.id, p_session_id
      );
      v_previous_rating := v_player.club_rating;

      IF v_action = 'optional_improvement' THEN
        v_new_rating := GREATEST(v_previous_rating, v_rolling);
      ELSIF v_action = 'mandatory_renewal' THEN
        v_new_rating := v_rolling;
      ELSE
        RAISE EXCEPTION 'Unexpected rating action: %', v_action;
      END IF;

      IF v_action = 'mandatory_renewal' THEN
        UPDATE public.club_rating_players
        SET club_rating = v_new_rating,
            period_start = v_session.session_date,
            period_deadline = (v_session.session_date + INTERVAL '3 months')::date,
            updated_at = now()
        WHERE id = v_player.id;
      ELSIF v_new_rating > v_previous_rating THEN
        UPDATE public.club_rating_players
        SET club_rating = v_new_rating,
            updated_at = now()
        WHERE id = v_player.id;
      ELSE
        -- An optional session that does not improve the rating
        -- is still recorded, but no official rating change occurs.
        v_action := 'none';
      END IF;

      IF v_action <> 'none' THEN
        v_published := v_published + 1;

        INSERT INTO public.club_rating_history (
          club_rating_player_id, source_record_id, rating_date,
          previous_rating, new_rating, rating_change, reason, notes,
          source_data
        ) VALUES (
          v_player.id,
          'club-rating-session:' || p_session_id::text,
          v_session.session_date,
          v_previous_rating, v_new_rating,
          v_new_rating - v_previous_rating,
          v_action,
          'Official rating update from qualifying Club Rating session',
          jsonb_build_object('session_id', p_session_id,
                             'rolling_rating', v_rolling)
        );

        IF v_new_rating IS DISTINCT FROM v_previous_rating THEN
          INSERT INTO public.club_rating_podplay_updates (
            club_rating_player_id, session_id, rating,
            player_email_missing, staff_notes
          ) VALUES (
            v_player.id, p_session_id, v_new_rating,
            NOT v_valid_email, v_action
          ) ON CONFLICT (session_id, club_rating_player_id) DO NOTHING;

          INSERT INTO public.club_rating_notifications (
            session_id, club_rating_player_id, notification_type,
            recipient_email, subject, message_body
          ) VALUES (
            p_session_id, v_player.id, 'podplay_update',
            'info@pickleballkingdomlynnwood.com',
            'PodPlay Update Required: ' || v_player.full_name,
            format('Player: %s\\nAction: %s\\nOld rating: %s\\nNew rating: %s\\nPlease update PodPlay.',
                   v_player.full_name, v_action,
                   v_previous_rating, v_new_rating)
          ) ON CONFLICT (session_id, club_rating_player_id,
                         notification_type) DO NOTHING;
          v_staff_emails := v_staff_emails + 1;
        END IF;

        IF v_valid_email AND NOT COALESCE((SELECT email_opted_out FROM public.club_rating_players WHERE id = v_player.id), true) THEN
          SELECT period_deadline INTO v_deadline
          FROM public.club_rating_players WHERE id = v_player.id;

          INSERT INTO public.club_rating_notifications (
            session_id, club_rating_player_id, notification_type,
            recipient_email, subject, message_body
          ) VALUES (
            p_session_id, v_player.id, v_action,
            trim(v_player.email),
            CASE WHEN v_action = 'mandatory_renewal'
                 THEN 'Your PBK Club Rating Renewal'
                 ELSE 'Your PBK Club Rating Improvement' END,
            format('Hi %s,\\n\\nYour Club Rating session is complete.\\nPrevious rating: %s\\nOfficial rating: %s\\nNext renewal deadline: %s\\n\\nPickleball Kingdom Lynnwood',
                   split_part(v_player.full_name, ' ', 1),
                   v_previous_rating, v_new_rating, v_deadline)
          ) ON CONFLICT (session_id, club_rating_player_id,
                         notification_type) DO NOTHING;
          v_player_emails := v_player_emails + 1;
        END IF;
      END IF;
      END IF; -- v_rolling IS NOT NULL
    END IF;


    -- Manual-reset requalification:
    -- Publish only after two new qualifying sessions.
    IF v_player.rating_status = 'requalification_required'
       AND v_games >= 6
       AND v_sessions = 2
    THEN
      PERFORM public.publish_club_rating_requalification(
        v_player.id
      );

      v_action := 'requalification';
      v_published := v_published + 1;
    END IF;

    -- Save a permanent snapshot after any rating publication.
    -- This remains inside the session completion transaction.
    SELECT p.club_rating
    INTO v_current_rating
    FROM public.club_rating_players p
    WHERE p.id = v_player.id;

    PERFORM public.save_club_rating_session_history(
      p_session_id,
      v_player.id,
      v_player.club_rating,
      v_current_rating,
      v_action
    );

    -- Synchronize stored game counters in the same transaction.
    PERFORM public.sync_club_rating_counters(v_player.id);
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'completed',
    'ratings_published', v_published,
    'player_notifications_queued', v_player_emails,
    'staff_notifications_queued', v_staff_emails,
    'players_missing_email', v_missing_emails
  );

  RETURN v_result;
END;
$function$;

commit;
