import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { UnitSystem } from '../../lib/units';

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
