-- 035_coach_memory_injury_flag_dedup.sql
-- injury_flag rows have no workout_id/race_id to dedupe against (unlike PR
-- and race-result rows) — add a dedicated unique index scoped to injury_flag
-- so a repeat write for the same user/day upserts in place instead of
-- creating a duplicate row, mirroring idx_coach_memory_workout_dedup /
-- idx_coach_memory_race_dedup above.
--
-- NOT partial (no WHERE clause), even though only injury_flag rows ever hit
-- this constraint in practice — 029_fix_coach_memory_partial_index_conflict.sql
-- already documents why: PostgREST always emits a bare `ON CONFLICT (cols)`
-- with no predicate, which Postgres can't match to a partial index (42P10).
-- A first draft of this migration made that exact mistake again; fixed
-- before merge. event_type is itself one of the indexed columns, so a
-- non-partial index is behavior-equivalent — rows of a different event_type
-- never collide with each other regardless.
CREATE UNIQUE INDEX idx_coach_memory_injury_flag_dedup
  ON coach_memory(user_id, event_type, occurred_on);
