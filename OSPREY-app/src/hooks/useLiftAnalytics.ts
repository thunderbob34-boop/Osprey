import { useQuery } from '@tanstack/react-query';
import { fetchLiftAnalytics } from '@/services/lift-analytics';
import { useAuthStore } from '@/store/authStore';

export function useLiftAnalytics() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['lift-analytics', userId],
    queryFn: () => fetchLiftAnalytics(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}
