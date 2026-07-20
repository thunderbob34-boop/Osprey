-- 20260720000001_coach_memory_dedup_indexes.sql
-- The partial unique indexes on coach_memory (WHERE workout_id/race_id IS NOT
-- NULL) can't be targeted by PostgREST's .upsert(onConflict:...), which
-- requires a plain unique index/constraint — Postgres rejects the ON CONFLICT
-- clause with 42P10 ("no unique or exclusion constraint matching the ON
-- CONFLICT specification"). recordPrMemory() (OSPREY-app/src/services/workouts.ts)
-- and the race-result upsert (OSPREY-app/src/services/races.ts) both silently
-- swallow this error today. Recreate both indexes without the WHERE clause so
-- upsert can target them; NULLs in a plain unique btree index never collide
-- with each other, so rows with workout_id/race_id NULL behave the same as
-- before.
DROP INDEX IF EXISTS idx_coach_memory_workout_dedup;
DROP INDEX IF EXISTS idx_coach_memory_race_dedup;

CREATE UNIQUE INDEX idx_coach_memory_workout_dedup
  ON coach_memory(user_id, event_type, workout_id, exercise_id);

CREATE UNIQUE INDEX idx_coach_memory_race_dedup
  ON coach_memory(user_id, event_type, race_id);
