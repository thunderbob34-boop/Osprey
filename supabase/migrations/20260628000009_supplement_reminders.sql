-- ============================================================
-- OSPREY 009 — Supplement / medication reminders
-- Timed reminders for creatine, electrolytes, vitamins, meds, etc.
-- Scheduling itself lives client-side (expo-notifications); this table
-- is the source of truth the device reconciles against on app open.
-- `training_days_only` reminders fire only on days with a planned,
-- non-rest training session (resolved on the device from training_sessions).
-- ============================================================

CREATE TABLE supplement_reminders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  dosage             TEXT,
  remind_hour        SMALLINT NOT NULL CHECK (remind_hour BETWEEN 0 AND 23),
  remind_minute      SMALLINT NOT NULL DEFAULT 0 CHECK (remind_minute BETWEEN 0 AND 59),
  training_days_only BOOLEAN NOT NULL DEFAULT FALSE,
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplement_reminders_user ON supplement_reminders(user_id);

CREATE TRIGGER supplement_reminders_updated_at BEFORE UPDATE ON supplement_reminders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE supplement_reminders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplement_reminders TO authenticated;
GRANT ALL ON supplement_reminders TO service_role;

CREATE POLICY supplement_reminders_self ON supplement_reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
