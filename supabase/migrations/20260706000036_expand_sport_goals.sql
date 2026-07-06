-- 036_expand_sport_goals.sql
--
-- The onboarding flow is expanding from a coarse 4-option goal category
-- (run/lift/hybrid/weight_loss) to the full 9-sport lineup documented in
-- docs/coaching/ (running, cycling, swimming, rowing, triathlon,
-- powerlifting, hyrox, crossfit, ultra), plus collecting a target
-- event/date and constraint/injury history so the plan-generation engine
-- has all 4 of the shared engine's onboarding inputs (experience & load,
-- goal event & demands, timeline to peak, constraints & injury history).
--
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a
-- statement that USES the new value (see 021_triathlon_goal.sql), so this
-- migration only adds the enum values — later migrations/functions
-- reference them separately.

ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'cycling';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'swimming';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'rowing';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'powerlifting';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'hyrox';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'crossfit';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'ultra';

ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS injury_notes TEXT,
  ADD COLUMN IF NOT EXISTS constraint_tags TEXT[] NOT NULL DEFAULT '{}';
