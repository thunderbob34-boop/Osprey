-- 026_coach_memory.sql
-- Coach memory — persists notable events (PRs, race results, and a slot for
-- future injury flags) so the daily brief can reference them later ("Last
-- month you PR'd this lift — let's see where it is today") instead of
-- Ozzie's memory resetting every morning.

CREATE TYPE coach_memory_type_enum AS ENUM ('pr', 'race_result', 'injury_flag');

CREATE TABLE coach_memory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   coach_memory_type_enum NOT NULL,
  occurred_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  summary      TEXT NOT NULL,
  workout_id   UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id  UUID REFERENCES exercises(id),
  race_id      UUID REFERENCES race_events(id) ON DELETE CASCADE,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_memory_user_recent ON coach_memory(user_id, occurred_on DESC);

-- A recap can be viewed more than once — dedupe PR memories per (workout, exercise).
CREATE UNIQUE INDEX idx_coach_memory_workout_dedup
  ON coach_memory(user_id, event_type, workout_id, exercise_id)
  WHERE workout_id IS NOT NULL;

-- A race result can be corrected — dedupe per (user, race) so re-recording updates in place.
CREATE UNIQUE INDEX idx_coach_memory_race_dedup
  ON coach_memory(user_id, event_type, race_id)
  WHERE race_id IS NOT NULL;

ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON coach_memory TO authenticated;
GRANT ALL ON coach_memory TO service_role;

CREATE POLICY coach_memory_self ON coach_memory
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
