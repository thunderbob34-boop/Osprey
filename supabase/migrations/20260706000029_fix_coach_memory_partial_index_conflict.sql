-- 029_fix_coach_memory_partial_index_conflict.sql
-- Both coach_memory dedup indexes (026_coach_memory.sql) are PARTIAL unique
-- indexes (WHERE workout_id/race_id IS NOT NULL). PostgREST always emits a bare
-- `ON CONFLICT (cols)` with no predicate, which Postgres cannot match to a
-- partial index (42P10) — so both the PR-memory upsert (src/services/workouts.ts)
-- and the race-result-memory upsert (src/services/races.ts) fail on every call
-- and are silently swallowed by their try/catch. 022_workout_import_source.sql
-- already documents this exact pitfall.
--
-- A full (non-partial) unique index is behavior-equivalent here: for 'pr' rows
-- workout_id/exercise_id are always set by the app, and for 'race_result' rows
-- race_id is always set, so the dedup semantics are unchanged — only rows of a
-- *different* event_type ever had NULL in these columns, and NULL is never
-- considered equal to NULL for uniqueness purposes either way.

DROP INDEX IF EXISTS idx_coach_memory_workout_dedup;
CREATE UNIQUE INDEX idx_coach_memory_workout_dedup
  ON coach_memory(user_id, event_type, workout_id, exercise_id);

DROP INDEX IF EXISTS idx_coach_memory_race_dedup;
CREATE UNIQUE INDEX idx_coach_memory_race_dedup
  ON coach_memory(user_id, event_type, race_id);
