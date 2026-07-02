-- 019_activity_commentary_and_challenge_recaps.sql
-- Crew Challenges feature: Ozzie-narrated activity commentary + weekly
-- challenge recaps.

ALTER TABLE activity_shares
  ADD COLUMN ozzie_comment TEXT;

-- ── challenge_recaps ─────────────────────────────────────────────────────────
-- Persists each generated weekly recap so past recaps stay visible instead
-- of only living in a single ephemeral edge-function response. Written only
-- by the ozzie-challenge-recap edge function (service_role); readable by
-- challenge members/creator via the same is_challenge_member() helper
-- already used for challenges/challenge_members RLS.

CREATE TABLE challenge_recaps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  recap_text    TEXT NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_challenge_recaps_challenge ON challenge_recaps(challenge_id, generated_at DESC);

ALTER TABLE challenge_recaps ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON challenge_recaps TO authenticated;
GRANT ALL ON challenge_recaps TO service_role;

CREATE POLICY challenge_recaps_read ON challenge_recaps
  FOR SELECT TO authenticated
  USING (
    is_challenge_member(challenge_id, auth.uid())
    OR challenge_id IN (SELECT id FROM challenges WHERE creator_user_id = auth.uid())
  );
