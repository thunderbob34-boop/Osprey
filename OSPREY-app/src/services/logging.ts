import { supabase } from '@/services/supabase';
import type {
  LoggedFoodRow,
  LoggedWorkoutRow,
  QuickFoodInput,
  QuickWorkoutInput,
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
      .select('id, meal_type, logged_at, calories, food_items(name)')
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
  }));

  const totalCalories = food.reduce((sum, row) => sum + (row.calories ?? 0), 0);

  return { workouts, food, totalCalories };
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

export async function saveQuickFood(userId: string, input: QuickFoodInput): Promise<void> {
  let foodItemId = input.foodItemId;

  if (!foodItemId) {
    const { data: foodItem, error: foodItemError } = await supabase
      .from('food_items')
      .insert({
        name: input.name,
        calories_per_100g: input.calories,
        protein_g: input.proteinG ?? null,
        carbs_g: input.carbsG ?? null,
        fat_g: input.fatG ?? null,
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
