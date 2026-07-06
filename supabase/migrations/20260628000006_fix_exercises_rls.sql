-- ============================================================
-- OSPREY 006 — Disable RLS on exercises
-- exercises is a shared reference table (no user_id column) —
-- same category as food_items, which never had RLS either.
-- Something (likely a Supabase dashboard security prompt) enabled
-- RLS on it with zero policies, silently hiding all 12 seeded rows
-- from every role except the table owner. GRANT SELECT alone
-- can't fix this — RLS with no policy denies everyone.
-- ============================================================

ALTER TABLE exercises DISABLE ROW LEVEL SECURITY;
