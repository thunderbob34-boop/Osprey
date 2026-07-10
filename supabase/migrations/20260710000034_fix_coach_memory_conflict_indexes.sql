-- 034_fix_coach_memory_conflict_indexes.sql
-- Nightly audit (2026-07-10) finding: idx_coach_memory_workout_dedup and
-- idx_coach_memory_race_dedup are PARTIAL unique indexes (WHERE workout_id/
-- race_id IS NOT NULL). PostgREST's upsert `onConflict` only ever passes
-- column names, never a WHERE predicate, so Postgres can't infer a partial
-- index for ON CONFLICT and every coach_memory upsert
-- (recordPrMemory in workouts.ts, recordRaceResult in races.ts) fails with
-- 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Both call sites swallow the error (console.error only),
-- so the entire coach-memory feature — PR/race-result callbacks in the
-- daily brief — has been silently writing nothing.
--
-- Fix: make both indexes non-partial. Standard btree unique-index semantics
-- already treat NULLs as distinct from each other, so dropping the WHERE
-- clause doesn't change what's allowed to repeat — it just makes the index
-- eligible for ON CONFLICT inference.

DROP INDEX IF EXISTS idx_coach_memory_workout_dedup;
CREATE UNIQUE INDEX idx_coach_memory_workout_dedup
  ON coach_memory(user_id, event_type, workout_id, exercise_id);

DROP INDEX IF EXISTS idx_coach_memory_race_dedup;
CREATE UNIQUE INDEX idx_coach_memory_race_dedup
  ON coach_memory(user_id, event_type, race_id);
