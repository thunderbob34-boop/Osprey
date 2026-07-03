-- 016_activity_feed_fix.sql
-- Fixes the activity/social feed, which was 100% non-functional:
--   1. activity_shares/kudos RLS policies were self-only despite the schema
--      comment promising "own shares + friends can read" — friends could
--      never see each other's posts or kudos.
--   2. src/services/activity.ts called an RPC (get_activity_feed) that was
--      never defined, so every load fell through to a fallback query using
--      invalid PostgREST alias syntax (SQL "AS" instead of "alias:column"),
--      which also always errored.
-- This migration fixes the RLS policies and adds the missing RPC.

-- ── activity_shares: allow accepted friends to read, not just the owner ───────

DROP POLICY IF EXISTS activity_shares_self ON activity_shares;

CREATE POLICY activity_shares_read ON activity_shares
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = activity_shares.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = activity_shares.user_id)
        )
    )
  );

CREATE POLICY activity_shares_insert ON activity_shares
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_shares_update ON activity_shares
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── kudos: readable if you can see the underlying share, not just kudos you gave ──

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
              AND (
                (f.requester_id = auth.uid() AND f.addressee_id = s.user_id)
                OR (f.addressee_id = auth.uid() AND f.requester_id = s.user_id)
              )
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

-- ── RPC: get_activity_feed ─────────────────────────────────────────────────────
-- Returns the caller's own shares + accepted friends' shares, newest first,
-- with kudo counts and whether the caller already gave a kudo.
-- SECURITY DEFINER so it can join users/workout_logs despite their self-only RLS.

CREATE OR REPLACE FUNCTION get_activity_feed(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  share_id            TEXT,
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
    s.id::TEXT              AS share_id,
    s.workout_id,
    s.user_id,
    u.display_name,
    s.caption,
    wl.session_type::TEXT   AS session_type,
    wl.total_duration_s,
    wl.total_distance_km,
    s.created_at            AS share_created_at,
    COUNT(k.id)              AS kudo_count,
    BOOL_OR(k.from_user = auth.uid()) AS user_gave_kudo
  FROM activity_shares s
  JOIN users u ON u.id = s.user_id
  JOIN workout_logs wl ON wl.id = s.workout_id
  LEFT JOIN kudos k ON k.share_id = s.id
  WHERE s.deleted_at IS NULL
    AND (
      s.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = auth.uid() AND f.addressee_id = s.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = s.user_id)
          )
      )
    )
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption, wl.session_type,
           wl.total_duration_s, wl.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;
