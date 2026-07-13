-- 20260713000001_fix_social_rpc_idor_and_consent.sql
--
-- Codifies fixes for a friend/race-partner IDOR and a challenge_members RLS
-- recursion bug that were already hotfixed directly against production by
-- earlier automated audit sessions but never landed in a committed
-- migration — git's copies of 20260701000013_friend_race_sync.sql,
-- 20260701000014_challenges.sql, and 20260708000029_friend_requests.sql
-- still define the vulnerable/broken versions, so a fresh install (staging,
-- disaster recovery) would silently resurrect all three bugs. Also fixes
-- two related holes confirmed still live in production: a friendship
-- self-accept consent bypass, and a challenge-roster leak to non-members
-- in get_challenge_leaderboard.
--
-- The get_my_friends / get_friends_at_race / get_race_partners /
-- get_pending_friend_requests / is_challenge_member / get_activity_feed
-- rewrites below are idempotent (CREATE OR REPLACE / DROP POLICY IF EXISTS
-- + CREATE POLICY) and were verified against production's actual current
-- definitions before writing this file — applying them is a no-op there.
-- The friendships_update and get_challenge_leaderboard changes are real,
-- previously-unapplied fixes.

-- ── Friend-graph RPCs: derive identity from auth.uid(), not a caller-
-- supplied p_user_id. Signatures keep the unused p_user_id parameter so
-- existing client call sites don't need updating.
CREATE OR REPLACE FUNCTION get_my_friends(p_user_id UUID)
RETURNS TABLE(
  friend_user_id      UUID,
  friend_display_name TEXT
)
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
      WHERE re.id = p_race_id AND re.user_id = auth.uid()
    )
  ORDER BY u.display_name;
$$;

CREATE OR REPLACE FUNCTION get_pending_friend_requests(p_user_id UUID)
RETURNS TABLE(
  friendship_id           UUID,
  requester_user_id       UUID,
  requester_display_name  TEXT,
  created_at              TIMESTAMPTZ
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

GRANT EXECUTE ON FUNCTION get_my_friends TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_at_race TO authenticated;
GRANT EXECUTE ON FUNCTION get_race_partners TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_friend_requests TO authenticated;

-- ── challenge_members RLS recursion: a self-referential policy on
-- challenge_members (checking membership by querying challenge_members
-- itself) raises Postgres 42P17 on every read. is_challenge_member() is
-- SECURITY DEFINER, so it bypasses RLS internally and breaks the cycle.
CREATE OR REPLACE FUNCTION is_challenge_member(p_challenge_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenge_members
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION is_challenge_member TO authenticated;

DROP POLICY IF EXISTS challenge_members_read ON challenge_members;
CREATE POLICY challenge_members_read ON challenge_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_challenge_member(challenge_id, auth.uid())
  );

-- ── Activity feed: the client already calls get_activity_feed(), which
-- never had a corresponding migration file in git.
CREATE OR REPLACE FUNCTION get_activity_feed(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  share_id            UUID,
  workout_id          UUID,
  user_id             UUID,
  display_name        TEXT,
  caption             TEXT,
  session_type        TEXT,
  total_duration_s    INTEGER,
  total_distance_km   NUMERIC,
  share_created_at    TIMESTAMPTZ,
  kudo_count          BIGINT,
  user_gave_kudo      BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id AS share_id,
    a.workout_id,
    a.user_id,
    u.display_name,
    a.caption,
    wl.session_type::text,
    wl.total_duration_s,
    wl.total_distance_km,
    a.created_at AS share_created_at,
    (SELECT count(*) FROM kudos k WHERE k.share_id = a.id) AS kudo_count,
    EXISTS (SELECT 1 FROM kudos k2 WHERE k2.share_id = a.id AND k2.from_user = auth.uid()) AS user_gave_kudo
  FROM activity_shares a
  JOIN users u ON u.id = a.user_id
  JOIN workout_logs wl ON wl.id = a.workout_id
  WHERE a.deleted_at IS NULL
    AND wl.deleted_at IS NULL
    AND u.deleted_at IS NULL
    AND (
      a.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = a.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = a.user_id))
      )
    )
  ORDER BY a.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;

-- ── Real fix #1: friendship self-accept consent bypass. Previously either
-- party could flip a friendship's status to 'accepted', letting a requester
-- unilaterally accept their own pending request with no consent from the
-- addressee. Only the addressee may transition a row to 'accepted'; both
-- parties keep every other update they already had (e.g. either side can
-- still set status to 'blocked').
DROP POLICY IF EXISTS friendships_update ON friendships;
CREATE POLICY friendships_update ON friendships
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid())
  WITH CHECK (
    (requester_id = auth.uid() OR addressee_id = auth.uid())
    AND (status != 'accepted' OR addressee_id = auth.uid())
  );

-- ── Real fix #2: get_challenge_leaderboard roster leak. The `members` CTE
-- read directly from challenge_members with no access check, so any caller
-- — member or not — got back every member's user_id and display_name (with
-- zeroed-out scores, since the score join used challenge_info's dates,
-- which are NULL for an unauthorized caller whose challenge_info row was
-- filtered out). Cross-joining challenge_info (which already gates on
-- membership/ownership) into members means an unauthorized caller now gets
-- zero rows instead of a blanked-score roster.
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

GRANT EXECUTE ON FUNCTION get_challenge_leaderboard TO authenticated;
