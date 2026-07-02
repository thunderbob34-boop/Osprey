-- 017_health_connected.sql
-- Persists whether the user has connected Apple Health, so the Settings
-- screen stops showing "Not connected" after every app relaunch even for
-- users who already authorized HealthKit. Needed for the Life Load feature
-- to know whether it's worth attempting a HealthKit sync on app open.

ALTER TABLE user_preferences
  ADD COLUMN health_connected BOOLEAN NOT NULL DEFAULT FALSE;
