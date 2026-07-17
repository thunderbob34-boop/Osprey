import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { toDateInputValue, localDayRange } from '../../lib/day';

const DailySummaryRow = z.object({
  recovery_score: z.coerce.number().nullable(),
  recovery_recommendation: z.string().nullable(),
  tsb: z.coerce.number().nullable(),
  week_distance_km: z.coerce.number().nullable(),
  workouts_last_30d: z.coerce.number().nullable(),
});

export interface DailySummary {
  recoveryScore: number | null;
  recoveryRecommendation: string | null;
  tsb: number | null;
  weekDistanceKm: number | null;
  workoutsLast30d: number | null;
}

export function useDailySummary(userId: string) {
  return useQuery({
    queryKey: ['daily-summary', userId],
    queryFn: async (): Promise<DailySummary | null> => {
      const { data, error } = await supabase
        .from('v_daily_summary')
        .select('recovery_score, recovery_recommendation, tsb, week_distance_km, workouts_last_30d')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const p = DailySummaryRow.parse(data);
      return {
        recoveryScore: p.recovery_score,
        recoveryRecommendation: p.recovery_recommendation,
        tsb: p.tsb,
        weekDistanceKm: p.week_distance_km,
        workoutsLast30d: p.workouts_last_30d,
      };
    },
  });
}

export function useTodayBrief(userId: string) {
  return useQuery({
    queryKey: ['today-brief', userId],
    queryFn: async (): Promise<string | null> => {
      const { start } = localDayRange(toDateInputValue(new Date()));
      const { data, error } = await supabase
        .from('ozzie_insights')
        .select('response_text')
        .eq('user_id', userId)
        .eq('insight_type', 'daily_brief')
        .gte('created_at', start)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.response_text as string | undefined) ?? null;
    },
  });
}
