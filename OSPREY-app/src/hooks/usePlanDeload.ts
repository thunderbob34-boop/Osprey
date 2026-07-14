import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';
import { localDateString } from '@/utils/date';
import { usePerformance } from '@/hooks/usePerformance';
import { computeAcwrTrend } from '@/services/performance';
import {
  computeRacePhase,
  currentWeekStartDate,
  fetchCurrentWeekSessions,
  fetchRaceGoal,
  swapTodaySession,
  type WeekSession,
} from '@/services/plan';

const HARD_INTENSITIES = new Set(['threshold', 'interval', 'race']);
const DAYS_TO_HIGH_RISK_THRESHOLD = 3;

export interface DeloadSuggestion {
  session: WeekSession;
  daysToHighRisk: number;
}

const dismissedKey = (userId: string) => `osprey-deload-dismissed-${userId}`;

/**
 * Proactively flags an upcoming hard session for de-load when the ACWR trend
 * is climbing toward the danger zone — before tsb tips negative. Surfaces at
 * most one suggestion at a time and never re-nags within the same week once
 * dismissed or accepted (see DAYS_TO_HIGH_RISK_THRESHOLD / dismissedKey).
 */
export function usePlanDeload() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const { data: perf } = usePerformance();
  const [dismissedWeek, setDismissedWeek] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(dismissedKey(userId)).then(setDismissedWeek);
  }, [userId]);

  const trend = useMemo(
    () => (perf?.dailyLoads ? computeAcwrTrend(perf.dailyLoads) : null),
    [perf?.dailyLoads],
  );

  const weekStart = currentWeekStartDate();
  const isClimbing =
    trend?.direction === 'climbing' &&
    trend.daysToHighRisk != null &&
    trend.daysToHighRisk <= DAYS_TO_HIGH_RISK_THRESHOLD;
  const shouldCheck = Boolean(userId) && isClimbing && dismissedWeek !== weekStart;

  const weekQuery = useQuery({
    queryKey: ['plan-deload-week', userId, weekStart],
    queryFn: async () => {
      const [sessions, goal] = await Promise.all([
        fetchCurrentWeekSessions(userId!),
        fetchRaceGoal(userId!),
      ]);
      return { sessions, phase: goal ? computeRacePhase(goal) : null };
    },
    enabled: shouldCheck,
    staleTime: 300_000,
  });

  const suggestion: DeloadSuggestion | null = useMemo(() => {
    if (!shouldCheck || !weekQuery.data || trend?.daysToHighRisk == null) return null;

    const { sessions, phase } = weekQuery.data;
    // A planned taper/peak already is a de-load — don't stack another one on top.
    if (phase?.phase === 'Taper' || phase?.phase === 'Peak') return null;

    const today = localDateString();
    const upcoming = sessions.filter((s) => s.session_date >= today && s.session_type !== 'rest');
    const candidate = upcoming.find((s) => HARD_INTENSITIES.has(s.intensity)) ?? upcoming[0];
    if (!candidate) return null;

    return { session: candidate, daysToHighRisk: trend.daysToHighRisk };
  }, [shouldCheck, weekQuery.data, trend]);

  async function dismiss() {
    if (!userId) return;
    await AsyncStorage.setItem(dismissedKey(userId), weekStart);
    setDismissedWeek(weekStart);
  }

  const acceptMutation = useMutation({
    mutationFn: (sessionId: string) => swapTodaySession(userId!, sessionId, 'cross', 'trend_deload'),
    onSuccess: async () => {
      await dismiss();
      queryClient.invalidateQueries({ queryKey: ['daily-summary', userId] });
      queryClient.invalidateQueries({ queryKey: ['plan-deload-week', userId] });
    },
  });

  return {
    suggestion,
    isLoading: shouldCheck && weekQuery.isLoading,
    accept: () => suggestion && acceptMutation.mutateAsync(suggestion.session.id),
    isAccepting: acceptMutation.isPending,
    dismiss,
  };
}
