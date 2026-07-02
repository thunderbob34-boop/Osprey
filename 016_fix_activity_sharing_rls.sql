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
