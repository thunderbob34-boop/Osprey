-- 034_add_activity_feed_rpc.sql
-- Fixes the activity/social feed (2026-07-08 audit): the client
-- (src/services/activity.ts) has always called a `get_activity_feed` RPC
-- that was never shipped, so every call 404'd and silently fell back to a
-- direct query. That fallback is scoped by activity_shares_self /
-- kudos_self RLS, both `USING (user_id = auth.uid())` / `USING (from_user =
-- auth.uid())` — friend-only-by-design tables that in practice only ever
-- returned the caller's own shares and the caller's own kudos, so the feed
-- looked empty of friends and kudo counts were always 0 or 1.
--
-- This RPC is SECURITY DEFINER (same pattern as get_my_friends /
-- get_challenge_leaderboard) so it can join across users/kudos despite
-- their self-only RLS, but it only ever computes visibility from
-- auth.uid() — never from a client-supplied id — so it can't be used to
-- read another user's feed.

CREATE OR REPLACE FUNCTION get_activity_feed(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  share_id           UUID,
  workout_id         UUID,
  user_id            UUID,
  display_name       TEXT,
  caption            TEXT,
  session_type       TEXT,
  total_duration_s   INT,
  total_distance_km  NUMERIC,
  share_created_at   TIMESTAMPTZ,
  kudo_count         BIGINT,
  user_gave_kudo     BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  WITH visible_users AS (
    SELECT auth.uid() AS id
    UNION
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
  )
  SELECT
    s.id                    AS share_id,
    s.workout_id,
    s.user_id,
    u.display_name,
    s.caption,
    wl.session_type::TEXT   AS session_type,
    wl.total_duration_s,
    wl.total_distance_km,
    s.created_at            AS share_created_at,
    COUNT(k.id)             AS kudo_count,
    BOOL_OR(k.from_user = auth.uid()) AS user_gave_kudo
  FROM activity_shares s
  JOIN users u        ON u.id = s.user_id
  JOIN workout_logs wl ON wl.id = s.workout_id
  LEFT JOIN kudos k   ON k.share_id = s.id
  WHERE s.user_id IN (SELECT id FROM visible_users)
    AND s.deleted_at IS NULL
    AND u.deleted_at IS NULL
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption,
           wl.session_type, wl.total_duration_s, wl.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;
