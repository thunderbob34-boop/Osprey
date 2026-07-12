-- 033_fix_social_idor_and_consent.sql
-- Nightly audit — two real security gaps in the friend/challenge social graph:
--
-- 1. friendships_update (004) allowed the REQUESTER to flip their own pending
--    request straight to 'accepted' with no addressee consent. The only
--    client-side UPDATE on this table is acceptFriendRequest() (friends.ts),
--    which is only ever called by the addressee accepting an incoming
--    request — cancel/decline both go through DELETE, which already
--    correctly allows either party. So the UPDATE policy only needs to
--    allow the addressee; tightening it doesn't change any legitimate flow.
--
-- 2. Four SECURITY DEFINER RPCs (needed because `users` RLS is self-only)
--    trusted a caller-supplied user id instead of auth.uid(), or had no
--    ownership check at all, letting any authenticated caller pass an
--    arbitrary UUID and read someone else's friend list / pending requests /
--    race partners. All four are re-created with the same signature (no
--    client changes needed) but now source identity from auth.uid().
--
-- Also closes a related leak in get_challenge_leaderboard (025): the
-- `members` CTE returned the full roster for non-members even though
-- `challenge_info` (and therefore every score) was already correctly gated.

-- ── 1. Friendship accept requires addressee consent ────────────────────────

DROP POLICY IF EXISTS friendships_update ON friendships;

CREATE POLICY friendships_update ON friendships
  FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid())
  WITH CHECK (addressee_id = auth.uid());

-- ── 2. get_my_friends: use auth.uid(), ignore caller-supplied id ───────────

CREATE OR REPLACE FUNCTION get_my_friends(p_user_id UUID)
RETURNS TABLE(friend_user_id UUID, friend_display_name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id              AS friend_user_id,
    u.display_name    AS friend_display_name
  FROM friendships f
  JOIN users u ON u.id = CASE
    WHEN f.requester_id = auth.uid() THEN f.addressee_id
    ELSE f.requester_id
  END
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND u.deleted_at IS NULL
  ORDER BY u.display_name;
$$;

-- get_pending_friend_requests: use auth.uid(), ignore caller-supplied id ───

CREATE OR REPLACE FUNCTION get_pending_friend_requests(p_user_id UUID)
RETURNS TABLE(
  friendship_id          UUID,
  requester_user_id      UUID,
  requester_display_name TEXT,
  created_at             TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id AS friendship_id,
    f.requester_id AS requester_user_id,
    u.display_name AS requester_display_name,
    f.created_at
  FROM friendships f
  JOIN users u ON u.id = f.requester_id
  WHERE f.addressee_id = auth.uid()
    AND f.status = 'pending'
    AND u.deleted_at IS NULL
  ORDER BY f.created_at DESC;
$$;

-- get_friends_at_race: use auth.uid(), ignore caller-supplied id ───────────

CREATE OR REPLACE FUNCTION get_friends_at_race(
  p_user_id    UUID,
  p_event_date DATE
)
RETURNS TABLE(
  friend_user_id       UUID,
  friend_display_name  TEXT,
  friend_race_id       UUID,
  friend_race_name     TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id              AS friend_user_id,
    u.display_name    AS friend_display_name,
    re.id             AS friend_race_id,
    re.name           AS friend_race_name
  FROM friendships f
  JOIN users u ON u.id = CASE
    WHEN f.requester_id = auth.uid() THEN f.addressee_id
    ELSE f.requester_id
  END
  JOIN race_events re
    ON  re.user_id    = u.id
    AND re.event_date = p_event_date
    AND re.deleted_at IS NULL
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND u.deleted_at IS NULL
  ORDER BY u.display_name;
$$;

-- get_race_partners: only the race owner may list its partners ────────────

CREATE OR REPLACE FUNCTION get_race_partners(p_race_id UUID)
RETURNS TABLE(
  partner_user_id       UUID,
  partner_display_name  TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    rp.partner_user_id,
    u.display_name AS partner_display_name
  FROM race_partners rp
  JOIN users u ON u.id = rp.partner_user_id
  WHERE rp.race_id = p_race_id
    AND EXISTS (
      SELECT 1 FROM race_events re
      WHERE re.id = p_race_id AND re.user_id = auth.uid() AND re.deleted_at IS NULL
    )
  ORDER BY u.display_name;
$$;

-- ── 3. get_challenge_leaderboard: don't leak the roster to non-members ─────
-- `members` must be gated the same way `challenge_info` already is, so a
-- non-member gets zero rows back instead of the full roster at value=0.

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
    JOIN challenge_info ci ON TRUE
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
