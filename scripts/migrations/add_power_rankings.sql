-- Power Rankings Migration
-- Run this in the Supabase SQL editor

-- Step 1: Add new columns to leaderboard
ALTER TABLE leaderboard
  ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accuracy_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_5_form TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS best_single_match INT DEFAULT 0;

-- Step 2: Replace refresh_leaderboard() with Power Rankings version
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID AS $$
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
      -- Fix: old filter (= 5) missed knockout exact scores (10 pts, 15 pts)
      COUNT(*) FILTER (WHERE points_earned % 5 = 0 AND points_earned > 0)  AS exact_scores,
      COUNT(*) FILTER (WHERE points_earned >= 2)                            AS correct_results,
      COUNT(*)                                                               AS total_finished,
      COALESCE(MAX(points_earned), 0)                                       AS best_single_match
    FROM finished_picks
    GROUP BY user_id
  ),
  first_wrong AS (
    -- Smallest rn (= most recent) pick that was wrong
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
    -- streak = distance before first miss; if no miss then all picks are correct
    SELECT
      m.user_id,
      COALESCE(fw.first_wrong_rn - 1, m.total_rn) AS current_streak
    FROM max_rn m
    LEFT JOIN first_wrong fw ON fw.user_id = m.user_id
  ),
  form_stats AS (
    -- Last 5 results as a string, oldest → newest (e.g. "WWLWW")
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
$$ LANGUAGE plpgsql;

-- Step 3: Backfill all existing rows
SELECT refresh_leaderboard();
