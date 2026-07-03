-- ============================================================
-- OSPREY 018 — Subjective morning check-ins
-- A spoken 30-second "how are you actually feeling?" answered out
-- loud, transcribed, and distilled into structured subjective signal
-- (energy, soreness, mood, sentiment) by the ozzie-checkin edge
-- function. That signal blends into the day's recovery_scores row —
-- HRV/sleep data alone misses "my knee's been weird" and "mentally
-- fried", which is exactly what a human coach would ask about.
-- ============================================================

CREATE TABLE subjective_checkins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date     DATE NOT NULL,
  transcript       TEXT NOT NULL,
  energy_level     SMALLINT CHECK (energy_level BETWEEN 1 AND 5),
  soreness_areas   TEXT[] NOT NULL DEFAULT '{}',
  mood             TEXT,
  sentiment_score  NUMERIC(3,2) CHECK (sentiment_score BETWEEN -1 AND 1),
  ozzie_reply      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

CREATE INDEX idx_subjective_checkins_user_date ON subjective_checkins(user_id, checkin_date);

CREATE TRIGGER subjective_checkins_updated_at BEFORE UPDATE ON subjective_checkins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE subjective_checkins ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON subjective_checkins TO authenticated;
GRANT ALL ON subjective_checkins TO service_role;

CREATE POLICY subjective_checkins_self ON subjective_checkins
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
