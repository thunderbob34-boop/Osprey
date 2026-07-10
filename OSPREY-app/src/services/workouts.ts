import { endOfWeek, format, startOfWeek } from 'date-fns';
import { supabase } from '@/services/supabase';
import type {
  IntervalPrescription,
  LiftExercise,
  LiftPrescription,
  TrackPoint,
  WorkoutRecapData,
  WorkoutType,
} from '@/types/workout';
import { formatDuration, formatPace } from '@/store/workoutStore';
import { writeWorkoutToHealthKit } from '@/services/healthkit';
import { withCache } from '@/services/offline-cache';
import { formatWeightKg, type UnitSystem } from '@/services/units';
import type { HyroxDivision } from '@/services/calculators/hyrox';
import type { HyroxSplits } from '@/types/hyrox';

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
      mileDistance = 0;
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

  // No prior history for this exercise — matches the live mid-set PR check
  // in lift.tsx (`previousBest > 0 && score > previousBest`), which never
  // celebrates a first-ever log as a PR. Without this, a brand-new
  // exercise's first set always got flagged "New PR!" on the recap even
  // though the same session showed no PR haptic/toast mid-workout.
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

/**
 * Records a PR into coach_memory so the daily brief can reference it weeks
 * later. Deduped per (workout, exercise) at the DB level, so re-viewing the
 * recap never creates a duplicate or overwrites the original occurred_on
 * date. Best-effort — a failure here should never break the recap.
 */
async function recordPrMemory(
  userId: string,
  workoutId: string,
  exerciseId: string,
  exerciseName: string,
  weightLbs: number,
  reps: number,
): Promise<void> {
  try {
    const { error } = await supabase.from('coach_memory').upsert(
      {
        user_id: userId,
        event_type: 'pr',
        workout_id: workoutId,
        exercise_id: exerciseId,
        summary: `New PR on ${exerciseName} — ${weightLbs} lbs × ${reps} reps.`,
        metadata: { exerciseName, weightLbs, reps },
      },
      { onConflict: 'user_id,event_type,workout_id,exercise_id', ignoreDuplicates: true },
    );
    if (error) console.error('[coach-memory] PR record failed', error);
  } catch {
    // Best-effort — never let a memory-write failure surface to the user.
  }
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
        altitude_m: point.altitudeM ?? null,
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

export type EnduranceType = 'swim' | 'bike' | 'run' | 'rowing' | 'cross';

const ENDURANCE_TSS_PER_HOUR: Record<EnduranceType, number> = {
  swim: 65,
  bike: 45,
  // Matches the moderate-effort flat rate estimateTss() already uses
  // elsewhere for runs with no GPS pace data to work from.
  run: 50,
  // Full-body, ~75-80% aerobic per docs/coaching/rowing.md §2 — between
  // swim's upper-body-heavy 65 and bike's lower 45.
  rowing: 60,
  cross: 50,
};

/** Sums positive altitude deltas between consecutive GPS fixes — the only elevation-aware track (Hiking). */
export function computeElevationGainM(trackPoints: TrackPoint[]): number | null {
  const withAltitude = trackPoints.filter((p) => p.altitudeM != null);
  if (withAltitude.length < 2) return null;
  let gain = 0;
  for (let i = 1; i < withAltitude.length; i++) {
    const delta = withAltitude[i].altitudeM! - withAltitude[i - 1].altitudeM!;
    if (delta > 0) gain += delta;
  }
  return Math.round(gain);
}

export async function saveEnduranceWorkout(params: {
  userId: string;
  sessionId?: string | null;
  sessionType: EnduranceType;
  startedAt: number;
  durationS: number;
  distance?: { value: number; unit: 'meters' | 'yards' | 'km' | 'miles' } | null;
  heartRate?: number | null;
  /** Specific activity for a 'cross' session (e.g. "Yoga", "Rowing") — stored in workout_logs.notes. */
  notes?: string | null;
  /** CrossFit WOD score, free text — "18:32" or "5 rounds + 12 reps". */
  wodScore?: string | null;
  /** Stair Climber floor count. */
  floorsClimbed?: number | null;
  /** Hiking elevation gain — see computeElevationGainM. */
  elevationGainM?: number | null;
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
      notes: params.notes ?? null,
      wod_score: params.wodScore ?? null,
      floors_climbed: params.floorsClimbed ?? null,
      elevation_gain_m: params.elevationGainM ?? null,
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

// Full-body, race-intensity effort across running + strength + carries —
// no pace/HR data to derive a more precise number from, unlike GPS runs.
function estimateHyroxTss(durationS: number): number {
  return Math.round((durationS / 3600) * 70 * 10) / 10;
}

export async function saveHyroxWorkout(params: {
  userId: string;
  sessionId?: string | null;
  division: HyroxDivision;
  startedAt: number;
  durationS: number;
  splits: HyroxSplits;
}): Promise<string> {
  const { data: workout, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id: params.userId,
      session_id: params.sessionId ?? null,
      started_at: new Date(params.startedAt).toISOString(),
      ended_at: new Date(params.startedAt + params.durationS * 1000).toISOString(),
      session_type: 'hyrox',
      status: 'completed',
      // Each run segment is a fixed 1km — a customized/practice session can
      // skip some runs, so this isn't always the full race's 8km.
      total_distance_km: params.splits.runs.length,
      total_duration_s: params.durationS,
      hyrox_division: params.division,
      hyrox_splits: params.splits,
      tss: estimateHyroxTss(params.durationS),
    })
    .select('id')
    .single();

  if (error || !workout) throw error ?? new Error('Failed to save Hyrox session');

  writeWorkoutToHealthKit({
    sessionType: 'hyrox',
    startedAt: new Date(params.startedAt).toISOString(),
    endedAt: new Date(params.startedAt + params.durationS * 1000).toISOString(),
  }).catch(() => undefined);

  return workout.id;
}

export async function fetchWorkoutRecap(
  userId: string,
  workoutId: string,
  units: UnitSystem = 'imperial',
): Promise<WorkoutRecapData> {
  const { data: workout, error } = await supabase
    .from('workout_logs')
    .select('id, session_type, total_distance_km, total_duration_s, started_at, notes, hyrox_splits, training_sessions(description, ozzie_notes)')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .single();

  if (error || !workout) throw error ?? new Error('Workout not found');

  // PostgREST's embed shape for a to-one FK isn't always inferred as a plain
  // object by supabase-js's types — defend against either shape (same
  // pattern used in fetchLastSetsForExercises for workout_logs embeds).
  const rawPlannedSession = workout.training_sessions as unknown as
    | { description: string | null; ozzie_notes: string | null }
    | { description: string | null; ozzie_notes: string | null }[]
    | null;
  const plannedSession = Array.isArray(rawPlannedSession) ? rawPlannedSession[0] ?? null : rawPlannedSession;

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
    const activityLabel = workout.notes ? workout.notes.toLowerCase() : 'active recovery';
    ozzieDebrief = `Smart ${activityLabel} session — ${formatDuration(durationS)}. This is what the pros do on their easy days. Your body's rebuilding right now.`;
  }

  const exerciseMap = new Map<
    string,
    { name: string; sets: { setNumber: number; reps: number; weightLbs: number; completed: boolean }[] }
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
      if (isPr && topSet) {
        recordPrMemory(userId, workoutId, exerciseId, value.name, topSet.weightLbs, topSet.reps);
      }
      return { name: value.name, sets: value.sets, volumeLbs, isPr };
    }),
  );

  if (sessionType === 'lift' && exercises.length > 0) {
    const totalVolume = exercises.reduce((sum, ex) => sum + ex.volumeLbs, 0);
    const volumeText = formatWeightKg(totalVolume * LBS_TO_KG, units);
    ozzieDebrief = hasPr
      ? `Huge session — ${volumeText} of volume and a new PR. That's the work.`
      : `Strong lift — ${volumeText} total volume. Consistency builds champions.`;
  }

  // Reference the plan's own stated intent for this session ("why this is in
  // the plan," written when the week was generated) so the debrief ties the
  // just-finished effort back to the bigger picture, not just today's stats.
  if (plannedSession?.ozzie_notes) {
    ozzieDebrief = `${ozzieDebrief} ${plannedSession.ozzie_notes}`;
  }

  return {
    workout: {
      id: workout.id,
      sessionType,
      totalDistanceKm: workout.total_distance_km,
      totalDurationS: durationS,
      startedAt: workout.started_at,
      notes: workout.notes,
      hyroxSplits: (workout.hyrox_splits as HyroxSplits | null) ?? null,
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

export async function fetchDefaultLiftExercises(): Promise<{ id: string; name: string }[]> {
  // Cached so the exercise library is available for offline lift logging.
  return withCache(['exercise-library', 'default-lift'], async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .neq('muscle_group', 'Cardio')
      .neq('muscle_group', 'Recovery')
      .order('name')
      .limit(6);

    if (error) throw error;
    return data ?? [];
  });
}

export interface LibraryExercise {
  id: string;
  name: string;
  muscleGroup: string;
}

export async function fetchLiftPrescription(sessionId: string): Promise<LiftPrescription | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('lift_prescription')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data?.lift_prescription) return null;
  const prescription = data.lift_prescription as { exercises?: unknown };
  return Array.isArray(prescription.exercises) && prescription.exercises.length > 0
    ? (prescription as LiftPrescription)
    : null;
}

export async function fetchIntervalPrescription(sessionId: string): Promise<IntervalPrescription | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('interval_prescription')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data?.interval_prescription) return null;
  const prescription = data.interval_prescription as { segments?: unknown };
  return Array.isArray(prescription.segments) && prescription.segments.length > 0
    ? (prescription as IntervalPrescription)
    : null;
}

export async function fetchExerciseLibrary(): Promise<LibraryExercise[]> {
  // Full library for the in-session exercise picker, grouped by muscle.
  return withCache(['exercise-library', 'full'], async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle_group')
      .neq('muscle_group', 'Cardio')
      .neq('muscle_group', 'Recovery')
      .order('muscle_group')
      .order('name');

    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      muscleGroup: (row.muscle_group as string) ?? 'Other',
    }));
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

/**
 * Historical best single-set volume score (weightLbs × reps) per exercise,
 * used for live PR detection mid-session. Same scoring as detectSetPr, so a
 * mid-session celebration always matches the recap's PR flag. Exercises with
 * no history are absent from the result.
 */
export async function fetchBestSetScores(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, number>> {
  if (exerciseIds.length === 0) return {};

  const { data, error } = await supabase
    .from('exercise_sets')
    .select('exercise_id, reps, weight_kg, workout_logs!inner(user_id, deleted_at)')
    .in('exercise_id', exerciseIds)
    .eq('workout_logs.user_id', userId)
    .is('workout_logs.deleted_at', null);

  if (error) throw error;

  const best: Record<string, number> = {};
  for (const row of data ?? []) {
    const exerciseId = row.exercise_id as string;
    const scoreLbs = ((row.weight_kg as number | null) ?? 0) / LBS_TO_KG * ((row.reps as number | null) ?? 0);
    if (scoreLbs > (best[exerciseId] ?? 0)) best[exerciseId] = scoreLbs;
  }
  return best;
}
