-- 20260713000002_recipes_and_web_nutrition_grants.sql
-- Phase 2 Nutrition Desk (webapp): recipes as reusable ingredient groups.
-- A recipe's per-serving macros are always computed client-side (lib/macros.ts),
-- never stored here. Logging a serving inserts one food_log_entries row that
-- references an immutable "shadow" food_items row (source='recipe') tracked by
-- shadow_food_item_id — re-created (not updated) when the recipe changes, so no
-- UPDATE grant is needed on the shared food_items table and old log entries keep
-- the values they were logged with.

CREATE TABLE user_recipes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  servings              SMALLINT NOT NULL DEFAULT 1 CHECK (servings > 0),
  shadow_food_item_id   UUID REFERENCES food_items(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_recipes_user ON user_recipes(user_id);

CREATE TABLE user_recipe_ingredients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
  food_item_id  UUID NOT NULL REFERENCES food_items(id),
  quantity_g    NUMERIC(6,1) NOT NULL CHECK (quantity_g > 0)
);
CREATE INDEX idx_user_recipe_ingredients_recipe ON user_recipe_ingredients(recipe_id);

ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_recipes_self ON user_recipes
  USING (user_id = auth.uid());

CREATE POLICY user_recipe_ingredients_via_recipe ON user_recipe_ingredients
  USING (recipe_id IN (SELECT id FROM user_recipes WHERE user_id = auth.uid()));

-- RLS restricts rows; it does not substitute for base grants (see
-- 20260712000033_exercise_sets_write_grants.sql for the precedent).
GRANT SELECT, INSERT, UPDATE, DELETE ON user_recipes TO authenticated;
GRANT SELECT, INSERT, DELETE ON user_recipe_ingredients TO authenticated;
GRANT UPDATE (quantity_g) ON user_recipe_ingredients TO authenticated;

-- The web day-log has a per-entry delete control; nothing granted DELETE on
-- food_log_entries before now (mobile only inserts). RLS policy food_log_self
-- already covers ALL commands.
GRANT DELETE ON food_log_entries TO authenticated;

-- TRUNCATE is not governed by RLS. New tables inherit Postgres's default
-- "grant all on create" TRUNCATE for anon/authenticated; revoke it to match
-- the project-wide convention established in 20260710000032_revoke_truncate_grants.sql.
REVOKE TRUNCATE ON user_recipes, user_recipe_ingredients FROM anon, authenticated;
