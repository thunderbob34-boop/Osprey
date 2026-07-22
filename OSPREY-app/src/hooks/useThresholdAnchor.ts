import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import type { ThresholdAnchorMap } from '@/services/coaching/baseline';

export function useThresholdAnchor() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<ThresholdAnchorMap>({
    queryKey: ['threshold-anchor', userId],
    queryFn: async (): Promise<ThresholdAnchorMap> => {
      const { data, error } = await supabase
        .from('user_goals')
        .select('threshold_anchor')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.threshold_anchor as ThresholdAnchorMap | null) ?? {};
    },
    enabled: Boolean(userId),
  });
}

export function useUpdateThresholdAnchor() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nextMap: ThresholdAnchorMap) => {
      // .select() returns the matched rows — empty means no user_goals row existed,
      // so surface an error instead of a silent no-op success (mirrors the webapp's
      // identical guard in webapp/src/features/settings/queries.ts).
      const { data, error } = await supabase
        .from('user_goals')
        .update({ threshold_anchor: nextMap })
        .eq('user_id', userId!)
        .select('user_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Could not save — no goals record found for your account.');
    },
    // A saved/cleared anchor invalidates its own cache AND the derived display-zones
    // cache (Task 2's key) — every other open/next-visited screen (Home, run screen,
    // plan-preview) reflects the correction immediately, no restart needed.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['threshold-anchor', userId] }),
        queryClient.invalidateQueries({ queryKey: ['display-zones', userId] }),
      ]),
  });
}
