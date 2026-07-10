-- ============================================================
-- PROJECT OSPREY — Supabase Initial Migration
-- 001_initial_schema.sql
-- PostgreSQL 15+ / Supabase
-- Run this first. Sets up the entire core schema.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy text search on food items


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE build_type_enum       AS ENUM ('personal', 'sale');
CREATE TYPE units_enum            AS ENUM ('imperial', 'metric');
CREATE TYPE fitness_level_enum    AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE primary_goal_enum     AS ENUM ('run', 'lift', 'hybrid', 'weight_loss', 'general_fitness');
CREATE TYPE run_surface_enum      AS ENUM ('road', 'trail', 'treadmill', 'mixed');
CREATE TYPE gym_type_enum         AS ENUM ('commercial', 'home', 'outdoor', 'none');
CREATE TYPE plan_type_enum        AS ENUM ('run', 'lift', 'hybrid', 'custom');
CREATE TYPE plan_status_enum      AS ENUM ('active', 'completed', 'paused', 'archived');
CREATE TYPE session_type_enum     AS ENUM ('run', 'lift', 'cross', 'rest', 'race');
CREATE TYPE intensity_enum        AS ENUM ('easy', 'moderate', 'threshold', 'interval', 'race', 'rest');
CREATE TYPE workout_status_enum   AS ENUM ('planned', 'completed', 'skipped', 'partial');
CREATE TYPE gear_category_enum    AS ENUM ('shoes', 'clothing', 'tech', 'nutrition', 'recovery', 'other');
CREATE TYPE friendship_status_enum AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE challenge_status_enum AS ENUM ('active', 'completed', 'cancelled');


-- ============================================================
-- HELPER: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- DOMAIN 1 — IDENTITY & PROFILE
-- ============================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  avatar_url          TEXT,
  build_type          build_type_enum NOT NULL DEFAULT 'sale',
  experience_tier     fitness_level_enum NOT NULL DEFAULT 'beginner',  -- beginner or advanced mode
  timezone            TEXT NOT NULL DEFAULT 'America/Chicago',
  units               units_enum NOT NULL DEFAULT 'imperial',
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE user_goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primary_goal     primary_goal_enum NOT NULL,
  target_race      TEXT,
  target_date      DATE,
  weekly_run_days  SMALLINT CHECK (weekly_run_days BETWEEN 0 AND 7),
  weekly_lift_days SMALLINT CHECK (weekly_lift_days BETWEEN 0 AND 7),
  fitness_level    fitness_level_enum NOT NULL DEFAULT 'beginner',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_goals_updated_at BEFORE UPDATE ON user_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_user_goals_user_id ON user_goals(user_id);


CREATE TABLE user_preferences (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  notification_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  notification_time        TIME,
  preferred_run_surface    run_surface_enum,
  preferred_gym_type       gym_type_enum,
  weather_gear_feedback    JSONB,
  audio_cues_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  voice_logging_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  streak_forgiveness_days  SMALLINT NOT NULL DEFAULT 1,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- DOMAIN 2 — TRAINING PLANS
-- ============================================================

CREATE TABLE training_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  plan_type        plan_type_enum NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE,
  target_event_id  UUID,   -- FK to race_events added later to avoid circular dep
  ai_generated     BOOLEAN NOT NULL DEFAULT FALSE,
  status           plan_status_enum NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE TRIGGER training_plans_updated_at BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_training_plans_user_id ON training_plans(user_id)
  WHERE deleted_at IS NULL;


CREATE TABLE training_weeks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number SMALLINT NOT NULL,
  start_date  DATE NOT NULL,
  focus       TEXT,    -- e.g. 'Base building', 'Threshold week', 'Recovery'
  tss_target  NUMERIC(6,1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_weeks_plan_id ON training_weeks(plan_id);


CREATE TABLE training_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id         UUID NOT NULL REFERENCES training_weeks(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL,
  session_type    session_type_enum NOT NULL,
  intensity       intensity_enum NOT NULL DEFAULT 'easy',
  planned_minutes SMALLINT,
  planned_distance_km NUMERIC(6,2),
  description     TEXT,
  ozzie_notes     TEXT,  -- Ozzie's explanation of why this session is in the plan
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER training_sessions_updated_at BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_training_sessions_user_date ON training_sessions(user_id, session_date);


-- ============================================================
-- DOMAIN 3 — WORKOUT LOGGING
-- ============================================================

CREATE TABLE workout_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id        UUID REFERENCES training_sessions(id),  -- NULL = unplanned workout
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,
  session_type      session_type_enum NOT NULL,
  status            workout_status_enum NOT NULL DEFAULT 'planned',
  perceived_effort  SMALLINT CHECK (perceived_effort BETWEEN 1 AND 10),
  total_distance_km NUMERIC(7,3),
  total_duration_s  INTEGER,
  avg_heart_rate    SMALLINT,
  max_heart_rate    SMALLINT,
  calories_burned   SMALLINT,
  tss               NUMERIC(6,1),    -- Training Stress Score
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TRIGGER workout_logs_updated_at BEFORE UPDATE ON workout_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_workout_logs_user_started ON workout_logs(user_id, started_at DESC)
  WHERE deleted_at IS NULL;


CREATE TABLE exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  muscle_group TEXT,
  equipment   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE exercise_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number  SMALLINT NOT NULL,
  reps        SMALLINT,
  weight_kg   NUMERIC(5,2),
  duration_s  INTEGER,   -- for timed sets / planks
  rpe         SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercise_sets_workout ON exercise_sets(workout_id);


-- ============================================================
-- DOMAIN 4 — GPS & ACTIVITIES
-- ============================================================

CREATE TABLE activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id    UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at   TIMESTAMPTZ NOT NULL,
  lat           NUMERIC(10,7) NOT NULL,
  lon           NUMERIC(10,7) NOT NULL,
  altitude_m    NUMERIC(7,2),
  speed_ms      NUMERIC(5,2),
  heart_rate    SMALLINT,
  cadence       SMALLINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_workout ON activity_logs(workout_id, recorded_at);

-- saved_routes intentionally NOT created here — see 023_saved_routes.sql,
-- which is the schema src/services/routes.ts actually reads/writes
-- (tags/distance_km/notes). This file originally also created a
-- differently-shaped, entirely-unused saved_routes table (surface/gpx_url/
-- start_lat/start_lon/is_public/deleted_at, none of which the app ever
-- touches), which made 023's CREATE TABLE fail outright on any fresh
-- migration replay ("relation already exists"). Removed 2026-07-10 audit —
-- see that table's real definition in 023 instead.

-- ============================================================
-- DOMAIN 5 — NUTRITION
-- ============================================================

CREATE TABLE food_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  brand         TEXT,
  calories_per_100g  NUMERIC(6,1),
  protein_g     NUMERIC(5,1),
  carbs_g       NUMERIC(5,1),
  fat_g         NUMERIC(5,1),
  barcode       TEXT,
  source        TEXT DEFAULT 'manual',  -- 'manual', 'usda', 'openfoodfacts'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_items_name_trgm ON food_items USING GIN (name gin_trgm_ops);
CREATE INDEX idx_food_items_barcode ON food_items(barcode) WHERE barcode IS NOT NULL;


CREATE TABLE nutrition_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  calories     SMALLINT,
  protein_g    SMALLINT,
  carbs_g      SMALLINT,
  fat_g        SMALLINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE food_log_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_item_id  UUID NOT NULL REFERENCES food_items(id),
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type     TEXT,   -- 'breakfast', 'lunch', 'dinner', 'snack'
  quantity_g    NUMERIC(6,1) NOT NULL,
  calories      NUMERIC(6,1),
  protein_g     NUMERIC(5,1),
  carbs_g       NUMERIC(5,1),
  fat_g         NUMERIC(5,1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_log_user_date ON food_log_entries(user_id, logged_at DESC);


-- ============================================================
-- DOMAIN 6 — RECOVERY & WEARABLES
-- ============================================================

CREATE TABLE wearable_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,  -- 'apple_health', 'garmin', 'whoop', 'polar', 'manual'
  event_type    TEXT NOT NULL,  -- 'sleep', 'hrv', 'resting_hr', 'steps', 'spo2'
  recorded_at   TIMESTAMPTZ NOT NULL,
  value_numeric NUMERIC(10,3),
  value_json    JSONB,          -- for complex events like sleep stages
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wearable_events_user_type_date ON wearable_events(user_id, event_type, recorded_at DESC);


CREATE TABLE recovery_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_date      DATE NOT NULL,
  score           SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  hrv_ms          NUMERIC(6,2),
  resting_hr      SMALLINT,
  sleep_hours     NUMERIC(4,2),
  sleep_quality   SMALLINT CHECK (sleep_quality BETWEEN 0 AND 100),
  acute_load      NUMERIC(6,1),
  chronic_load    NUMERIC(6,1),
  recommendation  TEXT,  -- 'train', 'easy', 'rest'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, score_date)
);

CREATE INDEX idx_recovery_scores_user_date ON recovery_scores(user_id, score_date DESC);


CREATE TABLE load_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_date      DATE NOT NULL,
  atl             NUMERIC(6,1),  -- Acute Training Load (7-day)
  ctl             NUMERIC(6,1),  -- Chronic Training Load (42-day)
  tsb             NUMERIC(6,1),  -- Training Stress Balance (CTL - ATL)
  weekly_tss      NUMERIC(7,1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, score_date)
);


CREATE TABLE soreness_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body_area   TEXT NOT NULL,  -- 'left_knee', 'lower_back', etc.
  severity    SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  notes       TEXT
);


-- ============================================================
-- DOMAIN 7 — GEAR
-- ============================================================

CREATE TABLE gear_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  brand           TEXT,
  category        gear_category_enum NOT NULL,
  purchase_date   DATE,
  distance_km     NUMERIC(8,2) NOT NULL DEFAULT 0,  -- auto-incremented per run
  retire_at_km    NUMERIC(8,2),
  is_retired      BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_gear_items_user ON gear_items(user_id) WHERE deleted_at IS NULL;


CREATE TABLE gear_session_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  gear_id     UUID NOT NULL REFERENCES gear_items(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- DOMAIN 8 — RACES & EVENTS
-- ============================================================

CREATE TABLE race_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  distance_km   NUMERIC(7,3),
  event_date    DATE NOT NULL,
  location      TEXT,
  race_url      TEXT,
  goal_time_s   INTEGER,
  result_time_s INTEGER,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Add deferred FK from training_plans to race_events
ALTER TABLE training_plans
  ADD CONSTRAINT fk_training_plans_target_event
  FOREIGN KEY (target_event_id) REFERENCES race_events(id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_race_events_user_date ON race_events(user_id, event_date) WHERE deleted_at IS NULL;


-- ============================================================
-- DOMAIN 9 — OZZIE / AI
-- ============================================================

CREATE TABLE ozzie_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  insight_type  TEXT NOT NULL,  -- 'daily_brief', 'post_workout', 'plan_adjust', 'why_explain'
  context_json  JSONB,          -- snapshot of data Ozzie used to generate this
  response_text TEXT NOT NULL,  -- what Ozzie said
  tts_audio_url TEXT,           -- Supabase Storage URL for cached ElevenLabs audio
  read_at       TIMESTAMPTZ
);

CREATE INDEX idx_ozzie_insights_user ON ozzie_insights(user_id, created_at DESC);


CREATE TABLE plan_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES training_plans(id),
  session_id      UUID REFERENCES training_sessions(id),
  triggered_by    TEXT,   -- 'recovery_score', 'missed_session', 'user_request'
  original_json   JSONB,  -- what the session/plan looked like before
  adjusted_json   JSONB,  -- what Ozzie changed it to
  ozzie_reason    TEXT,   -- plain-English explanation
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- DOMAIN 10 — SOCIAL
-- ============================================================

CREATE TABLE friendships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      friendship_status_enum NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);


CREATE TABLE activity_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);


CREATE TABLE kudos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id    UUID NOT NULL REFERENCES activity_shares(id) ON DELETE CASCADE,
  from_user   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(share_id, from_user)
);


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

-- Enable RLS on all user-owned tables
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_weeks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_log_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_targets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_scores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE soreness_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_session_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ozzie_insights      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_adjustments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_shares     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudos               ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY users_self ON users
  USING (id = auth.uid());

-- Generic own-row policies for user_id tables
CREATE POLICY user_goals_self       ON user_goals        USING (user_id = auth.uid());
CREATE POLICY user_prefs_self       ON user_preferences  USING (user_id = auth.uid());
CREATE POLICY training_plans_self   ON training_plans    USING (user_id = auth.uid());
CREATE POLICY workout_logs_self     ON workout_logs      USING (user_id = auth.uid());
CREATE POLICY food_log_self         ON food_log_entries  USING (user_id = auth.uid());
CREATE POLICY nutrition_targets_self ON nutrition_targets USING (user_id = auth.uid());
CREATE POLICY wearable_events_self  ON wearable_events   USING (user_id = auth.uid());
CREATE POLICY recovery_scores_self  ON recovery_scores   USING (user_id = auth.uid());
CREATE POLICY load_scores_self      ON load_scores       USING (user_id = auth.uid());
CREATE POLICY soreness_self         ON soreness_logs     USING (user_id = auth.uid());
CREATE POLICY gear_items_self       ON gear_items        USING (user_id = auth.uid());
CREATE POLICY race_events_self      ON race_events       USING (user_id = auth.uid());
CREATE POLICY ozzie_insights_self   ON ozzie_insights    USING (user_id = auth.uid());
CREATE POLICY plan_adjustments_self ON plan_adjustments  USING (user_id = auth.uid());

-- Activity shares: own shares + friends can read
CREATE POLICY activity_shares_self ON activity_shares
  USING (user_id = auth.uid());

-- Kudos: readable if you gave it or own the share
CREATE POLICY kudos_self ON kudos
  USING (from_user = auth.uid());

-- Joined-table policies (exercise_sets, activity_logs, gear_session_links, training_weeks, training_sessions)
-- These are accessed through their parent — RLS on parent is sufficient.
-- Add explicit policies here if direct table access is needed.

CREATE POLICY training_weeks_via_plan ON training_weeks
  USING (plan_id IN (SELECT id FROM training_plans WHERE user_id = auth.uid() AND deleted_at IS NULL));

CREATE POLICY training_sessions_self ON training_sessions
  USING (user_id = auth.uid());

CREATE POLICY exercise_sets_via_workout ON exercise_sets
  USING (workout_id IN (SELECT id FROM workout_logs WHERE user_id = auth.uid() AND deleted_at IS NULL));

CREATE POLICY activity_logs_via_workout ON activity_logs
  USING (user_id = auth.uid());

CREATE POLICY gear_links_via_gear ON gear_session_links
  USING (gear_id IN (SELECT id FROM gear_items WHERE user_id = auth.uid() AND deleted_at IS NULL));


-- ============================================================
-- COMPUTED VIEWS (feeds Ozzie's nightly cron)
-- ============================================================

CREATE OR REPLACE VIEW v_daily_summary AS
SELECT
  u.id                            AS user_id,
  u.display_name,
  u.timezone,
  u.experience_tier,
  rs.score                        AS recovery_score,
  rs.recommendation               AS recovery_recommendation,
  ls.atl,
  ls.ctl,
  ls.tsb,
  np.calories                     AS calorie_target,
  (
    SELECT COALESCE(SUM(total_distance_km), 0)
    FROM workout_logs wl
    WHERE wl.user_id = u.id
      AND wl.started_at >= DATE_TRUNC('week', NOW())
      AND wl.deleted_at IS NULL
  )                               AS week_distance_km,
  (
    SELECT COUNT(*)
    FROM workout_logs wl
    WHERE wl.user_id = u.id
      AND wl.started_at >= NOW() - INTERVAL '30 days'
      AND wl.deleted_at IS NULL
  )                               AS workouts_last_30d
FROM users u
LEFT JOIN recovery_scores rs ON rs.user_id = u.id AND rs.score_date = CURRENT_DATE
LEFT JOIN load_scores ls     ON ls.user_id = u.id AND ls.score_date = CURRENT_DATE
LEFT JOIN nutrition_targets np ON np.user_id = u.id
WHERE u.deleted_at IS NULL;


-- ============================================================
-- SEED: common exercises (subset)
-- ============================================================

INSERT INTO exercises (name, muscle_group, equipment) VALUES
  ('Back Squat',       'Legs',       'Barbell'),
  ('Deadlift',         'Full Body',  'Barbell'),
  ('Bench Press',      'Chest',      'Barbell'),
  ('Pull-Up',          'Back',       'Bodyweight'),
  ('Romanian Deadlift','Hamstrings', 'Barbell'),
  ('Hip Thrust',       'Glutes',     'Barbell'),
  ('Calf Raise',       'Calves',     'Machine'),
  ('Plank',            'Core',       'Bodyweight'),
  ('Box Jump',         'Power',      'Plyometric'),
  ('Tempo Run',        'Cardio',     'None'),
  ('Strides',          'Cardio',     'None'),
  ('Foam Roll',        'Recovery',   'None');

