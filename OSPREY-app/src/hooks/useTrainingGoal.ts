import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import type { PrimaryGoal } from '@/types/onboarding';

/**
 * The athlete's chosen discipline and weekly training days.
 *
 * Settings needs these to say what the athlete's preferences actually ARE, and
 * to decide whether sport-specific entries (e.g. the Hyrox quiz) belong on
 * screen at all. `authStore`'s UserProfile carries only display_name and
 * experience_tier, so this reads the same `user_goals` row that
 * app/preferences.tsx writes.
 */
export interface TrainingGoal {
  primaryGoal: PrimaryGoal | null;
  /** Primary-discipline days + lift days, matching how preferences.tsx totals them. */
  daysPerWeek: number | null;
}

export function useTrainingGoal() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<TrainingGoal>({
    queryKey: ['training-goal', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_goals')
        .select('primary_goal, weekly_run_days, weekly_lift_days')
        .eq('user_id', userId!)
        .maybeSingle();

      const runDays = data?.weekly_run_days ?? null;
      const liftDays = data?.weekly_lift_days ?? null;

      return {
        primaryGoal: (data?.primary_goal as PrimaryGoal | undefined) ?? null,
        // Null, not 0, when neither is set — "0 days/week" is a claim, absent is not.
        daysPerWeek: runDays == null && liftDays == null ? null : (runDays ?? 0) + (liftDays ?? 0),
      };
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}
