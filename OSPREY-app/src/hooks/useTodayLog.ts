import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTodayLog, saveQuickFood, saveQuickWorkout } from '@/services/logging';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';
import type { QuickFoodInput, QuickWorkoutInput } from '@/types/log';

export function useTodayLog() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['today-log', userId];

  const query = useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchTodayLog(userId!)),
    enabled: Boolean(userId),
  });

  const logWorkout = useMutation({
    mutationFn: (input: QuickWorkoutInput) => saveQuickWorkout(userId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['daily-summary', userId] });
      queryClient.invalidateQueries({ queryKey: ['stats', userId] });
    },
  });

  const logFood = useMutation({
    mutationFn: (input: QuickFoodInput) => saveQuickFood(userId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['nutrition-coaching', userId] });
      queryClient.invalidateQueries({ queryKey: ['fuel-status', userId] });
    },
  });

  return { ...query, logWorkout, logFood };
}
