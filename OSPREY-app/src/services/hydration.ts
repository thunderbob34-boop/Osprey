import { supabase } from '@/services/supabase';

export interface HydrationToday {
  ounces: number;
  targetOz: number;
}

const DEFAULT_TARGET_OZ = 80;

/**
 * YYYY-MM-DD for the device's local calendar day. `toISOString()` converts
 * to UTC first, which rolled the hydration ring over mid-evening (at UTC
 * midnight) for any user west of Greenwich instead of at their own
 * midnight — the same mismatch existed server-side, where `log_hydration`
 * defaulted to Postgres's `CURRENT_DATE` (UTC). Both sides now key off this
 * same local date string.
 */
function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
