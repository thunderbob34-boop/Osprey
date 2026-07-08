-- ============================================================
-- OSPREY 028 — Rowing + Hyrox session types, Cross Training metrics
-- Promotes Rowing to a first-class session_type (was Cross Training-only,
-- despite already having its own coaching blueprint + training-zone
-- calculator) and adds a dedicated Hyrox session type. Also adds narrow
-- workout_logs columns for Cross Training sub-activity metrics that don't
-- fit total_distance_km/notes: CrossFit WOD score, Stair Climber floors,
-- Hiking elevation gain.
-- ============================================================

-- ALTER TYPE ... ADD VALUE must run outside a transaction block and one
-- per statement — same constraint and precedent as
-- 20260702000015_race_goal_tracking.sql, which added 'swim'/'bike' the
-- same way.
ALTER TYPE session_type_enum ADD VALUE IF NOT EXISTS 'rowing';
ALTER TYPE session_type_enum ADD VALUE IF NOT EXISTS 'hyrox';

-- CrossFit WOD score ("18:32" or "5 rounds + 12 reps") — notes already
-- stores the picked Cross Training activity label (e.g. "CrossFit"), so
-- this needs its own column rather than colliding with that usage.
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS wod_score TEXT;

-- Stair Climber floors-climbed count.
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS floors_climbed SMALLINT;

-- Hiking elevation gain, computed from activity_logs.altitude_m track
-- points at save time (that column already exists; this is the rolled-up
-- per-workout total).
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS elevation_gain_m SMALLINT;

-- Hyrox competition division — kept as its own column (not folded into
-- notes) so it stays queryable, e.g. filtering a user's Pro-division
-- sessions later.
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS hyrox_division TEXT;

-- Hyrox's 8-run + 8-station structure is fixed-length and always the same
-- shape (unlike exercise_sets, which is variable-length and queried
-- column-wise) — a JSONB blob read/written once per session matches the
-- interval_prescription/lift_prescription precedent for structured
-- per-session data, rather than a new child table.
-- Shape: {"runs": [{"index":1,"durationS":312}, ...8],
--         "stations": [{"index":1,"stationId":"skierg","durationS":245}, ...8],
--         "roxzoneS": [{"index":1,"durationS":38}, ...15]}
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS hyrox_splits JSONB;
