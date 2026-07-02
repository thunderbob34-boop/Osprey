-- ============================================================
-- OSPREY 003 — Fix RLS grants for nutrition_targets
-- Fixes: "permission denied for table nutrition_targets"
-- (v_daily_summary joins nutrition_targets but 002 never granted it)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON nutrition_targets TO authenticated;

DROP POLICY IF EXISTS nutrition_targets_self ON nutrition_targets;

CREATE POLICY nutrition_targets_select ON nutrition_targets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY nutrition_targets_insert ON nutrition_targets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY nutrition_targets_update ON nutrition_targets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
