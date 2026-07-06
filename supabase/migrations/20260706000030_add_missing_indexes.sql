-- 030_add_missing_indexes.sql
-- Foreign keys and frequently-filtered columns with no supporting index,
-- found during the coaching-logic/migrations audit pass. Purely additive.

CREATE INDEX IF NOT EXISTS idx_training_sessions_week ON training_sessions(week_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_session ON workout_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_training_weeks_start_date ON training_weeks(start_date);
CREATE INDEX IF NOT EXISTS idx_plan_adjustments_user ON plan_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_adjustments_session ON plan_adjustments(session_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
