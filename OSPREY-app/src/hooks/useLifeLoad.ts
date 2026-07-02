import { useQuery } from '@tanstack/react-query';
import { fetchLifeLoad } from '@/services/life-load';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useLifeLoad() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryKey = ['life-load', userId];

  return useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, fetchLifeLoad),
    enabled: Boolean(userId),
    staleTime: 30 * 60 * 1000,
  });
}
