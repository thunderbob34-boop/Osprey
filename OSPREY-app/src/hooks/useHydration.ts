import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHydrationToday, logHydration } from '@/services/hydration';
import { useAuthStore } from '@/store/authStore';

export function useHydration() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['hydration-today', userId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchHydrationToday(userId!),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });

  const add = useMutation({
    mutationFn: (ounces: number) => logHydration(ounces, query.data?.targetOz),
    // Optimistic update so taps feel instant.
    onMutate: async (ounces) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: { ounces: number; targetOz: number } | undefined) => ({
        ounces: Math.max(0, (old?.ounces ?? 0) + ounces),
        targetOz: old?.targetOz ?? 80,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, add };
}
