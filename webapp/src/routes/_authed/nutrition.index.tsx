import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorPanel } from '../../components/ErrorPanel';
import { targetsProgress, type Macros, type Per100g } from '../../lib/macros';
import { addDays, toDateInputValue } from '../../lib/day';
import type { FoodItem, MealType } from '../../lib/schemas';
import {
  MEAL_ORDER, sumDay, useAddManualFood, useDayLog, useDeleteLogEntry,
  useFoodSearch, useLogFood, useNutritionCoaching, useNutritionTargets, type DayLogEntry,
} from '../../features/nutrition/queries';

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

function MacroBar({ label, logged, target, pct }: { label: string; logged: number; target: number | null; pct: number }) {
  return (
    <div className="macro">
      <div className="m-head">
        <span>{label}</span>
        <span><b>{logged}</b>{target != null ? ` / ${target}g` : 'g'}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
        {target != null && <div className="target" />}
      </div>
    </div>
  );
}

function FuelBand({ logged, target, dayTypeLabel }: { logged: Macros; target: Partial<Macros> | null; dayTypeLabel: string | null }) {
  const p = targetsProgress(logged, target);
  return (
    <div className="fuel-band">
      <div className="fuel-cal">
        <div className="num">{logged.calories.toLocaleString()}</div>
        <div className="of">{p.calories.target != null ? `/ ${p.calories.target.toLocaleString()} kcal` : 'kcal'}</div>
        <div className="lab">Calories{dayTypeLabel ? ` · ${dayTypeLabel}` : ''}</div>
      </div>
      <div className="fuel-macros">
        <MacroBar label="Protein" {...p.protein} />
        <MacroBar label="Carbs" {...p.carbs} />
        <MacroBar label="Fat" {...p.fat} />
      </div>
    </div>
  );
}

function QuickAdd({ userId, dateStr }: { userId: string; dateStr: string }) {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [qty, setQty] = useState('100');
  const [meal, setMeal] = useState<MealType>('breakfast');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const search = useFoodSearch(selected ? '' : term);
  const logFood = useLogFood(userId);
  const addManual = useAddManualFood();

  const quantityG = Number(qty);
  const canLog = selected != null && Number.isFinite(quantityG) && quantityG > 0 && !logFood.isPending;

  async function submitManual() {
    const per100g: Per100g = {
      calories: manual.calories === '' ? null : Number(manual.calories),
      proteinG: manual.protein === '' ? null : Number(manual.protein),
      carbsG: manual.carbs === '' ? null : Number(manual.carbs),
      fatG: manual.fat === '' ? null : Number(manual.fat),
    };
    const food = await addManual.mutateAsync({ name: manual.name.trim(), per100g });
    setSelected(food); setTerm(food.name); setManualOpen(false);
  }

  return (
    <>
      <div className="quick-add">
        <div className="field grow">
          <label htmlFor="food-search">Add food</label>
          <input
            id="food-search" autoComplete="off" placeholder="Search foods…" value={term}
            onChange={(e) => { setTerm(e.target.value); setSelected(null); setManualOpen(false); }}
          />
          {!selected && term.trim().length >= 2 && (
            <ul className="exercise-dropdown">
              {(search.data ?? []).map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => { setSelected(f); setTerm(f.name); }}>
                    {f.name}{f.brand ? ` (${f.brand})` : ''}
                    <span className="muted"> · {f.calories_per_100g ?? '—'} kcal/100g</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="muted" onClick={() => setManualOpen(true)}>
                  Can't find it? Add manually →
                </button>
              </li>
            </ul>
          )}
        </div>
        <div className="field qty-field">
          <label htmlFor="food-qty">Qty (g)</label>
          <input id="food-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="field meal-field">
          <label htmlFor="food-meal">Meal</label>
          <select id="food-meal" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
            {MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
          </select>
        </div>
        <button
          className="btn" type="button" disabled={!canLog}
          onClick={() => {
            if (!selected) return;
            logFood.mutate(
              { food: selected, quantityG, mealType: meal, dateStr },
              { onSuccess: () => { setTerm(''); setSelected(null); setQty('100'); } },
            );
          }}
        >
          {logFood.isPending ? 'Logging…' : 'Log it'}
        </button>
      </div>
      {logFood.isError && <p className="err-line" role="alert">{(logFood.error as Error).message}</p>}

      {manualOpen && (
        <div className="card" style={{ maxWidth: 640, marginBottom: 28 }}>
          <div className="log-form">
            <div className="field span-full">
              <label htmlFor="m-name">Food name</label>
              <input id="m-name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            </div>
            <div className="field"><label htmlFor="m-kcal">Kcal /100g</label>
              <input id="m-kcal" inputMode="decimal" value={manual.calories} onChange={(e) => setManual({ ...manual, calories: e.target.value })} /></div>
            <div className="field"><label htmlFor="m-p">Protein g</label>
              <input id="m-p" inputMode="decimal" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} /></div>
            <div className="field"><label htmlFor="m-c">Carbs g</label>
              <input id="m-c" inputMode="decimal" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} /></div>
            <div className="field"><label htmlFor="m-f">Fat g</label>
              <input id="m-f" inputMode="decimal" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} /></div>
          </div>
          {addManual.isError && <p className="err-line" role="alert">{(addManual.error as Error).message}</p>}
          <div className="log-form-actions">
            <button className="btn" type="button" disabled={manual.name.trim() === '' || addManual.isPending} onClick={() => void submitManual()}>
              {addManual.isPending ? 'Saving…' : 'Save food'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DayLogTable({ entries, onDelete }: { entries: DayLogEntry[]; onDelete: (id: string) => void }) {
  const groups = MEAL_ORDER.map((m) => ({
    meal: m,
    rows: entries.filter((e) => e.meal_type === m || (m === 'snack' && e.meal_type === null)),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="card" style={{ padding: '6px 0 14px' }}>
      <table className="activity-table">
        <thead>
          <tr><th>Food</th><th className="num">Qty</th><th className="num">Kcal</th><th className="num">P</th><th className="num">C</th><th className="num">F</th><th aria-label="actions" /></tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <FragmentGroup key={g.meal} meal={g.meal} rows={g.rows} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentGroup({ meal, rows, onDelete }: { meal: MealType; rows: DayLogEntry[]; onDelete: (id: string) => void }) {
  return (
    <>
      <tr className="meal-head"><td colSpan={7}>{MEAL_LABEL[meal]}</td></tr>
      {rows.map((e) => {
        const isRecipe = e.food_items.source === 'recipe';
        return (
          <tr key={e.id}>
            <td>
              {e.food_items.name}
              {isRecipe && <span className="badge amber" style={{ marginLeft: 8 }}>Recipe × {e.quantity_g / 100}</span>}
            </td>
            <td className="num">{isRecipe ? `${e.quantity_g / 100} srv` : `${e.quantity_g}g`}</td>
            <td className="num">{Math.round(e.calories ?? 0)}</td>
            <td className="num">{e.protein_g ?? 0}g</td>
            <td className="num">{e.carbs_g ?? 0}g</td>
            <td className="num">{e.fat_g ?? 0}g</td>
            <td className="num">
              <button className="icon-btn" type="button" aria-label={`Delete ${e.food_items.name}`} onClick={() => onDelete(e.id)}>✕</button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function FuelDesk() {
  const { userId } = Route.useRouteContext();
  const today = toDateInputValue(new Date());
  const [dateStr, setDateStr] = useState(today);
  const isToday = dateStr === today;

  const dayLog = useDayLog(userId, dateStr);
  const targetsRow = useNutritionTargets(userId);
  const coaching = useNutritionCoaching(isToday);
  const del = useDeleteLogEntry(userId);

  const logged = sumDay(dayLog.data ?? []);
  // Coaching is only meaningful for today; ignore any cached response on past dates.
  const coachingData = isToday ? coaching.data : undefined;
  // Targets: edge response is display-authoritative when available (today only);
  // otherwise the raw nutrition_targets row. Actuals: always client-summed.
  const target: Partial<Macros> | null = coachingData
    ? coachingData.target
    : targetsRow.data
      ? {
          calories: targetsRow.data.calories ?? undefined, proteinG: targetsRow.data.protein_g ?? undefined,
          carbsG: targetsRow.data.carbs_g ?? undefined, fatG: targetsRow.data.fat_g ?? undefined,
        }
      : null;
  const dayTypeLabel = coachingData?.dayType === 'training' ? 'Training day' : coachingData?.dayType === 'rest' ? 'Rest day' : null;

  const dateLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <PageHeader
        eyebrow={`Nutrition · ${dateLabel}`}
        title={<>Fuel <span className="amber">Desk</span></>}
        actions={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- /nutrition/recipes route lands in Task 8; cast avoids a typed-router error until then */}
            <Link to={'/nutrition/recipes' as any} className="btn ghost small">Recipes</Link>
            <div className="toggle-group">
              <button type="button" onClick={() => setDateStr(addDays(dateStr, -1))}>‹</button>
              <button type="button" className={isToday ? 'active' : ''} onClick={() => setDateStr(today)}>Today</button>
              <button type="button" disabled={isToday} onClick={() => setDateStr(addDays(dateStr, 1))}>›</button>
            </div>
          </div>
        }
      />

      {target == null && !targetsRow.isLoading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: 12 }}>
            No targets yet — Ozzie computes daily calorie and macro targets from your training plan.
          </p>
          <button className="btn small" type="button" onClick={() => void coaching.refetch()}>Refresh targets</button>
        </div>
      )}
      <FuelBand logged={logged} target={target} dayTypeLabel={dayTypeLabel} />

      <QuickAdd userId={userId} dateStr={dateStr} />

      {del.isError && <p className="err-line" role="alert">{(del.error as Error).message}</p>}
      {dayLog.isError ? (
        <ErrorPanel error={dayLog.error as Error} onRetry={() => void dayLog.refetch()} />
      ) : (dayLog.data ?? []).length === 0 && !dayLog.isLoading ? (
        <EmptyState title="Nothing logged today" body="Search a food above — or log a serving of one of your recipes." />
      ) : (
        <DayLogTable entries={dayLog.data ?? []} onDelete={(id) => del.mutate(id)} />
      )}

      {isToday && coaching.data?.tip && (
        <div className="ozzie-note" style={{ marginTop: 24 }}>
          <span className="tag">Ozzie —</span>
          <p>{coaching.data.tip}</p>
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute('/_authed/nutrition/')({ component: FuelDesk });
