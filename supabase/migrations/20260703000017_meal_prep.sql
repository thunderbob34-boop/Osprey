-- ============================================================
-- OSPREY 017 — Meal prep, budget, and grocery list
-- Ozzie generates a day of meals matching the athlete's real macro
-- target (nutrition_targets) and that day's training session, within
-- the user's grocery budget. Meals are stored per user per date;
-- grocery items are stored per week with a `checked` flag the store
-- checklist UI toggles. Budget prefs live on user_preferences.
-- ============================================================

-- ── Budget preferences ─────────────────────────────────────────────
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS grocery_budget_amount NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS grocery_budget_period TEXT
    CHECK (grocery_budget_period IN ('weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS dietary_notes TEXT;

-- ── meal_plan_days ─────────────────────────────────────────────────
-- One generated meal plan per user per date. `meals` holds the full
-- structured plan (name, description, per-meal macros, est. cost) as
-- validated JSON from the ozzie-meal-prep edge function; regenerating
-- for the same date overwrites the row.

CREATE TABLE meal_plan_days (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date          DATE NOT NULL,
  meals              JSONB NOT NULL,
  target_calories    INT,
  target_protein_g   INT,
  target_carbs_g     INT,
  target_fat_g       INT,
  est_total_cost     NUMERIC(8,2),
  budget_per_day     NUMERIC(8,2),
  session_type       TEXT,
  ozzie_note         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

CREATE INDEX idx_meal_plan_days_user_date ON meal_plan_days(user_id, plan_date);

CREATE TRIGGER meal_plan_days_updated_at BEFORE UPDATE ON meal_plan_days
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE meal_plan_days ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_days TO authenticated;
GRANT ALL ON meal_plan_days TO service_role;

CREATE POLICY meal_plan_days_self ON meal_plan_days
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── grocery_items ──────────────────────────────────────────────────
-- Consolidated shopping list, keyed by the Monday of the week it was
-- generated for. `checked` is the in-store checkbox state; it must
-- survive regeneration of the same week's list, so the edge function
-- upserts on (user_id, week_of, name) and leaves `checked` alone for
-- rows that already exist.

CREATE TABLE grocery_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_of      DATE NOT NULL,
  name         TEXT NOT NULL,
  quantity     TEXT,
  category     TEXT,
  est_cost     NUMERIC(7,2),
  checked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_of, name)
);

CREATE INDEX idx_grocery_items_user_week ON grocery_items(user_id, week_of);

CREATE TRIGGER grocery_items_updated_at BEFORE UPDATE ON grocery_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON grocery_items TO authenticated;
GRANT ALL ON grocery_items TO service_role;

CREATE POLICY grocery_items_self ON grocery_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
