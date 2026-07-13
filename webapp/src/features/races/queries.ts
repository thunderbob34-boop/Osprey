import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface NewRaceEventInput {
  name: string;
  eventDate: string; // YYYY-MM-DD
  distanceKm: number | null;
  raceUrl: string | null;
  notes: string | null;
}

export function useCreateRaceEvent(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewRaceEventInput) => {
      const { error } = await supabase.from('race_events').insert({
        user_id: userId,
        name: input.name,
        event_date: input.eventDate,
        distance_km: input.distanceKm,
        race_url: input.raceUrl,
        notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['race-events'] });
      void qc.invalidateQueries({ queryKey: ['next-race-event'] });
    },
  });
}
