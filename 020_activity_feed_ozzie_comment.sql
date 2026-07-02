-- 020_activity_feed_ozzie_comment.sql
-- Adds the new activity_shares.ozzie_comment column (019) to
-- get_activity_feed's return shape. CREATE OR REPLACE can't change a
-- function's return columns, so the old signature is dropped first.

DROP FUNCTION IF EXISTS get_activity_feed(UUID, INT);

CREATE OR REPLACE FUNCTION get_activity_feed(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  share_id           UUID,
  workout_id         UUID,
  user_id            UUID,
  display_name       TEXT,
  caption            TEXT,
  ozzie_comment      TEXT,
  session_type       TEXT,
  total_duration_s   INTEGER,
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
    SELECT p_user_id AS id
    UNION
    SELECT CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
  )
  SELECT
    s.id                  AS share_id,
    s.workout_id,
    s.user_id,
    u.display_name,
    s.caption,
    s.ozzie_comment,
    wl.session_type::TEXT AS session_type,
    wl.total_duration_s,
    wl.total_distance_km,
    s.created_at           AS share_created_at,
    COUNT(k.id)             AS kudo_count,
    BOOL_OR(k.from_user = p_user_id) AS user_gave_kudo
  FROM activity_shares s
  JOIN users u        ON u.id = s.user_id
  JOIN workout_logs wl ON wl.id = s.workout_id
  LEFT JOIN kudos k   ON k.share_id = s.id
  WHERE p_user_id = auth.uid()
    AND s.user_id IN (SELECT id FROM visible_users)
    AND s.deleted_at IS NULL
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption, s.ozzie_comment,
           wl.session_type, wl.total_duration_s, wl.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;
