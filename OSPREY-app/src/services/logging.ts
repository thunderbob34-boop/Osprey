import { supabase } from '@/services/supabase';
import type {
  LoggedFoodRow,
  LoggedWorkoutRow,
  MealType,
  QuickFoodInput,
  QuickWorkoutInput,
  RecentMeal,
  TodayLogData,
} from '@/types/log';

const MILES_TO_KM = 1.609344;

function startOfTodayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export async function fetchTodayLog(userId: string): Promise<TodayLogData> {
  const since = startOfTodayIso();

  const [workoutsRes, foodRes] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('id, session_type, started_at, total_duration_s, total_distance_km, notes')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('started_at', since)
      .order('started_at', { ascending: false }),
    supabase
      .from('food_log_entries')
      .select('id, meal_type, logged_at, calories, protein_g, carbs_g, fat_g, quantity_g, food_item_id, food_items(name)')
      .eq('user_id', userId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: false }),
  ]);

  if (workoutsRes.error) throw workoutsRes.error;
  if (foodRes.error) throw foodRes.error;

  const workouts: LoggedWorkoutRow[] = (workoutsRes.data ?? []).map((row) => ({
    id: row.id,
    sessionType: row.session_type,
    startedAt: row.started_at,
    durationMinutes: Math.round((row.total_duration_s ?? 0) / 60),
    distanceMiles:
      row.total_distance_km != null
        ? Math.round((row.total_distance_km / MILES_TO_KM) * 10) / 10
        : null,
    notes: row.notes,
  }));

  const food: LoggedFoodRow[] = (foodRes.data ?? []).map((row) => ({
    id: row.id,
    name: (row.food_items as { name?: string } | null)?.name ?? 'Food',
    mealType: row.meal_type,
    loggedAt: row.logged_at,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    quantityG: row.quantity_g,
    foodItemId: row.food_item_id,
  }));

  const totalCalories = food.reduce((sum, row) => sum + (row.calories ?? 0), 0);

  return { workouts, food, totalCalories };
}

/**
 * The user's most-logged meals over the last 3 weeks, most frequent first.
 * Each carries the macros from its most recent logging so a re-log matches
 * what they actually ate last time.
 */
export async function fetchRecentMeals(userId: string, limit = 6): Promise<RecentMeal[]> {
  const since = new Date(Date.now() - 21 * 86400000).toISOString();

  const { data, error } = await supabase
    .from('food_log_entries')
    .select('food_item_id, meal_type, quantity_g, calories, protein_g, carbs_g, fat_g, food_items(name)')
    .eq('user_id', userId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false });

  if (error) throw error;

  const byItem = new Map<string, RecentMeal>();
  for (const row of data ?? []) {
    const foodItemId = row.food_item_id as string | null;
    if (!foodItemId) continue;
    const existing = byItem.get(foodItemId);
    if (existing) {
      existing.timesLogged += 1; // rows are newest-first, so macros stay from the latest log
      continue;
    }
    byItem.set(foodItemId, {
      foodItemId,
      name: (row.food_items as { name?: string } | null)?.name ?? 'Meal',
      mealType: (row.meal_type as MealType | null) ?? null,
      quantityG: row.quantity_g,
      calories: row.calories,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      timesLogged: 1,
    });
  }

  return Array.from(byItem.values())
    .sort((a, b) => b.timesLogged - a.timesLogged)
    .slice(0, limit);
}

/**
 * Re-logs every food entry from yesterday onto today, preserving each entry's
 * time of day and meal type. Returns how many entries were copied (0 when
 * yesterday was unlogged).
 */
export async function copyYesterdayFood(userId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const { data, error } = await supabase
    .from('food_log_entries')
    .select('food_item_id, meal_type, quantity_g, calories, protein_g, carbs_g, fat_g, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', yesterdayStart.toISOString())
    .lt('logged_at', todayStart.toISOString());

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const rows = data.map((row) => {
    const original = new Date(row.logged_at);
    const loggedAt = new Date(todayStart);
    loggedAt.setHours(original.getHours(), original.getMinutes(), 0, 0);
    return {
      user_id: userId,
      food_item_id: row.food_item_id,
      meal_type: row.meal_type,
      quantity_g: row.quantity_g,
      calories: row.calories,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      logged_at: loggedAt.toISOString(),
    };
  });

  const { error: insertError } = await supabase.from('food_log_entries').insert(rows);
  if (insertError) throw insertError;
  return rows.length;
}

export async function saveQuickWorkout(
  userId: string,
  input: QuickWorkoutInput,
): Promise<void> {
  const durationS = Math.max(1, Math.round(input.minutes * 60));
  const startedAt = new Date(Date.now() - durationS * 1000);

  const { error } = await supabase.from('workout_logs').insert({
    user_id: userId,
    started_at: startedAt.toISOString(),
    ended_at: new Date().toISOString(),
    session_type: input.sessionType,
    status: 'completed',
    total_duration_s: durationS,
    total_distance_km:
      input.distanceMiles != null ? Math.round(input.distanceMiles * MILES_TO_KM * 1000) / 1000 : null,
    notes: input.notes || null,
  });

  if (error) throw error;
}

export async function deleteLoggedWorkout(id: string): Promise<void> {
  const { error } = await supabase
    .from('workout_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateLoggedWorkout(
  id: string,
  input: QuickWorkoutInput,
): Promise<void> {
  const durationS = Math.max(1, Math.round(input.minutes * 60));
  const { error } = await supabase
    .from('workout_logs')
    .update({
      session_type: input.sessionType,
      total_duration_s: durationS,
      total_distance_km:
        input.distanceMiles != null ? Math.round(input.distanceMiles * MILES_TO_KM * 1000) / 1000 : null,
      notes: input.notes || null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLoggedFood(id: string): Promise<void> {
  const { error } = await supabase.from('food_log_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function updateLoggedFood(id: string, input: QuickFoodInput): Promise<void> {
  const { error } = await supabase
    .from('food_log_entries')
    .update({
      meal_type: input.mealType,
      quantity_g: input.quantityG ?? 100,
      calories: input.calories,
      protein_g: input.proteinG ?? null,
      carbs_g: input.carbsG ?? null,
      fat_g: input.fatG ?? null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function saveQuickFood(userId: string, input: QuickFoodInput): Promise<void> {
  let foodItemId = input.foodItemId;

  if (!foodItemId) {
    // input.calories/proteinG/carbsG/fatG are totals for the entered
    // quantity, but food_items stores density (per 100g) — writing the raw
    // totals silently mislabeled any non-100g quantity as its density.
    const quantityG = input.quantityG ?? 100;
    const densityScale = 100 / quantityG;
    const { data: foodItem, error: foodItemError } = await supabase
      .from('food_items')
      .insert({
        name: input.name,
        calories_per_100g: Math.round(input.calories * densityScale * 10) / 10,
        protein_g: input.proteinG != null ? Math.round(input.proteinG * densityScale * 10) / 10 : null,
        carbs_g: input.carbsG != null ? Math.round(input.carbsG * densityScale * 10) / 10 : null,
        fat_g: input.fatG != null ? Math.round(input.fatG * densityScale * 10) / 10 : null,
        source: 'manual',
      })
      .select('id')
      .single();

    if (foodItemError || !foodItem) throw foodItemError ?? new Error('Failed to save food item');
    foodItemId = foodItem.id;
  }

  const { error: logError } = await supabase.from('food_log_entries').insert({
    user_id: userId,
    food_item_id: foodItemId,
    meal_type: input.mealType,
    quantity_g: input.quantityG ?? 100,
    calories: input.calories,
    protein_g: input.proteinG ?? null,
    carbs_g: input.carbsG ?? null,
    fat_g: input.fatG ?? null,
  });

  if (logError) throw logError;
}
