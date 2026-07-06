-- 035_coach_memory_injury_flag_dedup.sql
-- injury_flag rows have no workout_id/race_id to dedupe against (unlike PR
-- and race-result rows) — add a dedicated partial unique index scoped to
-- injury_flag so a repeat write for the same user/day upserts in place
-- instead of creating a duplicate row, mirroring
-- idx_coach_memory_workout_dedup / idx_coach_memory_race_dedup above.
CREATE UNIQUE INDEX idx_coach_memory_injury_flag_dedup
  ON coach_memory(user_id, event_type, occurred_on)
  WHERE event_type = 'injury_flag';
