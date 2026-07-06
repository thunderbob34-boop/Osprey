import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  detectTrainingGap,
  isRampBannerDismissed,
  type TrainingGap,
} from '@/services/return-to-training';
import { useAuthStore } from '@/store/authStore';

export interface TrainingGapState {
  gap: TrainingGap;
  dismissed: boolean;
}

export function useTrainingGap() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['training-gap', userId];

  const query = useQuery<TrainingGapState | null>({
    queryKey,
    queryFn: async () => {
      const gap = await detectTrainingGap(userId!);
      if (!gap) return null;
      const dismissed = await isRampBannerDismissed(userId!, gap);
      return { gap, dismissed };
    },
    enabled: Boolean(userId),
    staleTime: 30 * 60 * 1000, // gap length changes by whole days — no need to re-check often
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}
