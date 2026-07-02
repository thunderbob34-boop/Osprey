-- 012_race_retrospective.sql
-- Post-race retrospective fields for the Ozzie-guided reflection flow (Task 8).
-- Stored on race_events alongside result_time_s so all race data stays together.
-- All columns inherit the existing RLS policy (user_id = auth.uid()).

ALTER TABLE race_events
  ADD COLUMN IF NOT EXISTS retro_feel_score      INTEGER CHECK (retro_feel_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS retro_pacing_notes    TEXT,
  ADD COLUMN IF NOT EXISTS retro_nutrition_notes TEXT,
  ADD COLUMN IF NOT EXISTS retro_lessons         TEXT,
  ADD COLUMN IF NOT EXISTS ozzie_retro_text      TEXT;
