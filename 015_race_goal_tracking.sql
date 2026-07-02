-- 015_race_goal_tracking.sql
--
-- Two fixes:
--
-- 1. session_type_enum never included 'swim' or 'bike', even though
--    Ozzie's plan generator and the app's workout screens have supported
--    those session types all along. Any AI-generated day that picked
--    swim/bike as session_type would fail the training_sessions insert
--    with an invalid enum value error.
--
-- 2. Race-target metadata (target race, race date, total plan length) was
--    never persisted anywhere durable — each week's plan generation call
--    creates a brand new training_plans row, so nothing about "week 3 of 19
--    building toward Charlotte Marathon" survived past that one call. This
--    adds total_weeks_planned to user_goals (which already has target_race /
--    target_date) so the app can show a full countdown/phase overview that
--    persists across weekly plan regenerations.

ALTER TYPE session_type_enum ADD VALUE IF NOT EXISTS 'swim';
ALTER TYPE session_type_enum ADD VALUE IF NOT EXISTS 'bike';

ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS total_weeks_planned SMALLINT;

-- Deduplicate any existing rows before adding the uniqueness constraint
-- needed for upsert-by-user_id (keeps the most recently updated row).
DELETE FROM user_goals a
USING user_goals b
WHERE a.user_id = b.user_id
  AND a.updated_at < b.updated_at;

ALTER TABLE user_goals
  ADD CONSTRAINT user_goals_user_id_unique UNIQUE (user_id);
