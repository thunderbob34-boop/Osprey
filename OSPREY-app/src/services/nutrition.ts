import { supabase } from '@/services/supabase';

export interface NutritionMacros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionCoaching {
  target: NutritionMacros;
  loggedToday: NutritionMacros;
  tip: string | null;
}

export interface FuelStatus {
  lastLoggedMinutesAgo: number | null;
  recommendation: 'fuel_now' | 'good_timing' | 'recently_fueled';
}

/**
 * Compares time since the user's last food log entry against the general
 * 60-90 minute pre-workout fueling window, so the daily summary can nudge
 * them to eat before training rather than after they're already mid-bonk.
 */
export async function fetchFuelStatus(userId: string): Promise<FuelStatus> {
  const { data, error } = await supabase
    .from('food_log_entries')
    .select('logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { lastLoggedMinutesAgo: null, recommendation: 'fuel_now' };
  }

  const minutesAgo = Math.round((Date.now() - new Date(data.logged_at).getTime()) / 60000);

  let recommendation: FuelStatus['recommendation'] = 'fuel_now';
  if (minutesAgo < 60) recommendation = 'recently_fueled';
  else if (minutesAgo <= 150) recommendation = 'good_timing';

  return { lastLoggedMinutesAgo: minutesAgo, recommendation };
}

export async function fetchNutritionCoaching(userId: string): Promise<NutritionCoaching> {
  const { data, error } = await supabase.functions.invoke<{
    target: NutritionMacros;
    loggedToday: NutritionMacros;
    tip: string;
  }>('ozzie-nutrition-coach', { method: 'POST' });

  if (error || !data) {
    throw error ?? new Error('Failed to load nutrition coaching');
  }

  return {
    target: data.target,
    loggedToday: data.loggedToday,
    tip: data.tip,
  };
}
