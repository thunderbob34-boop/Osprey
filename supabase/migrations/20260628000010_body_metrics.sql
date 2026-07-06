-- ============================================================
-- OSPREY 010 — Body metrics (weight log)
-- Daily weight (and optional body-fat) readings. Feeds the nutrition
-- coach so calorie/macro targets auto-adjust to the user's actual weight
-- trend vs. their goal, instead of a fixed bodyweight-agnostic heuristic.
-- One reading per day per user (upsert on conflict).
-- ============================================================

CREATE TABLE body_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg     NUMERIC(5,2),
  body_fat_pct  NUMERIC(4,1),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, recorded_on)
);

CREATE INDEX idx_body_metrics_user ON body_metrics(user_id, recorded_on DESC);

CREATE TRIGGER body_metrics_updated_at BEFORE UPDATE ON body_metrics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON body_metrics TO authenticated;
-- ozzie-nutrition-coach reads this via the service role to compute the
-- weight trend; service_role bypasses RLS but still needs a base GRANT.
GRANT ALL ON body_metrics TO service_role;

CREATE POLICY body_metrics_self ON body_metrics
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
