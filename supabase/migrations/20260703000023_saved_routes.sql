-- 023_saved_routes.sql
-- Saved routes with tags — the pragmatic AllTrails substitute. A user-curated
-- list of their own go-to routes (shaded, trail, indoor track, etc.) so the
-- weather coach can recommend from real, known-good options on hot/rainy
-- days instead of generic "find some shade" advice.

CREATE TABLE saved_routes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  distance_km  NUMERIC(6,2),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_routes_user ON saved_routes(user_id, created_at DESC);
-- GIN index so "find my routes tagged shaded/indoor" stays fast as the list grows.
CREATE INDEX idx_saved_routes_tags ON saved_routes USING GIN(tags);

CREATE TRIGGER saved_routes_updated_at BEFORE UPDATE ON saved_routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_routes TO authenticated;
GRANT ALL ON saved_routes TO service_role;

CREATE POLICY saved_routes_self ON saved_routes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
