-- 035_session_fk_on_delete_set_null.sql
-- Nightly audit (2026-07-10) finding: workout_logs.session_id,
-- plan_adjustments.session_id, and plan_adjustments.plan_id reference their
-- parents with no ON DELETE action, which defaults to RESTRICT. Once any
-- workout has been logged against a session, deleting that session's parent
-- training_plan (which cascades plan -> weeks -> sessions) fails with an FK
-- violation instead of cascading, because the logged workout_logs/
-- plan_adjustments row still points at the session being removed.
-- ozzie-generate-plan already works around this by manually NULLing
-- session_id before deleting sessions (see index.ts); this migration makes
-- that safe by default for any other delete path.

ALTER TABLE workout_logs
  DROP CONSTRAINT IF EXISTS workout_logs_session_id_fkey,
  ADD CONSTRAINT workout_logs_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;

ALTER TABLE plan_adjustments
  DROP CONSTRAINT IF EXISTS plan_adjustments_session_id_fkey,
  ADD CONSTRAINT plan_adjustments_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;

ALTER TABLE plan_adjustments
  DROP CONSTRAINT IF EXISTS plan_adjustments_plan_id_fkey,
  ADD CONSTRAINT plan_adjustments_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE SET NULL;
