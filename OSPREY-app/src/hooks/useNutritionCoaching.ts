import { useQuery } from '@tanstack/react-query';
import { fetchNutritionCoaching } from '@/services/nutrition';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useNutritionCoaching() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryKey = ['nutrition-coaching', userId];

  return useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchNutritionCoaching(userId!)),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}
