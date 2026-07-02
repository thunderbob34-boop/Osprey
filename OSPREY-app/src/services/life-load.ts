import { supabase } from '@/services/supabase';

export interface LifeLoad {
  compositeScore: number | null;
  narrative: string;
  whyReasoning: string | null;
}

/**
 * Fuses recovery_scores (HealthKit) + load_scores (training) + today's
 * fueling into one 0-100 score with an Ozzie-narrated explanation. Cached
 * server-side per day (see supabase/functions/ozzie-compute-readiness).
 */
export async function fetchLifeLoad(): Promise<LifeLoad> {
  const { data, error } = await supabase.functions.invoke<{
    narrative: string;
    why_reasoning: string | null;
    composite_score: number | null;
  }>('ozzie-compute-readiness', { method: 'POST' });

  if (error || !data) throw error ?? new Error('Failed to load Life Load');

  return {
    compositeScore: data.composite_score,
    narrative: data.narrative,
    whyReasoning: data.why_reasoning,
  };
}
