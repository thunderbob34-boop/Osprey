import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDailySummary } from '@/services/daily-summary';
import { compressTodaySession, moveSessionIndoors, swapTodaySession, type SwappableSessionType } from '@/services/plan';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useDailySummary() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['daily-summary', userId];

  const query = useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchDailySummary(userId!)),
    enabled: Boolean(userId),
    // Home tab query — was refetching on every mount/tab-focus with no
    // staleTime (React Query default is 0), unlike its sibling hooks
    // (useFuelStatus, useWeightLog, useActivity all use 60s). That meant a
    // fresh Supabase round trip every time a user tapped back to the home
    // tab, burning battery/data for data that rarely changes second to
    // second. Mutations below still invalidate immediately on swap/compress.
    staleTime: 60_000,
  });

  const swapSession = useMutation({
    mutationFn: ({ sessionId, newType }: { sessionId: string; newType: SwappableSessionType }) =>
      swapTodaySession(userId!, sessionId, newType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const compressSession = useMutation({
    mutationFn: ({ sessionId, availableMinutes }: { sessionId: string; availableMinutes: number }) =>
      compressTodaySession(userId!, sessionId, availableMinutes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const moveIndoors = useMutation({
    mutationFn: (sessionId: string) => moveSessionIndoors(userId!, sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, swapSession, compressSession, moveIndoors };
}
