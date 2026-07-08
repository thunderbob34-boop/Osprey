-- 029_friend_requests.sql
-- Friendships already exist (table + RLS from 001/004) but there was no way
-- to actually find someone to friend, or to see incoming requests — every
-- friend-scoped feature (kudos, challenge invites, race partners) depended
-- on a friend list nothing could ever populate. These two RPCs are
-- SECURITY DEFINER because `users` RLS restricts reads to the caller's own
-- row (same pattern as get_my_friends / get_challenge_leaderboard).

-- ── RPC: search_user_by_email ─────────────────────────────────────────────
-- Exact, case-insensitive match only — this is "add a specific person you
-- already know the email of," not a public directory search.
CREATE OR REPLACE FUNCTION search_user_by_email(p_email TEXT)
RETURNS TABLE(
  user_id           UUID,
  display_name      TEXT,
  friendship_status TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id AS user_id,
    u.display_name,
    (
      SELECT f.status::text
      FROM friendships f
      WHERE (f.requester_id = auth.uid() AND f.addressee_id = u.id)
         OR (f.addressee_id = auth.uid() AND f.requester_id = u.id)
      LIMIT 1
    ) AS friendship_status
  FROM users u
  WHERE lower(u.email) = lower(p_email)
    AND u.deleted_at IS NULL
    AND u.id != auth.uid();
$$;

GRANT EXECUTE ON FUNCTION search_user_by_email TO authenticated;

-- ── RPC: get_pending_friend_requests ──────────────────────────────────────
-- Incoming requests (someone else added the caller) — the caller's own
-- outgoing requests don't need this since friendships_select already lets
-- them read rows where they're the requester.
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
  WHERE f.addressee_id = p_user_id
    AND f.status = 'pending'
    AND u.deleted_at IS NULL
  ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_pending_friend_requests TO authenticated;
