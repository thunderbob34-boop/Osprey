import { supabase } from '@/services/supabase';
import { fetchHealthKitWorkouts } from '@/services/healthkit';

// Maps HealthKit's free-text activityName (what Apple Watch/Garmin's
// HealthKit bridge reports) to OSPREY's session_type_enum. Unrecognized
// activities default to 'cross' rather than being dropped, since a workout
// missing from load/recovery math is worse than a mis-labeled one.
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  Running: 'run',
  Walking: 'run',
  Hiking: 'run',
  TrackAndField: 'run',
  Cycling: 'bike',
  HandCycling: 'bike',
  Swimming: 'swim',
  TraditionalStrengthTraining: 'lift',
  FunctionalStrengthTraining: 'lift',
  CoreTraining: 'lift',
  CrossTraining: 'cross',
  HighIntensityIntervalTraining: 'cross',
  Yoga: 'cross',
  Pilates: 'cross',
  Rowing: 'cross',
  Elliptical: 'cross',
  StairClimbing: 'cross',
  Dance: 'cross',
};

function mapActivityToSessionType(activityName: string): string {
  return ACTIVITY_TYPE_MAP[activityName] ?? 'cross';
}

export interface HealthKitImportResult {
  imported: number;
  skipped: number;
}

/**
 * Imports HealthKit workouts (Apple Watch, Garmin, any HealthKit-writing
 * app) from the last `daysBack` days into workout_logs. Safe to call
 * repeatedly — the unique (user_id, external_id) index makes re-imports a
 * no-op instead of creating duplicates.
 */
export async function importHealthKitWorkouts(
  userId: string,
  daysBack = 14,
): Promise<HealthKitImportResult> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const workouts = await fetchHealthKitWorkouts(since);

  if (workouts.length === 0) return { imported: 0, skipped: 0 };

  const rows = workouts.map((w) => ({
    user_id: userId,
    external_id: w.externalId,
    source: 'healthkit',
    session_type: mapActivityToSessionType(w.activityName),
    status: 'completed',
    started_at: w.startedAt,
    ended_at: w.endedAt,
    total_duration_s: w.durationS,
    total_distance_km: w.distanceMeters != null ? Math.round((w.distanceMeters / 1000) * 1000) / 1000 : null,
    calories_burned: w.calories,
  }));

  const { data, error } = await supabase
    .from('workout_logs')
    .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
    .select('id');

  if (error) throw error;

  const imported = data?.length ?? 0;
  return { imported, skipped: workouts.length - imported };
}
