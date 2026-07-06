-- 033_fix_is_challenge_member_leak.sql
-- is_challenge_member (027_fix_challenge_members_rls_recursion.sql) is
-- SECURITY DEFINER and, like every Postgres function, executable by PUBLIC by
-- default. It's only ever invoked from within challenge_members_read's own
-- USING clause (always with auth.uid() as the second argument), but nothing
-- stopped a client from calling supabase.rpc('is_challenge_member', { p_user_id:
-- <anyone> }) directly and using the true/false result as a membership oracle
-- for arbitrary (challenge, user) pairs. REVOKEing EXECUTE from authenticated
-- isn't an option — the RLS policy itself runs as that role and needs it.
-- Instead, drop the parameter that made cross-user probing possible: the
-- function no longer accepts a user id at all, it always checks auth.uid().

DROP POLICY IF EXISTS challenge_members_read ON challenge_members;
DROP FUNCTION IF EXISTS is_challenge_member(UUID, UUID);

CREATE FUNCTION is_challenge_member(p_challenge_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenge_members
    WHERE challenge_id = p_challenge_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY challenge_members_read ON challenge_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_challenge_member(challenge_id)
  );
