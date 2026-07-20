-- 20260720000002_session_fk_on_delete_set_null.sql
-- workout_logs.session_id, plan_adjustments.session_id, and
-- plan_adjustments.plan_id all reference training_sessions/training_plans
-- with no ON DELETE clause (defaults to RESTRICT), so deleting a session or
-- plan that's still referenced fails with an FK violation. ozzie-generate-plan
-- already works around this at the application level by manually nulling out
-- workout_logs.session_id / plan_adjustments.session_id before deleting
-- sessions (see the comment above that block in
-- supabase/functions/ozzie-generate-plan/index.ts) — push that detach logic
-- down into the schema so every caller gets it for free.
ALTER TABLE workout_logs
  DROP CONSTRAINT workout_logs_session_id_fkey,
  ADD CONSTRAINT workout_logs_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;

ALTER TABLE plan_adjustments
  DROP CONSTRAINT plan_adjustments_session_id_fkey,
  ADD CONSTRAINT plan_adjustments_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;

ALTER TABLE plan_adjustments
  DROP CONSTRAINT plan_adjustments_plan_id_fkey,
  ADD CONSTRAINT plan_adjustments_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE SET NULL;
