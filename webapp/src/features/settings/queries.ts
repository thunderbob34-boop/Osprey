import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { UnitSystem } from '../../lib/units';
import { parseThresholdAnchor, type ThresholdAnchorMap } from '../../lib/threshold-anchor';

export function useUnits(userId: string) {
  return useQuery({
    queryKey: ['units', userId],
    queryFn: async (): Promise<UnitSystem> => {
      const { data, error } = await supabase.from('users').select('units').eq('id', userId).maybeSingle();
      if (error) throw error;
      return (data?.units as UnitSystem | null) ?? 'imperial';
    },
  });
}

export function useUpdateUnits(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (units: UnitSystem) => {
      const { error } = await supabase.from('users').update({ units }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['units', userId] }),
  });
}

export function useLocationZip(userId: string) {
  return useQuery({
    queryKey: ['location-zip', userId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('users').select('location_zip').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data?.location_zip ?? null;
    },
  });
}

export function useUpdateLocationZip(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (locationZip: string) => {
      const { error } = await supabase.from('users').update({ location_zip: locationZip }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['location-zip', userId] }),
  });
}

export function useThresholdAnchor(userId: string) {
  return useQuery({
    queryKey: ['threshold-anchor', userId],
    queryFn: async (): Promise<ThresholdAnchorMap> => {
      const { data, error } = await supabase.from('user_goals').select('threshold_anchor').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return parseThresholdAnchor(data?.threshold_anchor);
    },
  });
}

export function useUpdateThresholdAnchor(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nextMap: ThresholdAnchorMap) => {
      // .select() returns the matched rows — empty means no user_goals row existed,
      // so surface an error instead of a silent no-op success.
      const { data, error } = await supabase
        .from('user_goals')
        .update({ threshold_anchor: nextMap })
        .eq('user_id', userId)
        .select('user_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Could not save — no goals record found for your account.');
    },
    // Return (don't `void`) the invalidation so the mutation stays pending until the
    // refetch settles — otherwise buttons re-enable while the cached map is stale, and
    // a fast second-sport save would build off the old map and drop the just-saved one.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threshold-anchor', userId] }),
  });
}
