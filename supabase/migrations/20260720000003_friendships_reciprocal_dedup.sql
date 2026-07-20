-- 20260720000003_friendships_reciprocal_dedup.sql
-- friendships_insert only checked requester_id = auth.uid(), so nothing
-- stopped user B from inserting a second (requester=B, addressee=A) row
-- while (requester=A, addressee=B) already existed — UNIQUE(requester_id,
-- addressee_id) doesn't catch it since the pair is reversed. That leaves two
-- independent rows instead of B's action accepting A's existing request,
-- which get_my_friends' "either side" OR-matching then surfaces as
-- duplicate friend rows once both happen to reach 'accepted'.
DROP POLICY IF EXISTS friendships_insert ON friendships;
CREATE POLICY friendships_insert ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.requester_id = friendships.addressee_id
        AND f.addressee_id = friendships.requester_id
    )
  );

-- Belt-and-suspenders for any reciprocal-duplicate rows already sitting in
-- production from before the policy above existed.
CREATE OR REPLACE FUNCTION get_my_friends(p_user_id UUID)
RETURNS TABLE(
  friend_user_id      UUID,
  friend_display_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT
    u.id              AS friend_user_id,
    u.display_name    AS friend_display_name
  FROM friendships f
  JOIN users u ON u.id = CASE
    WHEN f.requester_id = auth.uid() THEN f.addressee_id
    ELSE f.requester_id
  END
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND u.deleted_at IS NULL
  ORDER BY u.display_name;
$$;

GRANT EXECUTE ON FUNCTION get_my_friends TO authenticated;
