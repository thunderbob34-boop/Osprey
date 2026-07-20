-- 20260720000004_saved_routes_schema_drift.sql
-- Production's saved_routes table was never actually migrated to the
-- tags/notes schema that 20260703000023_saved_routes.sql (and the app code
-- in OSPREY-app/src/services/routes.ts) expects — it still has the old
-- surface/gpx_url/start_lat/start_lon/is_public/deleted_at columns from the
-- dead duplicate CREATE TABLE that 001 used to have (removed in
-- 20260720000004's sibling migrations). That means every saved-routes
-- read/write in the live app is currently failing with "column does not
-- exist". saved_routes was empty in production at the time this was
-- written, so this is a pure schema correction, no data migration needed.
-- Written idempotently (IF EXISTS/IF NOT EXISTS) so it's also a no-op on a
-- fresh install where 023 already created the correct schema directly.
-- saved_routes_select used to allow is_public = true rows through; drop it
-- (and the other old-schema policies) before the column drop below, since
-- saved_routes_select depends on is_public. Collapse all four into one
-- user-owns-it policy matching 023's original intent.
DROP POLICY IF EXISTS saved_routes_select ON saved_routes;
DROP POLICY IF EXISTS saved_routes_insert ON saved_routes;
DROP POLICY IF EXISTS saved_routes_update ON saved_routes;
DROP POLICY IF EXISTS saved_routes_delete ON saved_routes;
DROP POLICY IF EXISTS saved_routes_self ON saved_routes;

ALTER TABLE saved_routes
  DROP COLUMN IF EXISTS surface,
  DROP COLUMN IF EXISTS gpx_url,
  DROP COLUMN IF EXISTS start_lat,
  DROP COLUMN IF EXISTS start_lon,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS deleted_at,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_saved_routes_user ON saved_routes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_routes_tags ON saved_routes USING GIN(tags);

CREATE POLICY saved_routes_self ON saved_routes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT ALL ON saved_routes TO service_role;
