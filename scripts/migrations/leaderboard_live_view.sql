-- Migration: Replace leaderboard table with a live view
-- Points, streaks, form, and accuracy are now computed dynamically
-- from current match scores — no manual refresh_leaderboard() call needed.
--
-- Run this in the Supabase SQL editor.
-- Safe to re-run: uses CREATE OR REPLACE / DROP IF EXISTS.

-- Step 1: Drop the old table (RLS policies drop with it)
-- The view replaces it entirely — refresh_leaderboard() becomes a no-op.
DROP TABLE IF EXISTS leaderboard CASCADE;

-- Step 2: Create the live view
CREATE OR REPLACE VIEW leaderboard
WITH (security_invoker = true)   -- respect RLS on picks / matches / profiles
AS
WITH
-- Compute live points for every pick where a score exists
scored_picks AS (
  SELECT
    p.user_id,
    p.id         AS pick_id,
    m.kickoff_utc,
    CASE
      -- Exact score
      WHEN p.pick_home = m.home_score
       AND p.pick_away = m.away_score
        THEN 5 * CASE
               WHEN m.stage = 'FINAL'                                               THEN 3
               WHEN m.stage IN ('LAST_32','LAST_16','QUARTER_FINALS','SEMI_FINALS') THEN 2
               ELSE 1 END
      -- Correct result
      WHEN get_result(p.pick_home, p.pick_away)
         = get_result(m.home_score, m.away_score)
        THEN 2 * CASE
               WHEN m.stage = 'FINAL'                                               THEN 3
               WHEN m.stage IN ('LAST_32','LAST_16','QUARTER_FINALS','SEMI_FINALS') THEN 2
               ELSE 1 END
      ELSE 0
    END                                                            AS points,
    (p.pick_home = m.home_score AND p.pick_away = m.away_score)   AS is_exact,
    get_result(p.pick_home, p.pick_away)
      = get_result(m.home_score, m.away_score)                    AS is_correct
  FROM picks p
  JOIN matches m ON m.id = p.match_id
  -- Only include matches where a score is available (in-progress or finished)
  WHERE m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL
),

-- Row-number each pick per user, most recent first (used for streak & form)
ranked_picks AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY kickoff_utc DESC) AS rn
  FROM scored_picks
),

-- Base aggregates
base_stats AS (
  SELECT
    user_id,
    COALESCE(SUM(points), 0)                                          AS total_points,
    COUNT(*) FILTER (WHERE points % 5 = 0 AND points > 0)            AS exact_scores,
    COUNT(*) FILTER (WHERE is_correct)                                AS correct_results,
    COUNT(*)                                                          AS total_finished,
    COALESCE(MAX(points), 0)                                          AS best_single_match
  FROM ranked_picks
  GROUP BY user_id
),

-- Current streak: consecutive correct picks from most recent backwards
first_wrong AS (
  SELECT user_id, MIN(rn) AS first_wrong_rn
  FROM ranked_picks
  WHERE points = 0
  GROUP BY user_id
),
max_rn AS (
  SELECT user_id, MAX(rn) AS total_rn
  FROM ranked_picks
  GROUP BY user_id
),
streak_stats AS (
  SELECT
    m.user_id,
    COALESCE(fw.first_wrong_rn - 1, m.total_rn) AS current_streak
  FROM max_rn m
  LEFT JOIN first_wrong fw ON fw.user_id = m.user_id
),

-- Last 5 form string, oldest → newest (e.g. "WLWWW")
form_stats AS (
  SELECT
    user_id,
    STRING_AGG(
      CASE WHEN is_correct THEN 'W' ELSE 'L' END,
      '' ORDER BY rn DESC
    ) AS last_5_form
  FROM ranked_picks
  WHERE rn <= 5
  GROUP BY user_id
)

SELECT
  b.user_id,
  b.total_points,
  b.exact_scores,
  b.correct_results,
  CASE
    WHEN b.total_finished > 0
    THEN ROUND(b.correct_results::NUMERIC / b.total_finished * 100, 1)
    ELSE 0
  END                                             AS accuracy_pct,
  COALESCE(s.current_streak, 0)                   AS current_streak,
  COALESCE(f.last_5_form, '')                     AS last_5_form,
  b.best_single_match
FROM base_stats b
LEFT JOIN streak_stats s ON s.user_id = b.user_id
LEFT JOIN form_stats   f ON f.user_id = b.user_id;

-- Step 3: Grant read access (equivalent to the old RLS policy)
GRANT SELECT ON leaderboard TO anon, authenticated;
