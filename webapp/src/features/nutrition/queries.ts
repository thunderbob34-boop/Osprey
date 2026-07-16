import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { FoodItemSchema, FoodLogEntrySchema, NutritionTargetsSchema, type FoodItem, type MealType, type NutritionTargets } from '../../lib/schemas';
import { localDayRange, loggedAtFor } from '../../lib/day';
import { macrosFor, round1, type Macros, type Per100g } from '../../lib/macros';

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const DayLogEntrySchema = FoodLogEntrySchema.extend({
  food_items: z.object({ name: z.string(), source: z.string().nullable() }),
});
export type DayLogEntry = z.infer<typeof DayLogEntrySchema>;

export function useDayLog(userId: string, dateStr: string) {
  return useQuery({
    queryKey: ['day-log', userId, dateStr],
    queryFn: async (): Promise<DayLogEntry[]> => {
      const { start, end } = localDayRange(dateStr);
      const { data, error } = await supabase
        .from('food_log_entries')
        .select('*, food_items(name, source)')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at');
      if (error) throw error;
      return z.array(DayLogEntrySchema).parse(data);
    },
  });
}

export function sumDay(entries: DayLogEntry[]): Macros {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Math.round(e.calories ?? 0),
      proteinG: round1(acc.proteinG + (e.protein_g ?? 0)),
      carbsG: round1(acc.carbsG + (e.carbs_g ?? 0)),
      fatG: round1(acc.fatG + (e.fat_g ?? 0)),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function useNutritionTargets(userId: string) {
  return useQuery({
    queryKey: ['nutrition-targets', userId],
    queryFn: async (): Promise<NutritionTargets | null> => {
      const { data, error } = await supabase.from('nutrition_targets').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data ? NutritionTargetsSchema.parse(data) : null;
    },
  });
}

export interface CoachingResponse {
  target: Macros; loggedToday: Macros; tip: string | null;
  dayType: 'training' | 'rest' | null; todaySessionType: string | null;
}

// Contract mirrors OSPREY-app/src/services/nutrition.ts::fetchNutritionCoaching.
// Only meaningful for "today", so callers pass enabled=false for past dates.
export function useNutritionCoaching(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['nutrition-coaching', userId],
    enabled,
    retry: 1,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CoachingResponse> => {
      const { data, error } = await supabase.functions.invoke<{
        target: { calories: number; proteinG: number; carbsG: number; fatG: number };
        loggedToday: { calories: number; proteinG: number; carbsG: number; fatG: number };
        tip: string; dayType?: 'training' | 'rest'; todaySessionType?: string | null;
      }>('ozzie-nutrition-coach', { method: 'POST' });
      if (error || !data) throw error ?? new Error('Failed to load nutrition coaching');
      return {
        target: data.target, loggedToday: data.loggedToday, tip: data.tip ?? null,
        dayType: data.dayType ?? null, todaySessionType: data.todaySessionType ?? null,
      };
    },
  });
}

export function useFoodSearch(term: string) {
  return useQuery({
    queryKey: ['food-search', term],
    enabled: term.trim().length >= 2,
    queryFn: async (): Promise<FoodItem[]> => {
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .or('source.is.null,source.neq.recipe') // shadow recipe rows must never surface
        .ilike('name', `%${term.trim()}%`)
        .order('name')
        .limit(15);
      if (error) throw error;
      return z.array(FoodItemSchema).parse(data);
    },
  });
}

function per100gOf(food: FoodItem): Per100g {
  return { calories: food.calories_per_100g, proteinG: food.protein_g, carbsG: food.carbs_g, fatG: food.fat_g };
}

export function useLogFood(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { food: FoodItem; quantityG: number; mealType: MealType; dateStr: string }) => {
      const m = macrosFor({ quantityG: input.quantityG, per100g: per100gOf(input.food) });
      const { error } = await supabase.from('food_log_entries').insert({
        user_id: userId,
        food_item_id: input.food.id,
        logged_at: loggedAtFor(input.dateStr),
        meal_type: input.mealType,
        quantity_g: input.quantityG,
        calories: m.calories, protein_g: m.proteinG, carbs_g: m.carbsG, fat_g: m.fatG,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['day-log', userId, v.dateStr] });
      void qc.invalidateQueries({ queryKey: ['nutrition-coaching'] });
    },
  });
}

export function useDeleteLogEntry(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from('food_log_entries').delete().eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day-log', userId] });
      void qc.invalidateQueries({ queryKey: ['nutrition-coaching'] });
    },
  });
}

export function useAddManualFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; per100g: Per100g }): Promise<FoodItem> => {
      const { data, error } = await supabase
        .from('food_items')
        .insert({
          name: input.name,
          calories_per_100g: input.per100g.calories, protein_g: input.per100g.proteinG,
          carbs_g: input.per100g.carbsG, fat_g: input.per100g.fatG,
          source: 'manual',
        })
        .select('*')
        .single();
      if (error) throw error;
      return FoodItemSchema.parse(data);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['food-search'] }),
  });
}
