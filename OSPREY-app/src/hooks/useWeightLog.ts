import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWeightSummary, logWeight } from '@/services/body-metrics';
import { useAuthStore } from '@/store/authStore';

export function useWeightLog() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['weight-summary', userId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchWeightSummary(userId!),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });

  const log = useMutation({
    mutationFn: ({ weightKg, bodyFatPct }: { weightKg: number; bodyFatPct?: number | null }) =>
      logWeight(userId!, weightKg, bodyFatPct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // Targets are recomputed server-side off the new trend on next fetch.
      queryClient.invalidateQueries({ queryKey: ['nutrition-coaching', userId] });
    },
  });

  return { ...query, log };
}
