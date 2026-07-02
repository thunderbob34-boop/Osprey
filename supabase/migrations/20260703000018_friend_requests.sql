-- 018_friend_requests.sql
-- Friend-request RPCs — Crew Challenges feature.
-- The friendships table and its self-only RLS (requester_id/addressee_id =
-- auth.uid()) already existed and were already correct (004_fix_remaining_rls.sql).
-- What never existed was any way to actually find someone to friend: users
-- has self-only RLS, so a plain client query can't look up another user's
-- display name. These two SECURITY DEFINER RPCs are the same escape hatch
-- pattern already used by get_my_friends/get_friends_at_race.

-- ── RPC: find_user_by_email ───────────────────────────────────────────────────
-- Exact email match only (not a fuzzy/partial search) — a partial-match
-- search across all users would let anyone enumerate the user base by
-- display name. Requires knowing the exact email, like adding a contact by
-- their full handle elsewhere.

CREATE OR REPLACE FUNCTION find_user_by_email(p_email TEXT)
RETURNS TABLE(
  user_id           UUID,
  display_name      TEXT,
  friendship_status TEXT  -- 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked'
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id AS user_id,
    u.display_name,
    CASE
      WHEN f.status = 'accepted' THEN 'accepted'
      WHEN f.status = 'pending' AND f.requester_id = auth.uid() THEN 'pending_sent'
      WHEN f.status = 'pending' AND f.addressee_id = auth.uid() THEN 'pending_received'
      WHEN f.status = 'blocked' THEN 'blocked'
      ELSE 'none'
    END AS friendship_status
  FROM users u
  LEFT JOIN friendships f
    ON (f.requester_id = auth.uid() AND f.addressee_id = u.id)
    OR (f.addressee_id = auth.uid() AND f.requester_id = u.id)
  WHERE LOWER(u.email) = LOWER(p_email)
    AND u.deleted_at IS NULL
    AND u.id != auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email TO authenticated;

-- ── RPC: get_pending_friend_requests ──────────────────────────────────────────
-- Both directions in one call — the Friends screen needs to show "requests
-- you received" (with Accept/Decline) and "requests you sent" (pending) as
-- two separate lists.

CREATE OR REPLACE FUNCTION get_pending_friend_requests()
RETURNS TABLE(
  friendship_id      UUID,
  other_user_id      UUID,
  other_display_name TEXT,
  direction          TEXT, -- 'incoming' | 'outgoing'
  created_at         TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id AS friendship_id,
    u.id AS other_user_id,
    u.display_name AS other_display_name,
    CASE WHEN f.addressee_id = auth.uid() THEN 'incoming' ELSE 'outgoing' END AS direction,
    f.created_at
  FROM friendships f
  JOIN users u ON u.id = CASE
    WHEN f.requester_id = auth.uid() THEN f.addressee_id
    ELSE f.requester_id
  END
  WHERE f.status = 'pending'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
  ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_pending_friend_requests TO authenticated;
