-- 031_add_activity_feed_rpc.sql
-- src/services/activity.ts has always called a get_activity_feed RPC that no
-- migration ever defined, and its "the RPC doesn't exist yet" fallback query
-- itself used invalid PostgREST alias syntax (`id as share_id` instead of
-- `share_id:id`) — so the activity feed has been broken on both paths.
-- This adds the RPC, following the same SECURITY DEFINER + friends-join
-- pattern already used by get_challenge_leaderboard / get_friends_at_race.

CREATE OR REPLACE FUNCTION get_activity_feed(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  share_id            UUID,
  workout_id          UUID,
  user_id             UUID,
  display_name        TEXT,
  caption             TEXT,
  session_type        TEXT,
  total_duration_s    INTEGER,
  total_distance_km   NUMERIC,
  share_created_at    TIMESTAMPTZ,
  kudo_count          BIGINT,
  user_gave_kudo      BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id                  AS share_id,
    s.workout_id,
    s.user_id,
    u.display_name,
    s.caption,
    wl.session_type::TEXT AS session_type,
    wl.total_duration_s,
    wl.total_distance_km,
    s.created_at          AS share_created_at,
    COUNT(k.id)                          AS kudo_count,
    BOOL_OR(k.from_user = p_user_id)     AS user_gave_kudo
  FROM activity_shares s
  JOIN users u        ON u.id = s.user_id
  JOIN workout_logs wl ON wl.id = s.workout_id
  LEFT JOIN kudos k ON k.share_id = s.id
  WHERE p_user_id = auth.uid()
    AND s.deleted_at IS NULL
    AND (
      s.user_id = p_user_id
      OR s.user_id IN (
        SELECT CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END
        FROM friendships f
        WHERE f.status = 'accepted' AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
      )
    )
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption, wl.session_type, wl.total_duration_s, wl.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;
