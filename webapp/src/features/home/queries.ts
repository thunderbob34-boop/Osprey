import { useQuery, useQueryClient } from '@tanstack/react-query';
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

export interface PlanSyncResult {
  created: boolean;
  weekId: string;
  rescheduled: unknown[];
}

/**
 * Mirrors OSPREY-app/src/services/daily-summary.ts's unconditional call to
 * invokeGeneratePlan() on every mobile home-screen load — the edge function's
 * own comment calls this "the silent background call fired every time the
 * home screen loads": idempotent, generates the current week if missing, and
 * reschedules any sessions missed earlier this week. The webapp never made
 * this call, so a plan that ran out of generated weeks just rendered as
 * silence (empty "This week", "Rest day — nothing scheduled") instead of
 * healing itself — see benchmark/osprey-webapp-ux-pass.md F1 in the
 * hyrox-trainer-experience skill.
 *
 * Deliberately posts no `envelope` — that requires re-deriving mobile's full
 * threshold/rowing/hyrox-params assembly (build-envelope.ts), which is a
 * separate, larger port. An envelope-less call is an already-supported,
 * documented path server-side (ozzie-generate-plan/index.ts's `envelope?`
 * handling throughout) and is exactly what "no-envelope regenerations" means
 * in that file's own comments — it still creates/reschedules a real week,
 * just without the extra pacing/fueling guidance an envelope adds.
 *
 * Mounted once in the `_authed` layout (not per-page) so it fires regardless
 * of which route the user lands on first.
 */
export function usePlanSync(userId: string) {
  const qc = useQueryClient();
  const todayISO = toDateInputValue(new Date());

  return useQuery({
    queryKey: ['plan-sync', userId, todayISO],
    queryFn: async (): Promise<PlanSyncResult | null> => {
      const { data, error } = await supabase.functions.invoke('ozzie-generate-plan', {
        method: 'POST',
        body: {},
      });
      if (error) throw error;

      // A week may have just been created or had missed sessions rescheduled —
      // let every view that reads training_sessions/the daily summary refetch.
      // Prefix keys (no date range) so this invalidates every cached window.
      void qc.invalidateQueries({ queryKey: ['sessions', userId] });
      void qc.invalidateQueries({ queryKey: ['completions', userId] });
      void qc.invalidateQueries({ queryKey: ['daily-summary', userId] });
      void qc.invalidateQueries({ queryKey: ['today-brief', userId] });

      return (data as PlanSyncResult | null) ?? null;
    },
    // The queryKey already rolls over at local midnight (todayISO), so this only
    // needs to survive re-renders/refocus within the same day — the edge
    // function's own idempotency (one week per Monday) makes a longer window
    // safe rather than necessary.
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
