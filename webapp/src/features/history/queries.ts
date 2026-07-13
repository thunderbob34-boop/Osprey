import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { WorkoutLogSchema, type WorkoutLog } from '../../lib/schemas';

export const PAGE_SIZE = 50;
export interface HistoryFilter { type: string | null; from: string | null; to: string | null; page: number; }

export function useHistory(userId: string, f: HistoryFilter) {
  return useQuery({
    queryKey: ['history', userId, f.type ?? 'all', f.from ?? '', f.to ?? '', f.page],
    queryFn: async (): Promise<{ rows: WorkoutLog[]; count: number }> => {
      let q = supabase.from('workout_logs').select('*', { count: 'exact' })
        .eq('user_id', userId).is('deleted_at', null)
        .order('started_at', { ascending: false })
        .range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE - 1);
      if (f.type) q = q.eq('session_type', f.type);
      if (f.from) q = q.gte('started_at', `${f.from}T00:00:00Z`);
      if (f.to) q = q.lte('started_at', `${f.to}T23:59:59Z`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: z.array(WorkoutLogSchema).parse(data), count: count ?? 0 };
    },
  });
}
