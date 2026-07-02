-- ============================================================
-- OSPREY 016 — Fix activity_shares / kudos RLS (run in Supabase SQL Editor)
-- Fixes: activity_shares_self and kudos_self (001_initial_schema.sql) were
-- self-only despite their comments promising "friends can read" / "readable
-- if you gave it or own the share" — the activity feed's friend-shares query
-- returned nothing but your own posts, and a share owner could never see
-- kudos they'd received. Also splits the single ALL-command policy into
-- explicit SELECT/INSERT/UPDATE/DELETE so the broadened read access doesn't
-- also broaden who can write.
-- ============================================================

DROP POLICY IF EXISTS activity_shares_self ON activity_shares;

CREATE POLICY activity_shares_select ON activity_shares
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

CREATE POLICY activity_shares_delete ON activity_shares
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS kudos_self ON kudos;

-- Readable if you gave the kudo, or if you can see the underlying share
-- (you own it, or you're friends with the person who posted it) — needed so
-- the activity feed can show an accurate kudo count and "did I kudo this"
-- state for friends' posts, not just your own.
CREATE POLICY kudos_select ON kudos
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

-- ── RPC: get_activity_feed ────────────────────────────────────────────────────
-- The RLS fix above alone is NOT sufficient for the activity feed: the feed
-- query joins activity_shares -> users (for display_name) and
-- activity_shares -> workout_logs (for session stats), and both `users`
-- (002_fix_users_rls.sql) and `workout_logs` (001_initial_schema.sql) are
-- self-only under RLS — so an inner join against a friend's row in either
-- table returns nothing, even once activity_shares/kudos allow friend reads.
-- Broadening users/workout_logs RLS directly would over-expose those tables
-- (e.g. every workout, not just shared ones). Instead, use the same
-- SECURITY DEFINER + explicit-caller-check pattern as get_challenge_leaderboard:
-- the function internally bypasses per-table RLS but enforces the identical
-- "owner or accepted friend" check the activity_shares_select policy encodes.
CREATE OR REPLACE FUNCTION get_activity_feed(p_limit INT DEFAULT 50)
RETURNS TABLE(
  share_id          UUID,
  workout_id        UUID,
  user_id           UUID,
  display_name      TEXT,
  caption           TEXT,
  session_type      TEXT,
  total_duration_s  INT,
  total_distance_km NUMERIC,
  share_created_at  TIMESTAMPTZ,
  kudo_count        BIGINT,
  user_gave_kudo    BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id,
    s.workout_id,
    s.user_id,
    u.display_name,
    s.caption,
    w.session_type,
    w.total_duration_s,
    w.total_distance_km,
    s.created_at,
    COUNT(k.id) AS kudo_count,
    BOOL_OR(k.from_user = auth.uid()) AS user_gave_kudo
  FROM activity_shares s
  JOIN users u ON u.id = s.user_id
  JOIN workout_logs w ON w.id = s.workout_id
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
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption,
           w.session_type, w.total_duration_s, w.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;
