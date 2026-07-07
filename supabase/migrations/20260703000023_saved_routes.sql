-- 023_saved_routes.sql
-- Saved routes with tags — the pragmatic AllTrails substitute. A user-curated
-- list of their own go-to routes (shaded, trail, indoor track, etc.) so the
-- weather coach can recommend from real, known-good options on hot/rainy
-- days instead of generic "find some shade" advice.
--
-- `saved_routes` already exists (created in 001_initial_schema.sql, RLS
-- added in 004_fix_remaining_rls.sql) with a GPS-route-focused schema
-- (surface, gpx_url, start_lat/lon, is_public) but no tags/notes. This
-- migration originally re-issued a bare CREATE TABLE, which errors with
-- "relation already exists" against the table 001 already created — fixed
-- to extend the existing table instead.

ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS tags  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS notes TEXT;

-- GIN index so "find my routes tagged shaded/indoor" stays fast as the list grows.
CREATE INDEX IF NOT EXISTS idx_saved_routes_tags ON saved_routes USING GIN(tags);
