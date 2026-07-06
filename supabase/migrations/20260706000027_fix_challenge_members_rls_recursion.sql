-- 027_fix_challenge_members_rls_recursion.sql
-- challenge_members_read (014_challenges.sql) checks membership with a subquery
-- against challenge_members from inside challenge_members' own RLS policy —
-- Postgres applies the same policy recursively to that subquery and raises
-- 42P17 "infinite recursion detected in policy" on every authenticated SELECT,
-- breaking the entire challenges feature (list, join, leaderboard lookups).
-- Fix: check membership through a SECURITY DEFINER function, which runs with
-- the function owner's privileges and so isn't subject to the calling row's RLS.

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

DROP POLICY IF EXISTS challenge_members_read ON challenge_members;
CREATE POLICY challenge_members_read ON challenge_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_challenge_member(challenge_id, auth.uid())
  );
