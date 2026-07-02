-- ============================================================
-- OSPREY 008 — Grant service_role on tables the Edge Functions write to
-- service_role bypasses RLS but still needs base table GRANTs in
-- Postgres. Tables created via our custom migrations never got an
-- explicit GRANT to service_role (only `authenticated` was covered).
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
