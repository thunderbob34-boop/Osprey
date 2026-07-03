-- 022_workout_import_source.sql
-- Supports importing workouts recorded on Apple Watch/Garmin (which sync
-- into HealthKit) instead of relying on manual entry. `external_id` lets
-- repeated imports stay idempotent (upsert on user_id + external_id);
-- `source` distinguishes HealthKit-imported rows from OSPREY-native ones.

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_user_external
  ON workout_logs(user_id, external_id)
  WHERE external_id IS NOT NULL;
