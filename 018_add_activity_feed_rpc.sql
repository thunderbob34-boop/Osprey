-- 018_add_activity_feed_rpc.sql
-- src/services/activity.ts has always called supabase.rpc('get_activity_feed', ...)
-- first and only fell back to a client-side join on error — but this RPC was never
-- defined, so every call fell through to the fallback. That fallback embeds
-- users!inner(display_name) and workout_logs!inner(...), and those two tables'
-- RLS (users_self / workout_logs_self, both self-only) silently drops every row
-- belonging to a friend rather than erroring — so even after 017 made
-- activity_shares/kudos friends-visible, the feed still only ever showed the
-- caller's own posts. A SECURITY DEFINER RPC (same pattern as 014/016/017) is
-- the fix: it can join users/workout_logs directly without needing to loosen
-- their RLS, while still enforcing the self-or-friend visibility rule itself.

CREATE OR REPLACE FUNCTION get_activity_feed(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  share_id UUID,
  workout_id UUID,
  user_id UUID,
  display_name TEXT,
  caption TEXT,
  session_type TEXT,
  total_duration_s INT,
  total_distance_km NUMERIC,
  share_created_at TIMESTAMPTZ,
  kudo_count BIGINT,
  user_gave_kudo BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id AS share_id,
    s.workout_id,
    s.user_id,
    u.display_name,
    s.caption,
    wl.session_type,
    wl.total_duration_s,
    wl.total_distance_km,
    s.created_at AS share_created_at,
    COUNT(k.id) AS kudo_count,
    BOOL_OR(k.from_user = p_user_id) AS user_gave_kudo
  FROM activity_shares s
  JOIN users u ON u.id = s.user_id
  JOIN workout_logs wl ON wl.id = s.workout_id
  LEFT JOIN kudos k ON k.share_id = s.id
  WHERE s.deleted_at IS NULL
    AND (s.user_id = p_user_id OR are_friends(s.user_id, p_user_id))
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption,
           wl.session_type, wl.total_duration_s, wl.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;
