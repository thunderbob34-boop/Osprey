import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/ErrorPanel';
import { toDateInputValue } from '../../lib/day';
import { macrosFor } from '../../lib/macros';
import type { FoodItem, MealType } from '../../lib/schemas';
import { MEAL_LABEL } from '../../lib/format';
import { useFoodSearch } from '../../features/nutrition/queries';
import {
  recipePerServing, recipeTotals, useAddIngredient, useLogRecipeServing,
  useRecipe, useRemoveIngredient, useUpdateIngredient, useUpdateRecipe,
} from '../../features/nutrition/recipes';

function IngredientSearch({ onPick }: { onPick: (f: FoodItem) => void }) {
  const [term, setTerm] = useState('');
  const search = useFoodSearch(term);
  return (
    <div className="field" style={{ position: 'relative', maxWidth: 360 }}>
      <input placeholder="Search foods to add an ingredient…" value={term} onChange={(e) => setTerm(e.target.value)} />
      {term.trim().length >= 2 && (
        <ul className="exercise-dropdown">
          {(search.data ?? []).map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { onPick(f); setTerm(''); }}>
                {f.name}<span className="muted"> · {f.calories_per_100g ?? '—'} kcal/100g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Builder() {
  const { userId } = Route.useRouteContext();
  const { recipeId } = Route.useParams();
  const recipe = useRecipe(recipeId);
  const update = useUpdateRecipe(recipeId);
  const addIng = useAddIngredient(recipeId);
  const updIng = useUpdateIngredient(recipeId);
  const rmIng = useRemoveIngredient(recipeId);
  const logServing = useLogRecipeServing(userId);
  const [logMeal, setLogMeal] = useState<MealType>('breakfast');
  const [logServings, setLogServings] = useState('1');

  if (recipe.isError) return <ErrorPanel error={recipe.error as Error} onRetry={() => void recipe.refetch()} />;
  if (!recipe.data) return <p className="loading-line">Loading…</p>;
  const r = recipe.data;
  const hasIngredients = r.user_recipe_ingredients.length > 0;
  const per = hasIngredients ? recipePerServing(r) : null;
  const totals = hasIngredients ? recipeTotals(r) : null;
  const servingsToLog = Number(logServings);
  const canLog = hasIngredients && Number.isFinite(servingsToLog) && servingsToLog > 0 && !logServing.isPending;

  return (
    <>
      <PageHeader
        eyebrow="Nutrition · Recipes"
        title={<>{r.name.split(' ').slice(0, -1).join(' ') || r.name} {r.name.includes(' ') && <span className="amber">{r.name.split(' ').at(-1)}</span>}</>}
        actions={<Link to="/nutrition/recipes" className="btn ghost small">← All recipes</Link>}
      />

      <div className="builder-layout">
        <div className="builder-main">
          <div className="quick-add" style={{ marginBottom: 20 }}>
            <div className="field grow">
              <label htmlFor="r-name">Recipe name</label>
              <input id="r-name" defaultValue={r.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== r.name) void update.mutateAsync({ name: e.target.value.trim() }); }} />
            </div>
            <div className="field qty-field">
              <label htmlFor="r-servings">Servings</label>
              <input id="r-servings" inputMode="numeric" defaultValue={String(r.servings)}
                onBlur={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n > 0 && n !== r.servings) void update.mutateAsync({ servings: n }); }} />
            </div>
          </div>

          <div className="card" style={{ padding: '6px 0 14px' }}>
            <table className="activity-table">
              <thead>
                <tr><th>Ingredient</th><th className="num">Qty (g)</th><th className="num">Kcal</th><th className="num">P</th><th className="num">C</th><th className="num">F</th><th aria-label="actions" /></tr>
              </thead>
              <tbody>
                {r.user_recipe_ingredients.map((i) => {
                  const im = macrosFor({ quantityG: i.quantity_g, per100g: { calories: i.food_items.calories_per_100g, proteinG: i.food_items.protein_g, carbsG: i.food_items.carbs_g, fatG: i.food_items.fat_g } });
                  return (
                  <tr key={i.id}>
                    <td>{i.food_items.name}</td>
                    <td className="num">
                      <input style={{ width: 80, textAlign: 'right' }} inputMode="decimal" defaultValue={String(i.quantity_g)}
                        onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0 && n !== i.quantity_g) void updIng.mutateAsync({ ingredientId: i.id, quantityG: n }); }} />
                    </td>
                    <td className="num">{im.calories}</td>
                    <td className="num">{im.proteinG}g</td>
                    <td className="num">{im.carbsG}g</td>
                    <td className="num">{im.fatG}g</td>
                    <td className="num">
                      <button className="icon-btn" type="button" aria-label={`Remove ${i.food_items.name}`} onClick={() => void rmIng.mutateAsync(i.id)}>✕</button>
                    </td>
                  </tr>
                  );
                })}
                <tr>
                  <td colSpan={7} style={{ padding: '12px 16px' }}>
                    <IngredientSearch onPick={(f) => void addIng.mutateAsync({ foodItemId: f.id, quantityG: 100 })} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {!hasIngredients && <p className="grid-hint">Add at least one ingredient to enable serving logging.</p>}
        </div>

        <aside className="builder-aside">
          <div className="per-serving">
            <div className="num">{per ? per.calories : '—'}</div>
            <div className="lab">kcal per serving · makes {r.servings}</div>
            <div className="rows">
              <div className="r"><span>Protein</span><span>{per ? `${per.proteinG}g` : '—'}</span></div>
              <div className="r"><span>Carbs</span><span>{per ? `${per.carbsG}g` : '—'}</span></div>
              <div className="r"><span>Fat</span><span>{per ? `${per.fatG}g` : '—'}</span></div>
              <div className="r"><span>Total</span><span>{totals ? `${totals.calories} kcal` : '—'}</span></div>
            </div>
            <div className="log-form" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="field">
                <label htmlFor="log-servings">Servings</label>
                <input id="log-servings" inputMode="decimal" value={logServings} onChange={(e) => setLogServings(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="log-meal">Meal</label>
                <select id="log-meal" value={logMeal} onChange={(e) => setLogMeal(e.target.value as MealType)}>
                  {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
                </select>
              </div>
            </div>
            {logServing.isError && <p className="err-line" role="alert" style={{ marginTop: 10 }}>{(logServing.error as Error).message}</p>}
            {logServing.isSuccess && <p className="grid-hint" style={{ marginTop: 10 }}>Logged ✓</p>}
            <button
              className="btn small" type="button" style={{ width: '100%', marginTop: 12 }} disabled={!canLog}
              onClick={() => void logServing.mutateAsync({ recipe: r, servings: servingsToLog, mealType: logMeal, dateStr: toDateInputValue(new Date()) })}
            >
              {logServing.isPending ? 'Logging…' : 'Log a serving'}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/nutrition/recipes/$recipeId')({ component: Builder });
