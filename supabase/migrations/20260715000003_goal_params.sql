-- Phase 3 (ultra): store the goal's sport-specific structured inputs. First
-- consumer is ultra (race distance, vert gain, gut-trained), flattened via
-- toUltraParams() in OSPREY-app/src/services/coaching/ultra-params.ts.
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS goal_params JSONB;
