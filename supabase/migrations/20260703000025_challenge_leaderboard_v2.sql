-- 025_challenge_leaderboard_v2.sql
-- Extends get_challenge_leaderboard (014_challenges.sql) with two new
-- challenge types:
--   lift_volume — total lbs moved (sets.weight_kg * reps) on lift days.
--   streak      — longest run of consecutive active-training days within
--                 the challenge window (gaps-and-islands via ROW_NUMBER).
--
-- Both are computed in their own CTEs rather than folded into the existing
-- `scores` aggregate, because joining exercise_sets directly onto that
-- aggregate would fan out one row per set and silently corrupt the
-- mileage/workouts/duration counts for every OTHER challenge type.

CREATE OR REPLACE FUNCTION get_challenge_leaderboard(p_challenge_id UUID)
RETURNS TABLE(
  user_id       UUID,
  display_name  TEXT,
  value         NUMERIC,
  rank          BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  WITH challenge_info AS (
    SELECT c.type, c.starts_on, c.ends_on
    FROM challenges c
    WHERE c.id = p_challenge_id
      AND c.deleted_at IS NULL
      -- Security: only return data if caller is a member or creator
      AND (
        c.creator_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM challenge_members
          WHERE challenge_id = p_challenge_id AND user_id = auth.uid()
        )
      )
  ),
  members AS (
    SELECT cm.user_id, u.display_name
    FROM challenge_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.challenge_id = p_challenge_id
  ),
  lift_volumes AS (
    SELECT wl.user_id, SUM(es.weight_kg * es.reps) / 0.453592 AS volume_lbs
    FROM workout_logs wl
    JOIN exercise_sets es ON es.workout_id = wl.id
    JOIN challenge_info ci ON TRUE
    WHERE wl.session_type = 'lift'
      AND wl.started_at::DATE >= ci.starts_on
      AND wl.started_at::DATE <= ci.ends_on
      AND wl.status IN ('completed', 'partial')
      AND wl.deleted_at IS NULL
    GROUP BY wl.user_id
  ),
  active_days AS (
    SELECT DISTINCT wl.user_id, wl.started_at::DATE AS active_on
    FROM workout_logs wl
    JOIN challenge_info ci ON TRUE
    WHERE wl.started_at::DATE >= ci.starts_on
      AND wl.started_at::DATE <= ci.ends_on
      AND wl.status IN ('completed', 'partial')
      AND wl.deleted_at IS NULL
  ),
  streak_groups AS (
    SELECT
      user_id,
      active_on,
      active_on - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY active_on))::INT AS island
    FROM active_days
  ),
  streaks AS (
    SELECT user_id, COUNT(*) AS streak_len
    FROM streak_groups
    GROUP BY user_id, island
  ),
  best_streaks AS (
    SELECT user_id, MAX(streak_len) AS best_streak
    FROM streaks
    GROUP BY user_id
  ),
  scores AS (
    SELECT
      m.user_id,
      m.display_name,
      CASE (SELECT type FROM challenge_info)
        WHEN 'mileage'  THEN COALESCE(
          SUM(wl.total_distance_km) FILTER (WHERE wl.total_distance_km IS NOT NULL) / 1.609344,
          0
        )
        WHEN 'workouts' THEN COALESCE(COUNT(wl.id)::NUMERIC, 0)
        WHEN 'duration' THEN COALESCE(
          SUM(wl.total_duration_s) FILTER (WHERE wl.total_duration_s IS NOT NULL) / 60.0,
          0
        )
        WHEN 'lift_volume' THEN COALESCE(
          (SELECT lv.volume_lbs FROM lift_volumes lv WHERE lv.user_id = m.user_id),
          0
        )
        WHEN 'streak' THEN COALESCE(
          (SELECT bs.best_streak FROM best_streaks bs WHERE bs.user_id = m.user_id),
          0
        )
        ELSE 0
      END AS value
    FROM members m
    LEFT JOIN workout_logs wl
      ON  wl.user_id    = m.user_id
      AND wl.started_at::DATE >= (SELECT starts_on FROM challenge_info)
      AND wl.started_at::DATE <= (SELECT ends_on   FROM challenge_info)
      AND wl.status IN ('completed', 'partial')
      AND wl.deleted_at IS NULL
    GROUP BY m.user_id, m.display_name
  )
  SELECT
    s.user_id,
    s.display_name,
    ROUND(s.value, 1) AS value,
    RANK() OVER (ORDER BY s.value DESC) AS rank
  FROM scores s
  ORDER BY rank, s.display_name;
$$;

GRANT EXECUTE ON FUNCTION get_challenge_leaderboard TO authenticated;
