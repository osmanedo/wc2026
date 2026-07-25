-- =============================================================================
-- Functions for WC2026 Fantasy
-- =============================================================================
-- Ordered by dependency for readability. Postgres does not enforce this order
-- (function bodies are validated at call time, not creation time) but it makes
-- the file easier to reason about.
--
-- Sections:
--   1. Utility functions (get_result, get_user_count)
--   2. Read helpers (get_match_pick_distribution, get_group_picks_for_match,
--      get_leaderboard_page, get_leaderboard_neighborhood)
--   3. Core write function (calculate_points)
--   4. Composite read function (get_user_wrapped_stats)
--   5. Trigger functions (handle_new_user)
--   6. Deprecated (refresh_leaderboard) - kept for archive fidelity
--   7. Supabase-managed (rls_auto_enable) - present in every Supabase project
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Utility functions
-- -----------------------------------------------------------------------------

-- get_result: returns 'HOME', 'AWAY', or 'DRAW' given two integer scores.
--
-- Note: currently VOLATILE in production, but it is a pure function of its
-- inputs (no side effects, deterministic). Marking it IMMUTABLE in a 2028
-- rebuild would let the planner cache and inline it. Kept as VOLATILE here
-- to match production reality. Consider changing during tech debt cleanup.
CREATE OR REPLACE FUNCTION public.get_result(home integer, away integer)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
AS $$
BEGIN
  IF home > away THEN RETURN 'HOME';
  ELSIF away > home THEN RETURN 'AWAY';
  ELSE RETURN 'DRAW';
  END IF;
END;
$$;


-- get_user_count: total signups (all profiles rows, including zero-pick users).
-- SECURITY DEFINER because profiles has RLS and we want the count regardless
-- of caller identity for public stats (e.g. "1,320 tippers joined").
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer FROM profiles;
$$;


-- -----------------------------------------------------------------------------
-- 2. Read helpers
-- -----------------------------------------------------------------------------

-- get_match_pick_distribution: crowd-wisdom stats for a match.
-- Only reveals distribution AFTER kickoff (via the m.kickoff_utc <= now() gate).
-- SECURITY DEFINER so it can read the picks table under RLS without exposing
-- individual picks (the aggregate is safe to expose).
CREATE OR REPLACE FUNCTION public.get_match_pick_distribution(p_match_id integer)
RETURNS TABLE(
  home_wins integer,
  draws integer,
  away_wins integer,
  total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*) FILTER (WHERE p.pick_home > p.pick_away)::integer AS home_wins,
    COUNT(*) FILTER (WHERE p.pick_home = p.pick_away)::integer AS draws,
    COUNT(*) FILTER (WHERE p.pick_home < p.pick_away)::integer AS away_wins,
    COUNT(*)::integer AS total
  FROM picks p
  JOIN matches m ON m.id = p.match_id
  WHERE p.match_id = p_match_id
    AND m.kickoff_utc <= now();
$$;


-- get_group_picks_for_match: picks made by every member of a group for a match.
-- SECURITY INVOKER: relies on the "League members see each other's picks after
-- kickoff" RLS policy on picks to filter out pre-kickoff picks and non-group
-- members. Caller only sees what RLS lets them see.
CREATE OR REPLACE FUNCTION public.get_group_picks_for_match(
  p_match_id integer,
  p_group_id integer
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  pick_home integer,
  pick_away integer,
  pick_winner text,
  points_earned integer
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
AS $$
  SELECT
    p.user_id,
    pr.display_name,
    p.pick_home,
    p.pick_away,
    p.pick_winner,
    p.points_earned
  FROM picks p
  JOIN profiles pr ON pr.id = p.user_id
  JOIN group_members gm ON gm.user_id = p.user_id
  WHERE p.match_id = p_match_id
    AND gm.group_id = p_group_id
  ORDER BY pr.display_name ASC;
$$;


-- get_leaderboard_page: paginated global leaderboard read.
-- Uses the full tiebreaker chain (points, exact, correct, best match, streak,
-- accuracy, alphabetical). If you change the ORDER BY here, also change it in
-- get_leaderboard_neighborhood and get_user_wrapped_stats to keep rank
-- calculations consistent across the app.
CREATE OR REPLACE FUNCTION public.get_leaderboard_page(
  p_offset integer,
  p_limit integer
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points integer,
  exact_scores integer,
  correct_results integer,
  best_single_match integer,
  current_streak integer,
  accuracy_pct numeric,
  last_5_form text,
  rank bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH ranked AS (
    SELECT
      l.user_id,
      p.display_name,
      p.avatar_url,
      l.total_points,
      l.exact_scores,
      l.correct_results,
      l.best_single_match,
      l.current_streak,
      l.accuracy_pct,
      l.last_5_form,
      ROW_NUMBER() OVER (
        ORDER BY
          l.total_points      DESC,
          l.exact_scores      DESC,
          l.correct_results   DESC,
          l.best_single_match DESC,
          l.current_streak    DESC,
          l.accuracy_pct      DESC,
          p.display_name      ASC
      ) AS rank
    FROM leaderboard l
    LEFT JOIN profiles p ON p.id = l.user_id
  )
  SELECT *
  FROM ranked
  ORDER BY rank
  OFFSET p_offset
  LIMIT p_limit;
$$;


-- get_leaderboard_neighborhood: top N + rows around the requesting user.
-- Used for the "your rank" view where you see the leaders plus your immediate
-- neighbors. If user has no leaderboard entry, returns only the top section.
-- SECURITY DEFINER because it needs to read every leaderboard row to compute
-- ranks regardless of caller RLS.
CREATE OR REPLACE FUNCTION public.get_leaderboard_neighborhood(
  p_user_id uuid,
  p_top_n integer,
  p_neighbors integer
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url character varying,
  total_points bigint,
  exact_scores bigint,
  correct_results bigint,
  accuracy_pct numeric,
  current_streak bigint,
  last_5_form text,
  best_single_match integer,
  rank bigint,
  section text
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
  WITH ranked AS (
    SELECT
      l.user_id,
      p.display_name,
      p.avatar_url,
      l.total_points,
      l.exact_scores,
      l.correct_results,
      l.accuracy_pct,
      l.current_streak,
      l.last_5_form,
      l.best_single_match,
      ROW_NUMBER() OVER (
        ORDER BY
          l.total_points      DESC,
          l.exact_scores      DESC,
          l.correct_results   DESC,
          l.best_single_match DESC,
          l.current_streak    DESC,
          l.accuracy_pct      DESC,
          p.display_name      ASC
      ) AS rank
    FROM leaderboard l
    LEFT JOIN profiles p ON p.id = l.user_id
  ),
  user_rank AS (
    SELECT rank
    FROM ranked
    WHERE user_id = p_user_id
  ),
  top_section AS (
    SELECT r.*, 'top'::text AS section
    FROM ranked r
    WHERE r.rank <= p_top_n
  ),
  neighborhood AS (
    SELECT r.*, 'neighborhood'::text AS section
    FROM ranked r
    CROSS JOIN user_rank ur
    WHERE r.rank BETWEEN (ur.rank - p_neighbors) AND (ur.rank + p_neighbors)
      AND r.rank > p_top_n
  )
  SELECT * FROM top_section
  UNION ALL
  SELECT * FROM neighborhood
  ORDER BY rank;
$$;


-- -----------------------------------------------------------------------------
-- 3. Core write function
-- -----------------------------------------------------------------------------

-- calculate_points: scores every pick for a given match.
-- Idempotent - safe to re-run at any time. Called by update_results.py via
-- RPC when a match transitions to FINISHED, and again if the winner column
-- backfills after a shootout (see winner_changed logic in update_results.py).
--
-- Scoring model:
--   Base points:
--     5 = exact score
--     2 = correct result (win/draw/loss) but wrong score
--     0 = wrong result
--   Advancement bonus (knockout only, added to base):
--     1 = predicted the advancing team correctly
--     0 = wrong advancer or group stage
--   Stage multiplier applied to (base + bonus):
--     3 = FINAL
--     2 = LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE
--     1 = GROUP_STAGE
--
-- SECURITY INVOKER: only ever called via service key from Python. Never exposed
-- to authenticated users. Would need SECURITY DEFINER if that ever changed.
CREATE OR REPLACE FUNCTION public.calculate_points(match_id_input integer)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
AS $$
DECLARE
  match_row matches%ROWTYPE;
  actual_result TEXT;
  predicted_result TEXT;
  predicted_advancer TEXT;
  base_points INT;
  bonus_points INT;
  multiplier INT;
  pick_row picks%ROWTYPE;
BEGIN
  -- Get the match
  SELECT * INTO match_row FROM matches WHERE id = match_id_input;

  -- Get actual result
  actual_result := get_result(match_row.home_score, match_row.away_score);

  -- Get multiplier (THIRD_PLACE now included as x2)
  IF match_row.stage = 'FINAL' THEN multiplier := 3;
  ELSIF match_row.stage IN ('LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE') THEN multiplier := 2;
  ELSE multiplier := 1;
  END IF;

  -- Loop through every pick for this match
  FOR pick_row IN SELECT * FROM picks WHERE match_id = match_id_input LOOP
    predicted_result := get_result(pick_row.pick_home, pick_row.pick_away);

    -- Calculate base points (score-based)
    IF pick_row.pick_home = match_row.home_score AND
       pick_row.pick_away = match_row.away_score THEN
      base_points := 5;
    ELSIF predicted_result = actual_result THEN
      base_points := 2;
    ELSE
      base_points := 0;
    END IF;

    -- Calculate advancement bonus (knockout matches only)
    bonus_points := 0;
    IF match_row.stage != 'GROUP_STAGE' THEN
      -- Determine the user's predicted advancer
      IF pick_row.pick_home > pick_row.pick_away THEN
        predicted_advancer := 'HOME_TEAM';
      ELSIF pick_row.pick_away > pick_row.pick_home THEN
        predicted_advancer := 'AWAY_TEAM';
      ELSE
        -- Draw pick: use the explicit pick_winner field (may be NULL)
        predicted_advancer := pick_row.pick_winner;
      END IF;

      -- Award the bonus if their advancer matches the actual winner
      IF predicted_advancer IS NOT NULL
         AND predicted_advancer = match_row.winner THEN
        bonus_points := 1;
      END IF;
    END IF;

    -- Update the pick with total points
    UPDATE picks
    SET points_earned = (base_points + bonus_points) * multiplier
    WHERE id = pick_row.id;
  END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. Composite read function
-- -----------------------------------------------------------------------------

-- get_user_wrapped_stats: single JSONB blob powering the WrappedModal.
-- Called once per modal open. All rank calculations must stay in sync with
-- get_leaderboard_page and get_leaderboard_neighborhood.
--
-- Returns null fields for missing data (no picks, no final pick, etc.) - the
-- frontend uses null-checks to conditionally render each panel.
--
-- Note: final_match_id is hardcoded to 537390 (WC2026 final). Update this
-- constant for the next tournament.
CREATE OR REPLACE FUNCTION public.get_user_wrapped_stats(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  final_match_id constant integer := 537390;
BEGIN
  WITH
  -- Profile info for panel 1
  profile_data AS (
    SELECT display_name, avatar_url
    FROM profiles
    WHERE id = user_uuid
  ),

  -- Leaderboard row for this user (panels 2, 3)
  user_lb AS (
    SELECT
      total_points,
      exact_scores,
      correct_results,
      accuracy_pct
    FROM leaderboard
    WHERE user_id = user_uuid
  ),

  -- Rank matches the global leaderboard's ORDER BY exactly.
  -- If you ever change the leaderboard tiebreaker chain, change it here too.
  ranked_users AS (
    SELECT
      l.user_id,
      ROW_NUMBER() OVER (
        ORDER BY
          l.total_points        DESC,
          l.exact_scores        DESC,
          l.correct_results     DESC,
          l.best_single_match   DESC,
          l.current_streak      DESC,
          l.accuracy_pct        DESC,
          p.display_name        ASC
      ) AS rn
    FROM leaderboard l
    JOIN profiles p ON p.id = l.user_id
  ),
  rank_data AS (
    SELECT
      (SELECT COUNT(*) FROM leaderboard) AS total_users,
      (SELECT rn FROM ranked_users WHERE user_id = user_uuid) AS final_rank
  ),

  -- All scored picks for this user, joined with match info (panels 4 and 5)
  scored_picks AS (
    SELECT
      p.id AS pick_id,
      p.match_id,
      p.pick_home,
      p.pick_away,
      m.home_score,
      m.away_score,
      m.winner,
      m.stage,
      m.kickoff_utc,
      m.home_team_id,
      m.away_team_id,
      (
        CASE
          WHEN p.pick_home = m.home_score AND p.pick_away = m.away_score THEN 5
          WHEN get_result(p.pick_home, p.pick_away) = get_result(m.home_score, m.away_score) THEN 2
          ELSE 0
        END +
        CASE
          WHEN m.stage <> 'GROUP_STAGE' AND m.winner IS NOT NULL AND
            CASE
              WHEN p.pick_home > p.pick_away THEN 'HOME_TEAM'
              WHEN p.pick_away > p.pick_home THEN 'AWAY_TEAM'
              ELSE p.pick_winner
            END = m.winner THEN 1
          ELSE 0
        END
      ) *
      CASE
        WHEN m.stage = 'FINAL' THEN 3
        WHEN m.stage IN ('LAST_32','LAST_16','QUARTER_FINALS','SEMI_FINALS','THIRD_PLACE') THEN 2
        ELSE 1
      END AS points,
      get_result(p.pick_home, p.pick_away) = get_result(m.home_score, m.away_score) AS is_correct
    FROM picks p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = user_uuid
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  ),

  best_match AS (
    SELECT
      sp.points,
      sp.match_id,
      sp.pick_home,
      sp.pick_away,
      sp.home_score,
      sp.away_score,
      sp.stage,
      ht.name AS home_team_name,
      ht.flag_url AS home_flag,
      at.name AS away_team_name,
      at.flag_url AS away_flag
    FROM scored_picks sp
    JOIN teams ht ON ht.id = sp.home_team_id
    JOIN teams at ON at.id = sp.away_team_id
    WHERE sp.points > 0
    ORDER BY sp.points DESC, sp.kickoff_utc ASC
    LIMIT 1
  ),

  -- Longest streak using the islands pattern (rn_all - rn_by_correct = grp)
  ordered_picks AS (
    SELECT
      pick_id,
      match_id,
      kickoff_utc,
      is_correct,
      ROW_NUMBER() OVER (ORDER BY kickoff_utc) AS rn_all,
      ROW_NUMBER() OVER (PARTITION BY is_correct ORDER BY kickoff_utc) AS rn_by_correct
    FROM scored_picks
  ),
  streak_groups AS (
    SELECT
      pick_id,
      match_id,
      kickoff_utc,
      is_correct,
      rn_all - rn_by_correct AS grp
    FROM ordered_picks
    WHERE is_correct
  ),
  longest_streak_data AS (
    SELECT
      COUNT(*) AS streak_length,
      MIN(match_id) AS start_match_id,
      MAX(match_id) AS end_match_id,
      MIN(kickoff_utc) AS start_kickoff,
      MAX(kickoff_utc) AS end_kickoff
    FROM streak_groups
    GROUP BY grp
    ORDER BY COUNT(*) DESC, MIN(kickoff_utc) ASC
    LIMIT 1
  ),
  streak_enriched AS (
    SELECT
      ls.streak_length,
      ls.start_match_id,
      ls.end_match_id,
      (SELECT ht.name || ' vs ' || at.name
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.id = ls.start_match_id) AS start_match_label,
      (SELECT ht.name || ' vs ' || at.name
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.id = ls.end_match_id) AS end_match_label
    FROM longest_streak_data ls
  ),

  -- Panel 6: their final pick and outcome
  final_pick AS (
    SELECT
      p.pick_home,
      p.pick_away,
      p.pick_winner,
      m.home_score AS actual_home,
      m.away_score AS actual_away,
      m.winner AS actual_winner,
      ht.name AS home_team_name,
      ht.flag_url AS home_flag,
      at.name AS away_team_name,
      at.flag_url AS away_flag,
      CASE
        WHEN p.pick_home > p.pick_away THEN ht.name
        WHEN p.pick_away > p.pick_home THEN at.name
        WHEN p.pick_winner = 'HOME_TEAM' THEN ht.name
        WHEN p.pick_winner = 'AWAY_TEAM' THEN at.name
        ELSE NULL
      END AS predicted_winner_name,
      CASE
        WHEN m.winner IS NULL THEN NULL
        WHEN p.pick_home > p.pick_away AND m.winner = 'HOME_TEAM' THEN true
        WHEN p.pick_away > p.pick_home AND m.winner = 'AWAY_TEAM' THEN true
        WHEN p.pick_home = p.pick_away AND p.pick_winner = m.winner THEN true
        ELSE false
      END AS predicted_correctly
    FROM picks p
    JOIN matches m ON m.id = p.match_id
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE p.user_id = user_uuid
      AND p.match_id = final_match_id
  )

  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(profile_data.*) FROM profile_data),
    'rank', jsonb_build_object(
      'final_rank', (SELECT final_rank FROM rank_data),
      'total_users', (SELECT total_users FROM rank_data)
    ),
    'stats', (SELECT to_jsonb(user_lb.*) FROM user_lb),
    'best_match', (SELECT to_jsonb(best_match.*) FROM best_match),
    'longest_streak', (SELECT to_jsonb(streak_enriched.*) FROM streak_enriched),
    'final_pick', (SELECT to_jsonb(final_pick.*) FROM final_pick)
  )
  INTO result;

  RETURN result;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. Trigger functions
-- -----------------------------------------------------------------------------

-- handle_new_user: fires on INSERT into auth.users, creates matching row in
-- public.profiles. Pulls display name and avatar from Google OAuth metadata.
--
-- The trigger itself (CREATE TRIGGER ... ON auth.users) lives in 07_triggers.sql
-- because it's on the auth schema which is Supabase-managed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        avatar_url = new.raw_user_meta_data->>'avatar_url';
  RETURN new;
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. Deprecated
-- -----------------------------------------------------------------------------

-- DEPRECATED: refresh_leaderboard
--
-- This function was the original way to keep the leaderboard up to date -
-- it INSERTed into a `leaderboard` table with ON CONFLICT DO UPDATE. During
-- the tournament we migrated `leaderboard` from a table to a live-computed
-- view (see 04_views.sql). Running this function against the current schema
-- will error, because you cannot INSERT into a view.
--
-- Kept here for archive fidelity and reference. Drop it in the tech debt
-- cleanup sprint. Do NOT re-run this on a rebuilt DB.
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
AS $$
BEGIN
  WITH finished_picks AS (
    SELECT
      p.user_id,
      p.points_earned,
      ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY m.kickoff_utc DESC) AS rn
    FROM picks p
    JOIN matches m ON m.id = p.match_id
    WHERE p.points_earned IS NOT NULL
  ),
  base_stats AS (
    SELECT
      user_id,
      COALESCE(SUM(points_earned), 0)                                       AS total_points,
      -- Old filter (= 5) missed knockout exact scores (10 pts, 15 pts).
      -- Kept the modulo fix here for historical accuracy.
      COUNT(*) FILTER (WHERE points_earned % 5 = 0 AND points_earned > 0)  AS exact_scores,
      COUNT(*) FILTER (WHERE points_earned >= 2)                            AS correct_results,
      COUNT(*)                                                              AS total_finished,
      COALESCE(MAX(points_earned), 0)                                       AS best_single_match
    FROM finished_picks
    GROUP BY user_id
  ),
  first_wrong AS (
    SELECT user_id, MIN(rn) AS first_wrong_rn
    FROM finished_picks
    WHERE points_earned = 0
    GROUP BY user_id
  ),
  max_rn AS (
    SELECT user_id, MAX(rn) AS total_rn
    FROM finished_picks
    GROUP BY user_id
  ),
  streak_stats AS (
    SELECT
      m.user_id,
      COALESCE(fw.first_wrong_rn - 1, m.total_rn) AS current_streak
    FROM max_rn m
    LEFT JOIN first_wrong fw ON fw.user_id = m.user_id
  ),
  form_stats AS (
    SELECT
      user_id,
      STRING_AGG(
        CASE WHEN points_earned >= 2 THEN 'W' ELSE 'L' END,
        '' ORDER BY rn DESC
      ) AS last_5_form
    FROM finished_picks
    WHERE rn <= 5
    GROUP BY user_id
  )
  INSERT INTO leaderboard (
    user_id, total_points, exact_scores, correct_results,
    current_streak, accuracy_pct, last_5_form, best_single_match
  )
  SELECT
    b.user_id,
    b.total_points,
    b.exact_scores,
    b.correct_results,
    COALESCE(s.current_streak, 0),
    CASE WHEN b.total_finished > 0
      THEN ROUND(b.correct_results::NUMERIC / b.total_finished * 100, 1)
      ELSE 0 END,
    COALESCE(f.last_5_form, ''),
    b.best_single_match
  FROM base_stats b
  LEFT JOIN streak_stats s ON s.user_id = b.user_id
  LEFT JOIN form_stats f   ON f.user_id = b.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    total_points      = EXCLUDED.total_points,
    exact_scores      = EXCLUDED.exact_scores,
    correct_results   = EXCLUDED.correct_results,
    current_streak    = EXCLUDED.current_streak,
    accuracy_pct      = EXCLUDED.accuracy_pct,
    last_5_form       = EXCLUDED.last_5_form,
    best_single_match = EXCLUDED.best_single_match;
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. Supabase-managed
-- -----------------------------------------------------------------------------

-- rls_auto_enable: event trigger function that automatically enables RLS on
-- any newly-created table in the public schema. Supabase installs this in
-- every project by default. Kept here for archive completeness.
--
-- Do NOT recreate this on a new Supabase project - it will already exist.
-- Included here so a future you does not wonder where it came from.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;