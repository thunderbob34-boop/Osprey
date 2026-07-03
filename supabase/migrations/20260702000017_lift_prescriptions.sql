-- 017_lift_prescriptions.sql
-- Ozzie writes the lifts: structured strength prescriptions on plan sessions.
-- Shape: {"exercises": [{"name": string, "sets": number, "reps": string, "note": string|null}]}

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS lift_prescription JSONB;
