# Osprey Web App — Phase 2 (Nutrition Desk) Design Spec

Date: 2026-07-13
Status: approved (design walkthrough with user, sections approved individually)
Predecessor: `2026-07-12-osprey-webapp-phase1-design.md` (Foundation + Workout Desk — shipped)

## 1. Product intent

Close the largest webapp-vs-mobile feature gap: food logging, macro targets vs. actuals, and recipes on the web dashboard. This is the second of the three remaining phases (Nutrition → Ozzie → Dashboard) toward a web app that feels complete enough to anchor the OspreyFitness brand and justify purchasing the production domain.

Recipes are the one net-new capability — they exist nowhere today (no table, no mobile UI). Everything else builds on live backend pieces already used by the mobile app: `food_items`, `food_log_entries`, `nutrition_targets`, and the `ozzie-nutrition-coach` edge function.

## 2. Chosen approach: recipe-as-virtual-food-item

A recipe is a named, per-user group of `food_items` ingredients with a servings count. Its per-serving macros are **computed, never stored** (sum ingredient macros from quantities ÷ servings), so edits can't leave stale cached numbers.

Logging a serving inserts **one row into the existing `food_log_entries` table** carrying the computed per-serving macros, exactly like logging any single food. The entry's `food_item_id` points at a lightweight auto-created `food_items` row (`source = 'recipe'`, tracked via `recipes.shadow_food_item_id`) so the FK stays valid and the entry renders under the recipe's name. Shadow rows are **immutable snapshots**: if the recipe's name or per-serving macros have changed since the shadow was created, a new shadow row is created and `shadow_food_item_id` repointed (old entries keep the values they were logged with) — this avoids granting `UPDATE` on the shared `food_items` table.

Why this over ingredient-expansion (one log row per ingredient, grouped in UI): zero changes to the shared `ozzie-nutrition-coach` function or any aggregation the mobile app depends on — no cross-surface regression risk. Trade-off accepted: the day log shows "Chili × 2 servings" as one line rather than itemized ingredients, which matches how mobile's daily summary already treats entries.

## 3. Data model (new migration)

```sql
CREATE TABLE recipes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  servings              SMALLINT NOT NULL DEFAULT 1 CHECK (servings > 0),
  shadow_food_item_id   UUID REFERENCES food_items(id),  -- lazily created on first log; see § 2
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_item_id  UUID NOT NULL REFERENCES food_items(id),
  quantity_g    NUMERIC(6,1) NOT NULL CHECK (quantity_g > 0)
);
```

- RLS: `recipes` scoped `user_id = auth.uid()` for ALL commands; `recipe_ingredients` scoped through parent recipe ownership (EXISTS subquery). Follow the repo's established policy style.
- **Base grants:** explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON recipes, recipe_ingredients TO authenticated` in the same migration. Missing base grants (RLS correct, grant absent) have bitten twice before (`exercise_sets`, `ozzie_insights`) — do not rely on defaults.
- The recipe's shadow `food_items` row: `name = recipe name`, per-100g macros derived from per-serving values normalized to 100 g equivalents is NOT attempted — instead `quantity_g` on the log entry is set to `100 × servings_logged` and per-100g macros on the shadow item are set to the per-serving macros, making `quantity/100 × per100g = servings × perServing` hold. The log entry also stores the final computed macros directly in its own macro columns (as mobile already does), so downstream aggregation never recomputes from the shadow item.
- Index: `recipes(user_id)`, `recipe_ingredients(recipe_id)`.

## 4. Routes & surfaces

New NavRail entry **Nutrition** → three routes in the `_authed` layout:

### 4.1 `/nutrition` — Fuel Desk (index)
- **Targets band** (top): calories headline + protein/carbs/fat bars with fill and target marker — direct adaptation of the marketing-site nutrition mockup (`website/src/scripts/showcase.ts` nutrition screen) to app.css components. Data: `nutrition_targets` row + summed `food_log_entries` for the viewed day. Ozzie tip line beneath, from `ozzie-nutrition-coach`.
- **Quick-add bar**: debounced type-ahead search over `food_items` (ilike, limit 15, staleness-guarded), then quantity (g) + meal type → insert. Includes a "can't find it? add manually" escape hatch: name + per-100g macros → insert into `food_items` (`source: 'manual'`), then proceed to log.
- **Day log**: entries grouped breakfast / lunch / dinner / snack; each row shows name, quantity, kcal + macros, delete action.
- **Date switcher** (‹ date ›): view and edit any past day; "today" is default.

### 4.2 `/nutrition/recipes` — recipe list
Name, servings, computed per-serving kcal/macros per card; create button; per-recipe actions: edit, delete, "Log a serving."

### 4.3 `/nutrition/recipes/$recipeId` — recipe builder
Name field, servings count, ingredient rows (same food type-ahead + quantity_g each, add/remove), live-computed totals and per-serving macros updating as ingredients change. "Log a serving" from here too: prompts servings count (default 1) + meal type → the § 2 insert flow.

Visual language: existing app.css system throughout (rail, PageHeader, stat band, 2 px hard borders, tabular-nums for all numbers). No new design tokens.

## 5. Data layer & code structure

- `src/features/nutrition/queries.ts` — `useDayLog(userId, date)` (grouped by meal; day boundaries are **local-day**, matching the `logging.ts`/`calendar.ts` convention on mobile — never `toISOString().slice()`), `useNutritionCoaching()` (edge-function invoke, same contract as mobile's `fetchNutritionCoaching`), `useFoodSearch(query)` (debounced + request-id staleness guard, mirroring existing search hooks; filters `source != 'recipe'` so shadow rows never surface), `useLogFood()`, `useDeleteLogEntry()`, `useAddManualFood()`.
- `src/features/nutrition/recipes.ts` — `useRecipes(userId)`, `useRecipe(recipeId)` (ingredients joined), `useCreateRecipe()`, `useUpdateRecipe()`, `useDeleteRecipe()`, `useLogRecipeServing()` (ensures/updates the shadow `food_items` row, then inserts the log entry).
- `src/lib/macros.ts` — pure functions, no Supabase imports: `sumIngredientMacros(ingredients)`, `perServing(totals, servings)`, `targetsProgress(logged, targets)`, rounding rules (0.1 g / 1 kcal). All macro math lives here and only here.
- Zod schemas for `recipes`, `recipe_ingredients`, and nutrition rows added to `src/lib/schemas.ts`; zod enums must match DB values exactly (meal_type strings).
- React Query invalidation: logging/deleting invalidates `['day-log']` and `['nutrition-coaching']`; recipe edits invalidate `['recipes']` / `['recipe', id]`.

## 6. Error handling & degraded states

- All surfaces use existing `ErrorPanel` / `EmptyState` components.
- No entries for the day → "Nothing logged today" empty state pointing at the quick-add.
- No `nutrition_targets` row (possible for users who never opened mobile nutrition) → callout explaining targets come from Ozzie, with a "refresh targets" action that invokes `ozzie-nutrition-coach` (which computes/returns targets) and retries.
- `ozzie-nutrition-coach` failure degrades gracefully: targets band still renders from `nutrition_targets` + client-summed entries; only the tip line is dropped. The desk must never be blocked by the edge function.
- Recipe with zero ingredients: valid to save (draft), but "Log a serving" is disabled with an inline reason.

## 7. Testing & verification

- `tests/macros.test.ts` — summing across ingredients, per-serving division, rounding, zero/missing-macro ingredients (null protein etc.), zero-servings guard (schema-level, CHECK > 0).
- Schema tests for new zod types in the existing `tests/schemas.test.ts` pattern.
- **Early smoke task (before any UI):** from the web client with the real account — insert/update/delete a `recipes` + `recipe_ingredients` row, and invoke `ozzie-nutrition-coach`. Catches RLS/grant gaps up front.
- Live verification at the end (established Phase 1 pattern): real account, log a food + a recipe serving, confirm rows via SQL round-trip, confirm targets band matches, then clean up test rows. `npm run typecheck`, `npm test`, `npm run build` all green.

## 8. Out of scope (explicit)

Barcode scanning (needs camera; mobile-only); meal-photo AI logging; editing `nutrition_targets` by hand (Ozzie owns targets); recipe sharing/public recipes; recipe photos; micronutrients; copying a day's log; mobile app adoption of recipes (designed to be adoptable later via the same tables, but no mobile work in this phase); any change to `ozzie-nutrition-coach`; offline support.

## 9. Risks & mitigations

- **Missing base grants on new tables** → grants are in the migration itself + the early smoke task proves writes before UI exists.
- **Shadow food_items rows appearing in other users' search results** — `food_items` is a shared/global table with permissive read. Mitigation: quick-add search filters `source != 'recipe'`; shadow rows are only referenced via FK, never searched. (Their names leaking cross-user via search was the concern; filtering by source closes it.)
- **Per-serving math drift between builder preview and logged values** → both use the same `lib/macros.ts` functions; forbidden to reimplement inline.
- **`ozzie-nutrition-coach` contract drift** (it may return targets computed server-side that differ from the `nutrition_targets` row) → the web treats the edge function's response as display-authoritative when available, falling back to the raw row only when the function fails — same precedence mobile uses.
