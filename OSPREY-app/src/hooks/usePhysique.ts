import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addProgressPhoto,
  deleteProgressPhoto,
  fetchPhysiqueGoal,
  fetchProgressPhotos,
  savePhysiqueGoal,
  type PhysiqueGoal,
  type ProgressPhoto,
} from '@/services/physique';
import { useAuthStore } from '@/store/authStore';

export function usePhysique() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const goalKey = ['physique-goal', userId];
  const photosKey = ['progress-photos', userId];

  const goal = useQuery({
    queryKey: goalKey,
    queryFn: () => fetchPhysiqueGoal(userId!),
    enabled: Boolean(userId),
  });

  const photos = useQuery({
    queryKey: photosKey,
    queryFn: () => fetchProgressPhotos(userId!),
    enabled: Boolean(userId),
  });

  const saveGoal = useMutation({
    mutationFn: (params: { goal: PhysiqueGoal | null; targetDate: string | null }) =>
      savePhysiqueGoal(userId!, params.goal, params.targetDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKey });
      // Nutrition targets read the physique goal — force a fresh coaching pass.
      queryClient.invalidateQueries({ queryKey: ['nutrition-coaching', userId] });
    },
  });

  const addPhoto = useMutation({
    mutationFn: (params: { localUri: string; weightKg?: number | null }) =>
      addProgressPhoto({ userId: userId!, ...params }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photosKey }),
  });

  const removePhoto = useMutation({
    mutationFn: (photo: ProgressPhoto) => deleteProgressPhoto(photo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photosKey }),
  });

  return { goal, photos, saveGoal, addPhoto, removePhoto };
}
