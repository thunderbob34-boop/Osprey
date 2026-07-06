import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSavedRoute, deleteSavedRoute, fetchSavedRoutes } from '@/services/routes';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';
import type { SavedRouteInput } from '@/types/routes';

export function useSavedRoutes() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['saved-routes', userId];

  const query = useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchSavedRoutes(userId!)),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const addRoute = useMutation({
    mutationFn: (input: SavedRouteInput) => createSavedRoute(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeRoute = useMutation({
    mutationFn: (routeId: string) => deleteSavedRoute(routeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, addRoute, removeRoute };
}
