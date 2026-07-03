-- 022_workout_import_source.sql
-- Supports importing workouts recorded on Apple Watch/Garmin (which sync
-- into HealthKit) instead of relying on manual entry. `external_id` lets
-- repeated imports stay idempotent (upsert on user_id + external_id);
-- `source` distinguishes HealthKit-imported rows from OSPREY-native ones.

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- NOT a partial index: PostgREST's on_conflict emits a bare
-- ON CONFLICT (user_id, external_id) with no WHERE predicate, which
-- Postgres refuses to match against a partial unique index. A full unique
-- index is safe because NULLs are distinct — manual workouts (external_id
-- NULL) never collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_user_external
  ON workout_logs(user_id, external_id);
