-- 016_activity_feed_and_idor_fixes.sql
-- Fixes found in the 2026-07-02 code audit:
--   1. Activity feed: client calls RPC get_activity_feed(), which was never
--      defined anywhere — the feed always fails and falls back to a client
--      query that friends' self-only RLS on activity_shares/kudos blocks
--      anyway, so the feed can never show anything but silence/errors.
--   2. get_my_friends / get_friends_at_race / get_race_partners (013, 014)
--      take a caller-supplied id/race and never check it against auth.uid(),
--      letting any authenticated user enumerate another user's friends list,
--      race schedule, or race partners by guessing/observing UUIDs (IDOR).

-- ── activity_shares / kudos: allow accepted friends to read, not just self ─────

DROP POLICY IF EXISTS activity_shares_self ON activity_shares;

CREATE POLICY activity_shares_read ON activity_shares
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = activity_shares.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = activity_shares.user_id))
    )
  );

CREATE POLICY activity_shares_insert ON activity_shares
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_shares_update ON activity_shares
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_shares_delete ON activity_shares
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS kudos_self ON kudos;

CREATE POLICY kudos_read ON kudos
  FOR SELECT TO authenticated
  USING (
    from_user = auth.uid()
    OR EXISTS (
      SELECT 1 FROM activity_shares s
      WHERE s.id = kudos.share_id
        AND (
          s.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.status = 'accepted'
              AND ((f.requester_id = auth.uid() AND f.addressee_id = s.user_id)
                OR (f.addressee_id = auth.uid() AND f.requester_id = s.user_id))
          )
        )
    )
  );

CREATE POLICY kudos_insert ON kudos
  FOR INSERT TO authenticated
  WITH CHECK (from_user = auth.uid());

CREATE POLICY kudos_delete ON kudos
  FOR DELETE TO authenticated
  USING (from_user = auth.uid());

-- ── RPC: get_activity_feed ────────────────────────────────────────────────────
-- Returns the caller's own shares + their accepted friends' shares, newest
-- first, with kudo counts — the shape src/services/activity.ts expects.
-- SECURITY DEFINER to join users/workout_logs (both self-only RLS elsewhere).

CREATE OR REPLACE FUNCTION get_activity_feed(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  share_id           UUID,
  workout_id         UUID,
  user_id            UUID,
  display_name       TEXT,
  caption            TEXT,
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
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption,
           wl.session_type, wl.total_duration_s, wl.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;

-- ── IDOR fixes: pin caller-supplied ids to the authenticated caller ────────────

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
  JOIN users u       ON u.id = rp.partner_user_id
  JOIN race_events re ON re.id = rp.race_id
  WHERE rp.race_id = p_race_id
    AND (
      re.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = re.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = re.user_id))
      )
    )
  ORDER BY u.display_name;
$$;
