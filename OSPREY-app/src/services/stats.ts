import { format, startOfWeek, subWeeks } from 'date-fns';
import { supabase } from '@/services/supabase';
import { localDateString } from '@/utils/date';
import type {
  RecentWorkoutRow,
  SportPeriodTotal,
  SportType,
  StatsData,
  WeeklySportPoint,
} from '@/types/stats';

const MILES_PER_KM = 0.621371;
const WEEKS_BACK = 6;

function kmToMiles(km: number): number {
  return Math.round(km * MILES_PER_KM * 10) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

  // ── Per-sport weekly volume (stacked hours by run/bike/swim/lift/cross/race) ──
  const weeklySportBuckets = new Map<string, Partial<Record<SportType, { hours: number; km: number }>>>();
  for (let i = 0; i < WEEKS_BACK; i += 1) {
    const weekStart = startOfWeek(subWeeks(now, WEEKS_BACK - 1 - i), { weekStartsOn: 1 });
    weeklySportBuckets.set(localDateString(weekStart), {});
  }

  for (const row of rows) {
    const weekStart = startOfWeek(new Date(row.started_at), { weekStartsOn: 1 });
    const key = localDateString(weekStart);
    const bucket = weeklySportBuckets.get(key);
    if (!bucket) continue;

    const sport = row.session_type as SportType;
    const entry = bucket[sport] ?? { hours: 0, km: 0 };
    entry.hours += (row.total_duration_s ?? 0) / 3600;
    entry.km += row.total_distance_km ?? 0;
    bucket[sport] = entry;
  }

  const weeklySportVolume: WeeklySportPoint[] = Array.from(weeklySportBuckets.entries()).map(
    ([weekStartIso, bucket]) => {
      const hoursBySport: Partial<Record<SportType, number>> = {};
      let totalHours = 0;
      for (const [sport, v] of Object.entries(bucket) as [SportType, { hours: number; km: number }][]) {
        hoursBySport[sport] = round1(v.hours);
        totalHours += v.hours;
      }
      return {
        weekStartIso,
        label: format(new Date(weekStartIso), 'MMM d'),
        hoursBySport,
        totalHours: round1(totalHours),
      };
    },
  );

  // ── Per-sport totals across the same window, for the legend under the chart ──
  const sportTotalsMap = new Map<SportType, { hours: number; km: number }>();
  for (const row of rows) {
    const sport = row.session_type as SportType;
    const entry = sportTotalsMap.get(sport) ?? { hours: 0, km: 0 };
    entry.hours += (row.total_duration_s ?? 0) / 3600;
    entry.km += row.total_distance_km ?? 0;
    sportTotalsMap.set(sport, entry);
  }

  const sportTotalsPeriod: SportPeriodTotal[] = Array.from(sportTotalsMap.entries())
    .map(([sessionType, v]) => ({
      sessionType,
      hours: round1(v.hours),
      miles: v.km > 0 ? kmToMiles(v.km) : null,
    }))
    .sort((a, b) => b.hours - a.hours);

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
    weeklySportVolume,
    sportTotalsPeriod,
    recentWorkouts,
  };
}
