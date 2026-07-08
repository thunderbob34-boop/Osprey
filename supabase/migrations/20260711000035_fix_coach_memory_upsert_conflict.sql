-- 035_fix_coach_memory_upsert_conflict.sql
-- workouts.ts (recordPrMemory) and races.ts (recordRaceResult) upsert into
-- coach_memory using a bare `onConflict` column list, as Supabase's
-- .upsert() always generates. But the two dedup indexes added in migration
-- 026 are PARTIAL (`WHERE workout_id IS NOT NULL` / `WHERE race_id IS NOT
-- NULL`), and Postgres has no unique constraint matching a plain
-- `ON CONFLICT (columns)` target when the only index on those columns is
-- partial — every upsert throws "there is no unique or exclusion
-- constraint matching the ON CONFLICT specification", silently swallowed by
-- the caller's best-effort try/catch. Net effect: PR and race-result
-- coach-memory entries never persist, so the daily brief's "last month you
-- PR'd this lift" callback has no data to read (2026-07-08 audit).
--
-- Standard (non-partial) unique indexes already treat NULLs as distinct
-- from each other, so dropping the WHERE clause preserves the exact same
-- dedup behavior for real workout_id/race_id values while making the index
-- a valid ON CONFLICT target for a plain column-list upsert.

DROP INDEX IF EXISTS idx_coach_memory_workout_dedup;
CREATE UNIQUE INDEX idx_coach_memory_workout_dedup
  ON coach_memory(user_id, event_type, workout_id, exercise_id);

DROP INDEX IF EXISTS idx_coach_memory_race_dedup;
CREATE UNIQUE INDEX idx_coach_memory_race_dedup
  ON coach_memory(user_id, event_type, race_id);
