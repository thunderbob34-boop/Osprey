import { format } from 'date-fns';
import { supabase } from '@/services/supabase';

export interface PlannedMeal {
  name: string;
  slot: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estCost: number;
}

export interface MealPlanDay {
  planDate: string;
  meals: PlannedMeal[];
  target: { calories: number; proteinG: number; carbsG: number; fatG: number };
  estTotalCost: number | null;
  budgetPerDay: number | null;
  sessionType: string | null;
  ozzieNote: string | null;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  estCost: number | null;
  checked: boolean;
}

export interface BudgetPrefs {
  amount: number | null;
  period: 'weekly' | 'monthly' | null;
  dietaryNotes: string | null;
}

/** Local date string — meal plans are keyed by the user's day, not UTC's. */
export function todayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Monday of the week containing dateStr, matching the edge function's week key. */
export function weekOfLocal(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return format(date, 'yyyy-MM-dd');
}

export async function fetchMealPlan(planDate: string, force = false): Promise<MealPlanDay> {
  const { data, error } = await supabase.functions.invoke<MealPlanDay & { error?: string }>(
    'ozzie-meal-prep',
    { method: 'POST', body: { planDate, force } },
  );
  if (error || !data) throw error ?? new Error('Failed to load meal plan');
  if ((data as { error?: string }).error) throw new Error((data as { error?: string }).error);
  return data;
}

export async function fetchGroceryList(userId: string, weekOf: string): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from('grocery_items')
    .select('id, name, quantity, category, est_cost, checked')
    .eq('user_id', userId)
    .eq('week_of', weekOf)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    estCost: row.est_cost != null ? Number(row.est_cost) : null,
    checked: row.checked,
  }));
}

export async function setGroceryItemChecked(itemId: string, checked: boolean): Promise<void> {
  const { error } = await supabase.from('grocery_items').update({ checked }).eq('id', itemId);
  if (error) throw error;
}

export async function removeGroceryItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('grocery_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function fetchBudgetPrefs(userId: string): Promise<BudgetPrefs> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('grocery_budget_amount, grocery_budget_period, dietary_notes')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return {
    amount: data?.grocery_budget_amount != null ? Number(data.grocery_budget_amount) : null,
    period: (data?.grocery_budget_period as BudgetPrefs['period']) ?? null,
    dietaryNotes: data?.dietary_notes ?? null,
  };
}

export async function saveBudgetPrefs(userId: string, prefs: BudgetPrefs): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      grocery_budget_amount: prefs.amount,
      grocery_budget_period: prefs.period,
      dietary_notes: prefs.dietaryNotes,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

/**
 * Plain-text checklist for the native share sheet — imports cleanly into
 * Notes/Reminders/Messages. Unchecked items lead so the store run reads
 * top-to-bottom; already-checked items trail under a divider.
 */
export function buildGroceryExportText(items: GroceryItem[], weekOf: string): string {
  const money = (n: number | null) => (n != null ? ` — ~$${n.toFixed(2)}` : '');
  const line = (item: GroceryItem, mark: string) =>
    `${mark} ${item.name}${item.quantity ? ` (${item.quantity})` : ''}${money(item.estCost)}`;

  const remaining = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const estTotal = items.reduce((s, i) => s + (i.estCost ?? 0), 0);

  const parts = [
    `OSPREY Grocery List — week of ${weekOf}`,
    `Est. total: ~$${estTotal.toFixed(2)}`,
    '',
    ...remaining.map((i) => line(i, '◻')),
  ];
  if (done.length > 0) {
    parts.push('', '— already picked up —', ...done.map((i) => line(i, '✓')));
  }
  return parts.join('\n');
}
