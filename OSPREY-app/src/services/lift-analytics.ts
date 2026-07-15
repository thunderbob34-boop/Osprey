import { supabase } from '@/services/supabase';
import { localDateString } from '@/utils/date';
import type { PowerliftingLift } from '@/services/calculators/powerlifting';

interface RawSetRow {
  reps: number | null;
  weight_kg: number | null;
  started_at: string;
  exercise_name: string;
  muscle_group: string;
}

export interface MuscleGroupVolume {
  muscleGroup: string;
  volumeKg: number;
}

export interface LiftTrendPoint {
  date: string;
  e1rmKg: number;
}

export interface ExercisePr {
  exerciseName: string;
  bestE1rmKg: number;
  achievedOn: string;
}

export interface LiftAnalytics {
  /** This week's (Mon-start) total volume in kg, and breakdown by muscle group. */
  weekVolumeKg: number;
  weekMuscleGroups: MuscleGroupVolume[];
  /** e1RM trend for the athlete's most-logged compound lift, if any data exists. */
  primaryLift: { exerciseName: string; trend: LiftTrendPoint[] } | null;
  /** Top 5 lifts by estimated 1-rep max, most recent PR first when tied. */
  prs: ExercisePr[];
}

/** Epley formula — standard estimated-1RM approximation used industry-wide. */
function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

function mondayStart(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return localDateString(date);
}

export async function fetchLiftAnalytics(userId: string, weeksBack = 8): Promise<LiftAnalytics> {
  const cutoff = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('exercise_sets')
    .select(
      'reps, weight_kg, workout_logs!inner(started_at, user_id, deleted_at), exercises!inner(name, muscle_group)',
    )
    .eq('workout_logs.user_id', userId)
    .is('workout_logs.deleted_at', null)
    .gte('workout_logs.started_at', cutoff)
    .not('weight_kg', 'is', null)
    .not('reps', 'is', null);

  if (error) throw error;

  const rows: RawSetRow[] = (data ?? []).map((row) => {
    const workout = row.workout_logs as unknown as { started_at: string } | { started_at: string }[];
    const exercise = row.exercises as unknown as { name: string; muscle_group: string } | { name: string; muscle_group: string }[];
    const startedAt = Array.isArray(workout) ? workout[0]?.started_at : workout?.started_at;
    const ex = Array.isArray(exercise) ? exercise[0] : exercise;
    return {
      reps: row.reps as number | null,
      weight_kg: row.weight_kg as number | null,
      started_at: startedAt ?? '',
      exercise_name: ex?.name ?? 'Unknown',
      muscle_group: ex?.muscle_group ?? 'Other',
    };
  });

  // ── This week's volume by muscle group ──
  const thisWeekStart = mondayStart(new Date());
  const weekMuscleMap = new Map<string, number>();
  let weekVolumeKg = 0;
  for (const row of rows) {
    if (row.reps == null || row.weight_kg == null) continue;
    if (mondayStart(new Date(row.started_at)) !== thisWeekStart) continue;
    const volume = row.reps * row.weight_kg;
    weekVolumeKg += volume;
    weekMuscleMap.set(row.muscle_group, (weekMuscleMap.get(row.muscle_group) ?? 0) + volume);
  }
  const weekMuscleGroups = Array.from(weekMuscleMap.entries())
    .map(([muscleGroup, volumeKg]) => ({ muscleGroup, volumeKg: Math.round(volumeKg) }))
    .sort((a, b) => b.volumeKg - a.volumeKg)
    .slice(0, 5);

  // ── e1RM per (exercise, date), then best-per-exercise for PRs ──
  const e1rmByExerciseDate = new Map<string, Map<string, number>>();
  const setCountByExercise = new Map<string, number>();
  for (const row of rows) {
    if (row.reps == null || row.weight_kg == null || row.reps <= 0) continue;
    const date = row.started_at.slice(0, 10);
    const e1rm = estimate1RM(row.weight_kg, row.reps);
    setCountByExercise.set(row.exercise_name, (setCountByExercise.get(row.exercise_name) ?? 0) + 1);
    const byDate = e1rmByExerciseDate.get(row.exercise_name) ?? new Map<string, number>();
    byDate.set(date, Math.max(byDate.get(date) ?? 0, e1rm));
    e1rmByExerciseDate.set(row.exercise_name, byDate);
  }

  const prs: ExercisePr[] = Array.from(e1rmByExerciseDate.entries())
    .map(([exerciseName, byDate]) => {
      let bestE1rmKg = 0;
      let achievedOn = '';
      for (const [date, e1rm] of byDate) {
        if (e1rm >= bestE1rmKg) {
          bestE1rmKg = e1rm;
          achievedOn = date;
        }
      }
      return { exerciseName, bestE1rmKg: Math.round(bestE1rmKg * 10) / 10, achievedOn };
    })
    .sort((a, b) => b.bestE1rmKg - a.bestE1rmKg)
    .slice(0, 5);

  // ── Primary lift trend: whichever exercise has the most logged sets ──
  let primaryLift: LiftAnalytics['primaryLift'] = null;
  if (setCountByExercise.size > 0) {
    const [topExercise] = Array.from(setCountByExercise.entries()).sort((a, b) => b[1] - a[1])[0];
    const byDate = e1rmByExerciseDate.get(topExercise);
    if (byDate && byDate.size >= 2) {
      const trend = Array.from(byDate.entries())
        .map(([date, e1rmKg]) => ({ date, e1rmKg: Math.round(e1rmKg * 10) / 10 }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      primaryLift = { exerciseName: topExercise, trend };
    }
  }

  return { weekVolumeKg: Math.round(weekVolumeKg), weekMuscleGroups, primaryLift, prs };
}

const LIFT_EXERCISE_NAME: Record<PowerliftingLift, string> = { squat: 'Back Squat', bench: 'Bench Press', deadlift: 'Deadlift' };

/** Best estimated 1RM (kg) for a comp lift from analytics.prs, or null if it isn't in the athlete's top lifts. */
export function bestE1rmForLift(analytics: LiftAnalytics, lift: PowerliftingLift): number | null {
  const pr = analytics.prs.find((p) => p.exerciseName === LIFT_EXERCISE_NAME[lift]);
  return pr ? Math.round(pr.bestE1rmKg) : null;
}
