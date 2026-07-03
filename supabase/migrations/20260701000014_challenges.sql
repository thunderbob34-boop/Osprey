-- 014_challenges.sql
-- Group challenges / leagues — Task 10.
-- Monthly mileage, workout count, or duration competitions between friends.

-- ── Types ─────────────────────────────────────────────────────────────────────

CREATE TYPE challenge_type_enum AS ENUM ('mileage', 'workouts', 'duration');

-- ── challenges ────────────────────────────────────────────────────────────────

CREATE TABLE challenges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             challenge_type_enum NOT NULL DEFAULT 'mileage',
  starts_on        DATE NOT NULL,
  ends_on          DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CHECK (ends_on >= starts_on)
);

CREATE INDEX idx_challenges_creator ON challenges(creator_user_id) WHERE deleted_at IS NULL;

-- ── challenge_members ─────────────────────────────────────────────────────────

CREATE TABLE challenge_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX idx_challenge_members_challenge ON challenge_members(challenge_id);
CREATE INDEX idx_challenge_members_user      ON challenge_members(user_id);

-- ── RLS & Policies ────────────────────────────────────────────────────────────

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON challenges TO authenticated;
GRANT ALL ON challenges TO service_role;

-- Members (and creator) can read; only creator can write.
CREATE POLICY challenges_read ON challenges
  FOR SELECT TO authenticated
  USING (
    creator_user_id = auth.uid()
    OR id IN (SELECT challenge_id FROM challenge_members WHERE user_id = auth.uid())
  );

CREATE POLICY challenges_insert ON challenges
  FOR INSERT TO authenticated
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY challenges_update ON challenges
  FOR UPDATE TO authenticated
  USING (creator_user_id = auth.uid())
  WITH CHECK (creator_user_id = auth.uid());

ALTER TABLE challenge_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON challenge_members TO authenticated;
GRANT ALL ON challenge_members TO service_role;

-- Members of a challenge can see all members of that same challenge.
CREATE POLICY challenge_members_read ON challenge_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR challenge_id IN (
      SELECT challenge_id FROM challenge_members WHERE user_id = auth.uid()
    )
  );

-- Creator can add any member; anyone can add themselves.
CREATE POLICY challenge_members_insert ON challenge_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR challenge_id IN (
      SELECT id FROM challenges WHERE creator_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Members can remove themselves; creator can remove anyone from their challenge.
CREATE POLICY challenge_members_delete ON challenge_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR challenge_id IN (
      SELECT id FROM challenges WHERE creator_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- ── RPC: get_my_friends ───────────────────────────────────────────────────────
-- Returns all accepted friends with display names.
-- SECURITY DEFINER because users.display_name has a self-only RLS policy.

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
    WHEN f.requester_id = p_user_id THEN f.addressee_id
    ELSE f.requester_id
  END
  WHERE f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
    AND u.deleted_at IS NULL
  ORDER BY u.display_name;
$$;

GRANT EXECUTE ON FUNCTION get_my_friends TO authenticated;

-- ── RPC: get_challenge_leaderboard ────────────────────────────────────────────
-- Aggregates workout_logs across all members for the challenge date window.
-- SECURITY DEFINER to join across users + workout_logs (both self-only RLS).
-- Caller must be a member or creator; otherwise returns empty result set.

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
