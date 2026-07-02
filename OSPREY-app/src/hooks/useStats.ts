import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '@/services/stats';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useStats() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryKey = ['stats', userId];

  return useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchStats(userId!)),
    enabled: Boolean(userId),
  });
}
