-- WS1 (Runna gap-close, docs/superpowers/plans/2026-08-02-runna-gap-close.md):
-- the onboarding rebuild needs to persist availability, equipment, and a
-- reserved slot for WS2's injury model. All nullable, no defaults, no backfill
-- — existing onboarding_complete users never revisit onboarding, so their rows
-- simply keep NULLs here and every reader already treats these as optional.
--
-- No new RLS policy needed: these live on the existing user_goals table, which
-- already has user_goals_select/insert/update scoped to user_id = auth.uid()
-- (20260628000002_fix_users_rls.sql). Race goal (target_race/target_date/
-- total_weeks_planned) and body weight (body_metrics.weight_kg) already have
-- columns from earlier migrations — onboarding just doesn't write them yet;
-- that's an app-code change, not a schema change.

ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS available_days   JSONB;
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS long_session_day TEXT;
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS equipment        JSONB;

-- Reserved for WS2's injury model (region/tissue/status/onset). WS1 never
-- writes this column — it exists now so WS2 doesn't need a second migration
-- touching this table for a field WS1's onboarding screens already reserve
-- draft-side (OnboardingDraft.injuryHistory).
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS injury_history   JSONB;
