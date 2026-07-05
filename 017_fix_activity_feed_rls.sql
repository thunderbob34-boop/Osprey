-- 017_fix_activity_feed_rls.sql
-- activity_shares_self / kudos_self were self-only on every command despite the
-- comments above them ("own shares + friends can read" / "readable if you gave
-- it or own the share") — friends could never see each other's shares or kudos,
-- making the activity feed permanently empty for anyone but the poster. Splits
-- each into a friends-visible SELECT policy and a self-only write policy.

CREATE OR REPLACE FUNCTION are_friends(a UUID, b UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND ((requester_id = a AND addressee_id = b) OR (requester_id = b AND addressee_id = a))
  );
$$;

GRANT EXECUTE ON FUNCTION are_friends TO authenticated;

DROP POLICY IF EXISTS activity_shares_self ON activity_shares;

CREATE POLICY activity_shares_read ON activity_shares
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR are_friends(user_id, auth.uid()));

CREATE POLICY activity_shares_insert ON activity_shares
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_shares_update ON activity_shares
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS kudos_self ON kudos;

CREATE POLICY kudos_read ON kudos
  FOR SELECT TO authenticated
  USING (
    from_user = auth.uid()
    OR share_id IN (
      SELECT id FROM activity_shares
      WHERE deleted_at IS NULL AND (user_id = auth.uid() OR are_friends(user_id, auth.uid()))
    )
  );

CREATE POLICY kudos_insert ON kudos
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    AND share_id IN (
      SELECT id FROM activity_shares
      WHERE deleted_at IS NULL AND (user_id = auth.uid() OR are_friends(user_id, auth.uid()))
    )
  );

CREATE POLICY kudos_delete ON kudos
  FOR DELETE TO authenticated
  USING (from_user = auth.uid());
