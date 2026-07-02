-- 011_race_logistics.sql
-- Race-day logistics fields for the race-day hub (Task 7).
-- Adds packet pickup time, parking/transit notes, gear notes,
-- a JSONB morning checklist, and Ozzie's pre-race briefing text.
-- All columns inherit the existing RLS policy on race_events
-- (user_id = auth.uid()), so no new policies are needed.

ALTER TABLE race_events
  ADD COLUMN IF NOT EXISTS packet_pickup_time  TEXT,
  ADD COLUMN IF NOT EXISTS parking_notes       TEXT,
  ADD COLUMN IF NOT EXISTS gear_notes          TEXT,
  ADD COLUMN IF NOT EXISTS morning_checklist   JSONB,
  ADD COLUMN IF NOT EXISTS ozzie_briefing_text TEXT;
