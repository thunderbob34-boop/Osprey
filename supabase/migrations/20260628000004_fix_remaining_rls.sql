-- ============================================================
-- OSPREY 004 — Fix RLS grants for all remaining tables
-- 001 enabled RLS + wrote policies for these tables, but never
-- granted table privileges to `authenticated` (Postgres denies by
-- default regardless of RLS policies until GRANT is issued).
-- Also fixes two tables 001 missed entirely: friendships, saved_routes.
-- ============================================================

-- ── Tables with existing 001 policies that just need grants ──
GRANT SELECT, INSERT, UPDATE, DELETE ON training_plans      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_weeks      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_sessions   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON food_log_entries    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wearable_events     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON soreness_logs       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gear_items          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gear_session_links  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON race_events         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_adjustments    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_shares     TO authenticated;
GRANT SELECT, INSERT, DELETE         ON kudos               TO authenticated;

-- ── food_items: shared reference table (no user_id, no RLS needed) ──
GRANT SELECT, INSERT ON food_items TO authenticated;

-- ── friendships: 001 never enabled RLS or wrote a policy for this one ──
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON friendships TO authenticated;

CREATE POLICY friendships_select ON friendships
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY friendships_insert ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY friendships_update ON friendships
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid())
  WITH CHECK (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY friendships_delete ON friendships
  FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- saved_routes: RLS/grants/policy are set up in migration
-- 20260703000023_saved_routes.sql, which creates the table itself. This
-- file used to duplicate that setup against 001's now-removed schema
-- (referencing a since-removed is_public column that 023's schema
-- never had).
