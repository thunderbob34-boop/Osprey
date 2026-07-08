-- 033_fix_social_rpc_idor.sql
-- Security fix (2026-07-08 audit): get_my_friends, get_friends_at_race, and
-- get_pending_friend_requests trusted a client-supplied p_user_id instead of
-- the caller's own identity, and get_race_partners had no ownership check at
-- all. Because all four are SECURITY DEFINER and exposed as PostgREST RPCs,
-- any authenticated user could pass an arbitrary UUID and read another
-- user's friend list, pending friend requests, or a race's training
-- partners. get_challenge_leaderboard already guards on auth.uid() — these
-- four copied its SECURITY DEFINER shape without the guard.
--
-- Parameters are kept in the same positions/names so existing client calls
-- (which always pass the caller's own id anyway) keep working unchanged;
-- the fix is entirely inside each function body.

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

-- get_race_partners had no p_user_id to begin with — add an explicit
-- ownership check against race_events instead (same predicate the table's
-- own race_partners_owner RLS policy uses).
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
    AND rp.race_id IN (
      SELECT id FROM race_events WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  ORDER BY u.display_name;
$$;

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
