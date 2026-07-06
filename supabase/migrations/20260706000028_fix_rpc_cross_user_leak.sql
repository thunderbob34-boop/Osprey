-- 028_fix_rpc_cross_user_leak.sql
-- get_my_friends, get_friends_at_race, and get_race_partners are all
-- SECURITY DEFINER (needed to join across the self-only-RLS `users` table),
-- but none of them verified the caller was actually asking about themselves.
-- Any authenticated user could pass an arbitrary p_user_id/p_race_id and read
-- another user's friend list, race calendar, or training partners.
-- Fix: constrain each function to the calling user's own auth.uid().

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
  WHERE p_user_id = auth.uid()
    AND f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
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
    WHEN f.requester_id = p_user_id THEN f.addressee_id
    ELSE f.requester_id
  END
  JOIN race_events re
    ON  re.user_id    = u.id
    AND re.event_date = p_event_date
    AND re.deleted_at IS NULL
  WHERE p_user_id = auth.uid()
    AND f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
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
