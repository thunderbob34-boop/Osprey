import { endOfWeek, format, startOfWeek } from 'date-fns';
import { supabase } from '@/services/supabase';
import type { LiftExercise, TrackPoint, WorkoutRecapData, WorkoutType } from '@/types/workout';
import { formatDuration, formatPace } from '@/store/workoutStore';
import { writeWorkoutToHealthKit } from '@/services/healthkit';
import { withCache } from '@/services/offline-cache';

const LBS_TO_KG = 0.453592;

// Training Stress Score estimates for workouts that don't have HR/power data.
// Formula: (hours) * (intensity factor). Values are conservative approximates.
function estimateRunTss(durationS: number, distanceMeters: number): number {
  const durationH = durationS / 3600;
  if (distanceMeters > 0 && durationS > 0) {
    // Use pace to estimate intensity: sub-8min/mi = harder
    const paceMinsPerMile = (durationS / 60) / (distanceMeters / 1609.344);
    const intensityFactor = Math.max(0.5, Math.min(1.2, 8 / paceMinsPerMile));
    return Math.round(durationH * intensityFactor * intensityFactor * 100 * 10) / 10;
  }
  return Math.round(durationH * 50 * 10) / 10;
}

function estimateLiftTss(durationS: number): number {
  return Math.round((durationS / 3600) * 40 * 10) / 10;
}

function buildRunSplits(trackPoints: TrackPoint[], totalDurationS: number) {
  if (trackPoints.length < 2) {
    return [
      {
        mile: 1,
        pace: formatPace(totalDurationS),
        durationS: totalDurationS,
      },
    ];
  }

  const mileMeters = 1609.344;
  let mile = 1;
  let mileStartIndex = 0;
  let mileDistance = 0;
  const splits: WorkoutRecapData['splits'] = [];

  for (let i = 1; i < trackPoints.length; i += 1) {
    const prev = trackPoints[i - 1];
    const curr = trackPoints[i];
    const segment =
      Math.abs(curr.lat - prev.lat) + Math.abs(curr.lon - prev.lon) > 0
        ? haversine(prev.lat, prev.lon, curr.lat, curr.lon)
        : 0;
    mileDistance += segment;

    if (mileDistance >= mileMeters || i === trackPoints.length - 1) {
      const start = new Date(trackPoints[mileStartIndex].recordedAt).getTime();
      const end = new Date(curr.recordedAt).getTime();
      const durationS = Math.max(1, Math.round((end - start) / 1000));
      splits.push({
        mile,
        pace: formatPace(durationS),
        durationS,
      });
      mile += 1;
      mileStartIndex = i;
      // Carry the overshoot past the mile boundary forward instead of
      // discarding it, so it doesn't get silently dropped from the next split.
      mileDistance = mileDistance >= mileMeters ? mileDistance - mileMeters : 0;
    }
  }

  return splits.length > 0
    ? splits
    : [{ mile: 1, pace: formatPace(totalDurationS), durationS: totalDurationS }];
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function detectSetPr(
  userId: string,
  exerciseId: string,
  weightKg: number,
  reps: number,
  excludeWorkoutId?: string,
): Promise<boolean> {
  const { data: workouts } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const workoutIds = (workouts ?? [])
    .map((row) => row.id as string)
    .filter((id) => id !== excludeWorkoutId);

  // No training history for this exercise yet — nothing to compare against,
  // so this can't be confirmed as a PR (was previously announcing every
  // first-ever exercise as a "New PR!").
  if (workoutIds.length === 0) return false;

  const { data } = await supabase
    .from('exercise_sets')
    .select('weight_kg, reps')
    .eq('exercise_id', exerciseId)
    .in('workout_id', workoutIds);

  if (!data || data.length === 0) return false;

  const best = data.reduce((max, row) => {
    const score = (row.weight_kg ?? 0) * (row.reps ?? 0);
    return score > max ? score : max;
  }, 0);

  return weightKg * reps > best;
}

export async function saveRunWorkout(params: {
  userId: string;
  sessionId?: string | null;
  startedAt: number;
  durationS: number;
  distanceMeters: number;
  trackPoints: TrackPoint[];
  heartRate?: number | null;
}): Promise<string> {
  const { data: workout, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id: params.userId,
      session_id: params.sessionId ?? null,
      started_at: new Date(params.startedAt).toISOString(),
      ended_at: new Date(params.startedAt + params.durationS * 1000).toISOString(),
      session_type: 'run',
      status: 'completed',
      total_distance_km: params.distanceMeters / 1000,
      total_duration_s: params.durationS,
      avg_heart_rate: params.heartRate ?? null,
      tss: estimateRunTss(params.durationS, params.distanceMeters),
    })
    .select('id')
    .single();

  if (error || !workout) throw error ?? new Error('Failed to save run');

  if (params.trackPoints.length > 0) {
    const { error: trackError } = await supabase.from('activity_logs').insert(
      params.trackPoints.map((point) => ({
        workout_id: workout.id,
        user_id: params.userId,
        recorded_at: point.recordedAt,
        lat: point.lat,
        lon: point.lon,
        speed_ms: point.speedMs ?? null,
        heart_rate: point.heartRate ?? params.heartRate ?? null,
      })),
    );
    if (trackError) throw trackError;
  }

  writeWorkoutToHealthKit({
    sessionType: 'run',
    startedAt: new Date(params.startedAt).toISOString(),
    endedAt: new Date(params.startedAt + params.durationS * 1000).toISOString(),
    distanceMeters: params.distanceMeters,
  }).catch(() => undefined);

  return workout.id;
}

export async function saveLiftWorkout(params: {
  userId: string;
  sessionId?: string | null;
  startedAt: number;
  durationS: number;
  exercises: LiftExercise[];
}): Promise<string> {
  const { data: workout, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id: params.userId,
      session_id: params.sessionId ?? null,
      started_at: new Date(params.startedAt).toISOString(),
      ended_at: new Date(params.startedAt + params.durationS * 1000).toISOString(),
      session_type: 'lift',
      status: 'completed',
      total_duration_s: params.durationS,
      tss: estimateLiftTss(params.durationS),
    })
    .select('id')
    .single();

  if (error || !workout) throw error ?? new Error('Failed to save lift');

  const completedSets = params.exercises.flatMap((exercise) =>
    exercise.sets
      .filter((set) => set.completed)
      .map((set) => ({
        workout_id: workout.id,
        exercise_id: exercise.exerciseId,
        set_number: set.setNumber,
        reps: set.reps,
        weight_kg: Math.round(set.weightLbs * LBS_TO_KG * 10) / 10,
      })),
  );

  if (completedSets.length > 0) {
    const { error: setsError } = await supabase.from('exercise_sets').insert(completedSets);
    if (setsError) throw setsError;
  }

  writeWorkoutToHealthKit({
    sessionType: 'lift',
    startedAt: new Date(params.startedAt).toISOString(),
    endedAt: new Date(params.startedAt + params.durationS * 1000).toISOString(),
  }).catch(() => undefined);

  return workout.id;
}

export type EnduranceType = 'swim' | 'bike' | 'cross';

const ENDURANCE_TSS_PER_HOUR: Record<EnduranceType, number> = {
  swim: 65,
  bike: 45,
  cross: 50,
};

export async function saveEnduranceWorkout(params: {
  userId: string;
  sessionId?: string | null;
  sessionType: EnduranceType;
  startedAt: number;
  durationS: number;
  distance?: { value: number; unit: 'meters' | 'yards' | 'km' | 'miles' } | null;
  heartRate?: number | null;
}): Promise<string> {
  const tss = Math.round((params.durationS / 3600) * ENDURANCE_TSS_PER_HOUR[params.sessionType] * 10) / 10;

  // Convert distance to km
  let distanceKm: number | null = null;
  if (params.distance?.value) {
    const { value, unit } = params.distance;
    const conversions: Record<string, number> = {
      meters: 0.001,
      yards: 0.0009144,
      km: 1,
      miles: 1.60934,
    };
    distanceKm = Math.round(value * conversions[unit] * 100) / 100;
  }

  const { data: workout, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id: params.userId,
      session_id: params.sessionId ?? null,
      started_at: new Date(params.startedAt).toISOString(),
      ended_at: new Date(params.startedAt + params.durationS * 1000).toISOString(),
      session_type: params.sessionType,
      status: 'completed',
      total_distance_km: distanceKm,
      total_duration_s: params.durationS,
      avg_heart_rate: params.heartRate ?? null,
      tss,
    })
    .select('id')
    .single();

  if (error || !workout) throw error ?? new Error('Failed to save workout');

  writeWorkoutToHealthKit({
    sessionType: params.sessionType,
    startedAt: new Date(params.startedAt).toISOString(),
    endedAt: new Date(params.startedAt + params.durationS * 1000).toISOString(),
  }).catch(() => undefined);

  return workout.id;
}

export async function fetchWorkoutRecap(
  userId: string,
  workoutId: string,
): Promise<WorkoutRecapData> {
  const { data: workout, error } = await supabase
    .from('workout_logs')
    .select('id, session_type, total_distance_km, total_duration_s, started_at, notes')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .single();

  if (error || !workout) throw error ?? new Error('Workout not found');

  const { data: trackPoints } = await supabase
    .from('activity_logs')
    .select('lat, lon, recorded_at, speed_ms, heart_rate')
    .eq('workout_id', workoutId)
    .order('recorded_at', { ascending: true });

  const { data: setRows } = await supabase
    .from('exercise_sets')
    .select('exercise_id, set_number, reps, weight_kg, exercises(name)')
    .eq('workout_id', workoutId)
    .order('set_number', { ascending: true });

  const sessionType = workout.session_type as WorkoutType;
  const durationS = workout.total_duration_s ?? 0;
  const distanceMiles =
    workout.total_distance_km != null
      ? Math.round(workout.total_distance_km * 0.621371 * 10) / 10
      : null;

  let ozzieDebrief = 'Solid work today. Recovery matters — hydrate and get after it tomorrow.';
  let hasPr = false;

  if (sessionType === 'run') {
    const pace =
      distanceMiles && distanceMiles > 0
        ? formatPace(durationS / distanceMiles)
        : formatPace(durationS);
    ozzieDebrief = `Nice run — ${distanceMiles ?? 0} miles in ${formatDuration(durationS)} at ${pace} pace. You held it together well.`;
  } else if (sessionType === 'swim') {
    ozzieDebrief = `Solid swim — ${formatDuration(durationS)} in the water. Technique is what separates good swimmers from great ones. Good work.`;
  } else if (sessionType === 'bike') {
    ozzieDebrief = `Good ride — ${formatDuration(durationS)} on the bike. Steady aerobic base work like this pays dividends on race day.`;
  } else if (sessionType === 'cross') {
    ozzieDebrief = `Smart active recovery session — ${formatDuration(durationS)}. This is what the pros do on their easy days. Your body's rebuilding right now.`;
  }

  const exerciseMap = new Map<
    string,
    { name: string; sets: Array<{ setNumber: number; reps: number; weightLbs: number; completed: boolean }> }
  >();

  if (setRows) {
    for (const row of setRows) {
      const exerciseId = row.exercise_id as string;
      const name = (row.exercises as { name?: string } | null)?.name ?? 'Exercise';
      const existing = exerciseMap.get(exerciseId) ?? { name, sets: [] };
      existing.sets.push({
        setNumber: row.set_number,
        reps: row.reps ?? 0,
        weightLbs: Math.round((row.weight_kg ?? 0) / LBS_TO_KG),
        completed: true,
      });
      exerciseMap.set(exerciseId, existing);
    }
  }

  const exercises = await Promise.all(
    Array.from(exerciseMap.entries()).map(async ([exerciseId, value]) => {
      const volumeLbs = value.sets.reduce((sum, set) => sum + set.reps * set.weightLbs, 0);
      const topSet = value.sets.reduce(
        (best, set) => (set.weightLbs * set.reps > best.weightLbs * best.reps ? set : best),
        value.sets[0],
      );
      const isPr = topSet
        ? await detectSetPr(
            userId,
            exerciseId,
            topSet.weightLbs * LBS_TO_KG,
            topSet.reps,
            workoutId,
          )
        : false;
      if (isPr) hasPr = true;
      return { name: value.name, sets: value.sets, volumeLbs, isPr };
    }),
  );

  if (sessionType === 'lift' && exercises.length > 0) {
    const totalVolume = exercises.reduce((sum, ex) => sum + ex.volumeLbs, 0);
    ozzieDebrief = hasPr
      ? `Huge session — ${totalVolume.toLocaleString()} lbs of volume and a new PR. That's the work.`
      : `Strong lift — ${totalVolume.toLocaleString()} lbs total volume. Consistency builds champions.`;
  }

  return {
    workout: {
      id: workout.id,
      sessionType,
      totalDistanceKm: workout.total_distance_km,
      totalDurationS: durationS,
      startedAt: workout.started_at,
      notes: workout.notes,
    },
    splits: buildRunSplits(
      (trackPoints ?? []).map((p) => ({
        lat: Number(p.lat),
        lon: Number(p.lon),
        recordedAt: p.recorded_at,
        speedMs: p.speed_ms ?? undefined,
        heartRate: p.heart_rate ?? undefined,
      })),
      durationS,
    ),
    exercises,
    ozzieDebrief,
    hasPr,
  };
}

export async function fetchWeekTargetKm(userId: string): Promise<number | undefined> {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('training_sessions')
    .select('planned_distance_km')
    .eq('user_id', userId)
    .gte('session_date', weekStart)
    .lte('session_date', weekEnd);

  if (error) return undefined;

  const total = (data ?? []).reduce((sum, row) => sum + (row.planned_distance_km ?? 0), 0);
  return total > 0 ? total : undefined;
}

export async function fetchDefaultLiftExercises(): Promise<Array<{ id: string; name: string }>> {
  // Cached so the exercise library is available for offline lift logging.
  return withCache(['exercise-library', 'default-lift'], async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .neq('muscle_group', 'Cardio')
      .neq('muscle_group', 'Recovery')
      .limit(6);

    if (error) throw error;
    return data ?? [];
  });
}

export async function fetchLastSetsForExercises(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, { reps: number; weightLbs: number }>> {
  if (exerciseIds.length === 0) return {};

  const { data, error } = await supabase
    .from('exercise_sets')
    .select('exercise_id, reps, weight_kg, workout_logs!inner(user_id, started_at)')
    .in('exercise_id', exerciseIds)
    .eq('workout_logs.user_id', userId);

  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    exerciseId: row.exercise_id as string,
    reps: row.reps as number | null,
    weightKg: row.weight_kg as number | null,
    startedAt: (row.workout_logs as unknown as { started_at: string } | { started_at: string }[] | null) instanceof Array
      ? ((row.workout_logs as unknown as { started_at: string }[])[0]?.started_at ?? '')
      : ((row.workout_logs as unknown as { started_at: string } | null)?.started_at ?? ''),
  }));

  rows.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)); // most recent first

  const lastByExercise: Record<string, { reps: number; weightLbs: number }> = {};
  for (const row of rows) {
    if (lastByExercise[row.exerciseId]) continue; // already have the most recent for this exercise
    lastByExercise[row.exerciseId] = {
      reps: row.reps ?? 8,
      weightLbs: Math.round((row.weightKg ?? 0) / LBS_TO_KG),
    };
  }
  return lastByExercise;
}
