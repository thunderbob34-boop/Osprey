-- 016_fix_challenge_members_rls.sql
-- Fixes infinite recursion (Postgres 42P17) in challenge_members_read: its USING
-- clause subqueried challenge_members from within a policy on challenge_members
-- itself. challenges_read had the same self-join-through-RLS problem one table
-- over, since evaluating its subquery on challenge_members re-triggers the
-- recursive policy. A SECURITY DEFINER helper (same pattern already used by
-- get_my_friends / get_challenge_leaderboard) breaks the cycle.

CREATE OR REPLACE FUNCTION is_challenge_member(p_challenge_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenge_members
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION is_challenge_member TO authenticated;

DROP POLICY IF EXISTS challenge_members_read ON challenge_members;
CREATE POLICY challenge_members_read ON challenge_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_challenge_member(challenge_id, auth.uid())
  );

DROP POLICY IF EXISTS challenges_read ON challenges;
CREATE POLICY challenges_read ON challenges
  FOR SELECT TO authenticated
  USING (
    creator_user_id = auth.uid()
    OR is_challenge_member(id, auth.uid())
  );
