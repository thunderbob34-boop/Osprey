-- 034_search_users_by_email.sql
-- Adds the missing piece needed to actually create friendships: a way to look
-- up another user by email so the caller can send them a friend request, plus
-- a joined view of the caller's pending incoming/outgoing friend requests.
-- Both are SECURITY DEFINER because `users` has self-only RLS for reading
-- other users' rows (mirrors the get_my_friends pattern in 014_challenges.sql,
-- hardened by 028_fix_rpc_cross_user_leak.sql).

-- ── RPC: search_user_by_email ─────────────────────────────────────────────────
-- Exact (not fuzzy/partial), case-insensitive match on users.email.
-- Deliberately exact-match only — this is an anti-enumeration choice; do not
-- widen this to a prefix/fuzzy search across the whole users table.
-- Excludes the caller's own row and soft-deleted rows. Returns at most one row.
-- Requires an authenticated caller; unauthenticated callers get an empty set.

CREATE OR REPLACE FUNCTION search_user_by_email(p_email TEXT)
RETURNS TABLE(id UUID, display_name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id,
    u.display_name
  FROM users u
  WHERE auth.uid() IS NOT NULL
    AND u.deleted_at IS NULL
    AND u.id != auth.uid()
    AND lower(u.email) = lower(p_email)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION search_user_by_email TO authenticated;

-- ── RPC: get_pending_friend_requests ──────────────────────────────────────────
-- Returns the caller's pending friend requests, both incoming (someone else
-- requested the caller) and outgoing (the caller requested someone else),
-- joined to `users` for display names. Constrained to p_user_id = auth.uid()
-- to match the pattern established in 028_fix_rpc_cross_user_leak.sql.

CREATE OR REPLACE FUNCTION get_pending_friend_requests(p_user_id UUID)
RETURNS TABLE(
  request_id     UUID,
  direction      TEXT,
  other_user_id  UUID,
  other_display_name TEXT,
  created_at     TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id                AS request_id,
    'incoming'           AS direction,
    u.id                 AS other_user_id,
    u.display_name       AS other_display_name,
    f.created_at
  FROM friendships f
  JOIN users u ON u.id = f.requester_id
  WHERE p_user_id = auth.uid()
    AND f.status = 'pending'
    AND f.addressee_id = p_user_id
    AND u.deleted_at IS NULL

  UNION ALL

  SELECT
    f.id                AS request_id,
    'outgoing'           AS direction,
    u.id                 AS other_user_id,
    u.display_name       AS other_display_name,
    f.created_at
  FROM friendships f
  JOIN users u ON u.id = f.addressee_id
  WHERE p_user_id = auth.uid()
    AND f.status = 'pending'
    AND f.requester_id = p_user_id
    AND u.deleted_at IS NULL

  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_pending_friend_requests TO authenticated;
