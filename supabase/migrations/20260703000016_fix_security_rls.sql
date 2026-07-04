-- 016_fix_security_rls.sql
-- Security audit fixes (see LAUNCH_CHECKLIST audit, 2026-07-04):
--
-- 1. friendships could be forged: friendships_insert never required
--    status='pending', and friendships_update let either party rewrite
--    requester_id/addressee_id while keeping the row "accepted" — letting
--    an attacker fabricate an accepted friendship with a victim who never
--    consented, then read the victim's races via get_friends_at_race.
-- 2. get_friends_at_race / get_my_friends took a caller-supplied p_user_id
--    instead of using auth.uid(), so any authenticated user could pass any
--    other user's UUID and read their friend graph / race schedule.
-- 3. get_race_partners had no authorization check at all.
-- 4. challenge_members_read subqueried challenge_members from within its
--    own USING clause, causing "infinite recursion detected in policy"
--    on any direct client read of challenge_members (and, transitively,
--    of challenges).
-- 5. get_challenge_leaderboard's `members` CTE wasn't gated by the same
--    membership check as `challenge_info`, so a non-member could still
--    read the full member roster (just with zeroed scores).

-- ── 1. Friendship forgery ───────────────────────────────────────────────────

-- Requests must be created as 'pending' — callers can no longer insert a
-- pre-accepted row.
DROP POLICY IF EXISTS friendships_insert ON friendships;
CREATE POLICY friendships_insert ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');

-- Prevent either party from reassigning requester_id/addressee_id on
-- update (RLS policies can't compare NEW to OLD directly, so this needs a
-- trigger). Without this, an addressee could keep addressee_id = self and
-- silently swap requester_id to any other user's UUID.
CREATE OR REPLACE FUNCTION prevent_friendship_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.requester_id <> OLD.requester_id OR NEW.addressee_id <> OLD.addressee_id THEN
    RAISE EXCEPTION 'Cannot change the parties of an existing friendship row';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_friendship_identity_change ON friendships;
CREATE TRIGGER trg_prevent_friendship_identity_change
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION prevent_friendship_identity_change();

-- ── 2. SECURITY DEFINER RPCs trusting a caller-supplied user id ────────────

DROP FUNCTION IF EXISTS get_friends_at_race(UUID, DATE);
CREATE OR REPLACE FUNCTION get_friends_at_race(p_event_date DATE)
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

GRANT EXECUTE ON FUNCTION get_friends_at_race(DATE) TO authenticated;

DROP FUNCTION IF EXISTS get_my_friends(UUID);
CREATE OR REPLACE FUNCTION get_my_friends()
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

GRANT EXECUTE ON FUNCTION get_my_friends() TO authenticated;

-- ── 3. get_race_partners had zero authorization ─────────────────────────────

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
    AND (
      EXISTS (
        SELECT 1 FROM race_events re
        WHERE re.id = p_race_id AND re.user_id = auth.uid() AND re.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM race_partners self_rp
        WHERE self_rp.race_id = p_race_id AND self_rp.partner_user_id = auth.uid()
      )
    )
  ORDER BY u.display_name;
$$;

-- ── 4. challenge_members RLS recursion ──────────────────────────────────────

-- SECURITY DEFINER helper so membership checks don't re-trigger the RLS
-- policy of the very table they're checking.
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

DROP POLICY IF EXISTS challenge_members_read ON challenge_members;
CREATE POLICY challenge_members_read ON challenge_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_challenge_member(challenge_id, auth.uid())
  );

DROP POLICY IF EXISTS challenges_read ON challenges;
CREATE POLICY challenges_read ON challenges
  FOR SELECT TO authenticated
  USING (
    creator_user_id = auth.uid()
    OR is_challenge_member(id, auth.uid())
  );

-- ── 5. get_challenge_leaderboard leaked the member roster to non-members ───

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
        OR is_challenge_member(p_challenge_id, auth.uid())
      )
  ),
  members AS (
    SELECT cm.user_id, u.display_name
    FROM challenge_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.challenge_id = p_challenge_id
      -- Only populate once the caller has passed the challenge_info gate above.
      AND EXISTS (SELECT 1 FROM challenge_info)
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

GRANT EXECUTE ON FUNCTION get_challenge_leaderboard(UUID) TO authenticated;
