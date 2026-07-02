import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteShare, fetchActivityFeed, shareWorkout, toggleKudo, type ActivityCard } from '@/services/activity';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useActivity() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['activity-feed', userId];

  const feed = useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchActivityFeed(userId!)),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const share = useMutation({
    mutationFn: ({ workoutId, caption }: { workoutId: string; caption?: string | null }) =>
      shareWorkout(userId!, workoutId, caption),
    onSuccess: invalidate,
  });

  const kudo = useMutation({
    mutationFn: (shareId: string) => toggleKudo(shareId, userId!),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (shareId: string) => deleteShare(shareId),
    onSuccess: invalidate,
  });

  return {
    feed: feed.data as ActivityCard[] | undefined,
    isLoading: feed.isLoading,
    error: feed.error,
    share,
    kudo,
    remove,
  };
}
