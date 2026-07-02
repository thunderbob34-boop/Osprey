import { format, startOfWeek, subWeeks } from 'date-fns';
import { supabase } from '@/services/supabase';
import type { RecentWorkoutRow, StatsData, WeeklyMileagePoint } from '@/types/stats';

const MILES_PER_KM = 0.621371;
const WEEKS_BACK = 6;

function kmToMiles(km: number): number {
  return Math.round(km * MILES_PER_KM * 10) / 10;
}

export async function fetchStats(userId: string): Promise<StatsData> {
  const since = startOfWeek(subWeeks(new Date(), WEEKS_BACK - 1), { weekStartsOn: 1 });

  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, session_type, started_at, total_duration_s, total_distance_km')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const last30d = rows.filter((row) => new Date(row.started_at) >= thirtyDaysAgo);

  const totalWorkouts30d = last30d.length;
  const totalMiles30d = kmToMiles(
    last30d.reduce((sum, row) => sum + (row.total_distance_km ?? 0), 0),
  );
  const totalMinutes30d = Math.round(
    last30d.reduce((sum, row) => sum + (row.total_duration_s ?? 0), 0) / 60,
  );

  const weeklyBuckets = new Map<string, number>();
  for (let i = 0; i < WEEKS_BACK; i += 1) {
    const weekStart = startOfWeek(subWeeks(now, WEEKS_BACK - 1 - i), { weekStartsOn: 1 });
    weeklyBuckets.set(weekStart.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const weekStart = startOfWeek(new Date(row.started_at), { weekStartsOn: 1 });
    const key = weekStart.toISOString().slice(0, 10);
    if (weeklyBuckets.has(key)) {
      weeklyBuckets.set(key, (weeklyBuckets.get(key) ?? 0) + (row.total_distance_km ?? 0));
    }
  }

  const weeklyMileage: WeeklyMileagePoint[] = Array.from(weeklyBuckets.entries()).map(
    ([weekStartIso, km]) => ({
      weekStartIso,
      label: format(new Date(weekStartIso), 'MMM d'),
      miles: kmToMiles(km),
    }),
  );

  const recentWorkouts: RecentWorkoutRow[] = rows.slice(0, 10).map((row) => ({
    id: row.id,
    sessionType: row.session_type,
    startedAt: row.started_at,
    durationMinutes: Math.round((row.total_duration_s ?? 0) / 60),
    distanceMiles: row.total_distance_km != null ? kmToMiles(row.total_distance_km) : null,
  }));

  return {
    totalWorkouts30d,
    totalMiles30d,
    totalMinutes30d,
    weeklyMileage,
    recentWorkouts,
  };
}
