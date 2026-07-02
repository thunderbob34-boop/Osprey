-- 021_friendships_accept_addressee_only.sql
-- Closes a self-accept hole flagged during the Crew Challenges verification
-- pass: friendships_update (004_fix_remaining_rls.sql) allowed EITHER party
-- to UPDATE a row, including flipping status pending -> accepted. A
-- requester could insert (self, victim, 'pending') — allowed by
-- friendships_insert — then immediately UPDATE it to 'accepted' themselves,
-- becoming the victim's "friend" without the victim ever consenting. This
-- predates Crew Challenges but that feature makes status='accepted' the
-- gate for activity-feed visibility (get_activity_feed), kudos visibility,
-- and get_friends_at_race, so the hole is now load-bearing.
--
-- Only the addressee legitimately accepts a request; the requester's only
-- legitimate write is withdrawing it, which already goes through DELETE
-- (friendships_delete already permits either party). So UPDATE narrows to
-- addressee-only — no client flow in this app ever has the requester call
-- an update, so this doesn't break anything already shipped.

DROP POLICY IF EXISTS friendships_update ON friendships;

CREATE POLICY friendships_update ON friendships
  FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid())
  WITH CHECK (addressee_id = auth.uid());
