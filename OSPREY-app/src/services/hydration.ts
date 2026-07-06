import { supabase } from '@/services/supabase';
import { localDateString } from '@/utils/date';

export interface HydrationToday {
  ounces: number;
  targetOz: number;
}

const DEFAULT_TARGET_OZ = 80;

export async function fetchHydrationToday(userId: string): Promise<HydrationToday> {
  const today = localDateString();
  const { data, error } = await supabase
    .from('hydration_log')
    .select('ounces, target_oz')
    .eq('user_id', userId)
    .eq('logged_on', today)
    .maybeSingle();

  if (error) throw error;
  return {
    ounces: data?.ounces ?? 0,
    targetOz: data?.target_oz ?? DEFAULT_TARGET_OZ,
  };
}

/** Adds `ounces` to today's total (negative to undo a mis-tap), creating the row if needed. */
export async function logHydration(ounces: number, targetOz = DEFAULT_TARGET_OZ): Promise<HydrationToday> {
  const { data, error } = await supabase
    .rpc('log_hydration', { p_ounces: ounces, p_target_oz: targetOz, p_logged_on: localDateString() })
    .single();

  if (error || !data) throw error ?? new Error('Failed to log hydration');
  const row = data as { ounces: number; target_oz: number };
  return { ounces: row.ounces, targetOz: row.target_oz };
}
