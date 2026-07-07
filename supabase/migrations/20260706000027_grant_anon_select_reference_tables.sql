-- ============================================================
-- OSPREY 027 — Grant anon SELECT on public reference tables
-- exercises and food_items are shared reference tables with RLS
-- disabled (006, 007), but only `authenticated` was ever granted
-- SELECT (002, 004). Postgres denies by default regardless of RLS
-- status, so any anon-role query (pre-auth screens, a future public
-- preview, or a bare PostgREST call with only the anon key) gets
-- 42501 permission denied.
-- ============================================================

GRANT SELECT ON exercises  TO anon;
GRANT SELECT ON food_items TO anon;
