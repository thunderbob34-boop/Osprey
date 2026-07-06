-- ============================================================
-- OSPREY 002 — Fix RLS grants (run in Supabase SQL Editor)
-- Fixes: "permission denied for table users"
-- ============================================================

-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Table-level grants for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_logs TO authenticated;
GRANT SELECT, INSERT ON exercise_sets TO authenticated;
GRANT SELECT, INSERT ON activity_logs TO authenticated;
GRANT SELECT, INSERT ON ozzie_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE ON recovery_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON load_scores TO authenticated;
GRANT SELECT ON exercises TO authenticated;

-- Views
GRANT SELECT ON v_daily_summary TO authenticated;

-- ── users: replace single policy with explicit CRUD policies ──
DROP POLICY IF EXISTS users_self ON users;

CREATE POLICY users_select ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY users_insert ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY users_update ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── user_goals: add INSERT/UPDATE policies ──
DROP POLICY IF EXISTS user_goals_self ON user_goals;

CREATE POLICY user_goals_select ON user_goals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_goals_insert ON user_goals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_goals_update ON user_goals
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── user_preferences: add INSERT/UPDATE policies ──
DROP POLICY IF EXISTS user_prefs_self ON user_preferences;

CREATE POLICY user_prefs_select ON user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_prefs_insert ON user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_prefs_update ON user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── v_daily_summary: run as invoker so underlying RLS applies ──
ALTER VIEW v_daily_summary SET (security_invoker = true);
