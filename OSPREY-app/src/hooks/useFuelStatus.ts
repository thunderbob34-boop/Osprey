import { useQuery } from '@tanstack/react-query';
import { fetchFuelStatus } from '@/services/nutrition';
import { useAuthStore } from '@/store/authStore';

export function useFuelStatus() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['fuel-status', userId],
    queryFn: () => fetchFuelStatus(userId!),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });
}
