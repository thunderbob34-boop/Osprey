-- 020_interval_prescriptions.sql
-- Structured swim/bike sets: Ozzie writes real interval workouts
-- ("8x50m hard / 20s rest", "4x5min @ threshold") instead of a bare
-- duration. Shape: {"segments": [{"reps": number, "distanceM": number|null,
-- "durationS": number|null, "effort": string, "restS": number, "label": string}]}

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS interval_prescription JSONB;
