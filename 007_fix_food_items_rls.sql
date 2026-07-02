-- ============================================================
-- OSPREY 007 — Disable RLS on food_items
-- Same issue as exercises (006): food_items is a shared reference
-- table (no user_id column), but RLS was enabled on it with zero
-- policies, blocking every INSERT/SELECT for non-owner roles.
-- ============================================================

ALTER TABLE food_items DISABLE ROW LEVEL SECURITY;
