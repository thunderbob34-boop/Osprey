import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  copyYesterdayFood,
  deleteLoggedFood,
  deleteLoggedWorkout,
  fetchRecentMeals,
  fetchTodayLog,
  saveQuickFood,
  saveQuickWorkout,
  updateLoggedFood,
  updateLoggedWorkout,
} from '@/services/logging';
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

  const invalidateWorkoutQueries = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['daily-summary', userId] });
    queryClient.invalidateQueries({ queryKey: ['stats', userId] });
  };

  const logWorkout = useMutation({
    mutationFn: (input: QuickWorkoutInput) => saveQuickWorkout(userId!, input),
    onSuccess: invalidateWorkoutQueries,
  });

  const updateWorkout = useMutation({
    mutationFn: (vars: { id: string; input: QuickWorkoutInput }) =>
      updateLoggedWorkout(vars.id, vars.input),
    onSuccess: invalidateWorkoutQueries,
  });

  const deleteWorkout = useMutation({
    mutationFn: (id: string) => deleteLoggedWorkout(id),
    onSuccess: invalidateWorkoutQueries,
  });

  const invalidateFoodQueries = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['nutrition-coaching', userId] });
    queryClient.invalidateQueries({ queryKey: ['fuel-status', userId] });
    queryClient.invalidateQueries({ queryKey: ['recent-meals', userId] });
  };

  const logFood = useMutation({
    mutationFn: (input: QuickFoodInput) => saveQuickFood(userId!, input),
    onSuccess: invalidateFoodQueries,
  });

  const updateFood = useMutation({
    mutationFn: (vars: { id: string; input: QuickFoodInput }) => updateLoggedFood(vars.id, vars.input),
    onSuccess: invalidateFoodQueries,
  });

  const deleteFood = useMutation({
    mutationFn: (id: string) => deleteLoggedFood(id),
    onSuccess: invalidateFoodQueries,
  });

  const copyYesterday = useMutation({
    mutationFn: () => copyYesterdayFood(userId!),
    onSuccess: invalidateFoodQueries,
  });

  return {
    ...query,
    logWorkout,
    updateWorkout,
    deleteWorkout,
    logFood,
    updateFood,
    deleteFood,
    copyYesterday,
  };
}

/** Standalone delete for a logged workout, usable from screens (e.g. Stats)
 * that don't otherwise need the full today-log query. */
export function useDeleteWorkoutLog() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteLoggedWorkout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-log', userId] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary', userId] });
      queryClient.invalidateQueries({ queryKey: ['stats', userId] });
    },
  });
}

/** Most-logged meals over the last 3 weeks, for one-tap re-logging. */
export function useRecentMeals() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryKey = ['recent-meals', userId];

  return useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchRecentMeals(userId!)),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}
