-- 033_fix_friend_rpc_idor.sql
-- Nightly audit (2026-07-10) finding: get_my_friends, get_friends_at_race, and
-- get_pending_friend_requests are SECURITY DEFINER and filtered on a
-- caller-supplied p_user_id instead of auth.uid(). Any authenticated user
-- could pass an arbitrary user's UUID (readily available from
-- search_user_by_email / get_challenge_leaderboard / this RPC's own output)
-- and read that user's full friend list and incoming friend requests —
-- a social-graph enumeration / IDOR. search_user_by_email already gets this
-- right (keys off auth.uid()); bring these three in line.
--
-- get_race_partners has a related, lower-severity gap: it returns partner
-- names for any race_id with no check the caller owns that race. Add one.

-- ── get_my_friends: drop the p_user_id param, key off auth.uid() ──────────
DROP FUNCTION IF EXISTS get_my_friends(UUID);

CREATE FUNCTION get_my_friends()
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

-- ── get_friends_at_race: same fix, keep p_event_date ───────────────────────
DROP FUNCTION IF EXISTS get_friends_at_race(UUID, DATE);

CREATE FUNCTION get_friends_at_race(p_event_date DATE)
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

-- ── get_pending_friend_requests: same fix ──────────────────────────────────
DROP FUNCTION IF EXISTS get_pending_friend_requests(UUID);

CREATE FUNCTION get_pending_friend_requests()
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

GRANT EXECUTE ON FUNCTION get_pending_friend_requests() TO authenticated;

-- ── get_race_partners: require the caller to own the race ─────────────────
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

GRANT EXECUTE ON FUNCTION get_race_partners(UUID) TO authenticated;
