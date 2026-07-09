-- 033_fix_friend_rpc_idor.sql
-- Fixes an IDOR: get_my_friends, get_friends_at_race, and
-- get_pending_friend_requests are SECURITY DEFINER and filtered on the
-- caller-supplied p_user_id parameter instead of auth.uid(), so any
-- authenticated user could pass an arbitrary user id and read that
-- person's friend list, incoming friend requests, or race schedule.
-- get_race_partners had no authorization check at all.
--
-- Fix: bind every lookup to auth.uid() server-side. The p_user_id
-- parameters are kept (unused) so existing client call sites that still
-- pass { p_user_id: userId } keep working without a client change.
--
-- Also fixes two friendships bugs found in the same audit pass:
--   1. friendships_update let the requester accept their own outgoing
--      request (no consent check) — only the addressee may transition a
--      row to 'accepted'.
--   2. Reciprocal pending requests (A->B and B->A both pending) could
--      both later be accepted, producing two 'accepted' rows for the
--      same pair and duplicate entries in get_my_friends. Insert now
--      blocks creating a new pending request in the reverse direction
--      of an existing one, and get_my_friends is deduped defensively.

CREATE OR REPLACE FUNCTION get_my_friends(p_user_id UUID)
RETURNS TABLE(friend_user_id UUID, friend_display_name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT
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
      WHERE re.id = p_race_id AND re.user_id = auth.uid() AND re.deleted_at IS NULL
    )
  ORDER BY u.display_name;
$$;

-- ── friendships_update: only the addressee may accept a request ────────────
DROP POLICY IF EXISTS friendships_update ON friendships;

CREATE POLICY friendships_update ON friendships
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid())
  WITH CHECK (
    (requester_id = auth.uid() OR addressee_id = auth.uid())
    AND (status != 'accepted' OR addressee_id = auth.uid())
  );

-- ── friendships_insert: block a duplicate reciprocal pending request ───────
DROP POLICY IF EXISTS friendships_insert ON friendships;

CREATE POLICY friendships_insert ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM friendships f2
      WHERE f2.requester_id = friendships.addressee_id
        AND f2.addressee_id = friendships.requester_id
        AND f2.status = 'pending'
    )
  );
