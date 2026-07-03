import { Platform } from 'react-native';
import { format } from 'date-fns';
import AppleHealthKit from 'react-native-health';
import type {
  HealthActivity,
  HealthInputOptions,
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health';
import { supabase } from '@/services/supabase';

// Same bounded subjective modifier the ozzie-checkin edge function applies
// (energy ±8, soreness up to -10, clamped [-12, +8]). Recomputed here so a
// HealthKit sync that lands after a spoken check-in preserves the subjective
// signal instead of overwriting the score from objective data alone.
function subjectiveModifier(energyLevel: number | null, sorenessAreas: string[] | null): number {
  if (energyLevel == null) return 0;
  const energyPart = (energyLevel - 3) * 4;
  const sorenessPart = -Math.min(10, (sorenessAreas?.length ?? 0) * 5);
  return Math.max(-12, Math.min(8, energyPart + sorenessPart));
}

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
    ],
    write: [AppleHealthKit.Constants.Permissions.Workout],
  },
};

let initialized = false;

export function isHealthKitSupported(): boolean {
  return Platform.OS === 'ios';
}

export async function requestHealthKitAuthorization(): Promise<boolean> {
  if (!isHealthKitSupported()) return false;

  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (error) => {
      if (error) {
        console.warn('[HealthKit] init error:', error);
        resolve(false);
        return;
      }
      initialized = true;
      resolve(true);
    });
  });
}

function fetchSamples(
  fn: (options: HealthInputOptions, cb: (err: string, results: HealthValue[]) => void) => void,
  options: HealthInputOptions,
): Promise<HealthValue[]> {
  return new Promise((resolve) => {
    fn(options, (err, results) => {
      if (err) {
        resolve([]);
        return;
      }
      resolve(results ?? []);
    });
  });
}

// react-native-health's HealthKit queries default to `ascending: false`
// (newest first), so the most recent sample is index 0, not the last one.
const SAMPLE_OPTIONS = { ascending: false } as const;

// Sleep categories that represent time actually asleep. HealthKit reports
// overlapping INBED + ASLEEP (legacy) or INBED + CORE/DEEP/REM (iOS 16+)
// samples for the same period, so summing every sample's duration roughly
// doubles the true sleep time. INBED/AWAKE are excluded and the remaining
// intervals are merged before summing.
const ASLEEP_VALUES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

function sumMergedSleepHours(samples: HealthValue[]): number | null {
  const intervals = samples
    .filter((s) => ASLEEP_VALUES.has(String((s as unknown as { value: string }).value)))
    .map((s) => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  // No asleep-category samples (e.g. only INBED, no ASLEEP/CORE/DEEP/REM) —
  // that's "unknown", not "zero hours of sleep"; the scoring below treats
  // null as "skip this factor" vs. 0 which would apply the worst penalty.
  if (intervals.length === 0) return null;

  let totalMs = 0;
  let [curStart, curEnd] = intervals[0];
  for (const [start, end] of intervals.slice(1)) {
    if (start <= curEnd) {
      curEnd = Math.max(curEnd, end);
    } else {
      totalMs += curEnd - curStart;
      [curStart, curEnd] = [start, end];
    }
  }
  totalMs += curEnd - curStart;

  return totalMs / 3600000;
}

/**
 * Pulls last night's HRV, resting HR, and sleep duration from HealthKit and
 * writes a recovery_scores row for today using a simple v1 scoring formula.
 * Real algorithmic tuning is a future pass — this establishes the pipeline.
 */
export async function syncRecoveryFromHealthKit(userId: string): Promise<boolean> {
  if (!isHealthKitSupported() || !initialized) return false;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Local date, matching the spoken check-in's key — a UTC date would land on
  // a different recovery_scores row near midnight and split the two signals.
  const today = format(new Date(), 'yyyy-MM-dd');

  const [hrvSamples, restingHrSamples, sleepSamples] = await Promise.all([
    fetchSamples(AppleHealthKit.getHeartRateVariabilitySamples, {
      startDate: since,
      unit: AppleHealthKit.Constants.Units.count,
      ...SAMPLE_OPTIONS,
    }),
    fetchSamples(AppleHealthKit.getRestingHeartRateSamples, { startDate: since, ...SAMPLE_OPTIONS }),
    fetchSamples(AppleHealthKit.getSleepSamples, { startDate: since }),
  ]);

  if (hrvSamples.length === 0 && restingHrSamples.length === 0 && sleepSamples.length === 0) {
    return false; // nothing new to sync
  }

  // The native module ignores the `unit` option for HRV and always returns
  // seconds — convert to ms (the unit `hrv_ms` and the scoring thresholds
  // below expect), or every reading comes back as ~0.0x and gets scored as
  // critically low HRV.
  const hrvMs = hrvSamples.length > 0 ? hrvSamples[0].value * 1000 : null;
  const restingHr = restingHrSamples.length > 0 ? restingHrSamples[0].value : null;
  const sleepHours = sleepSamples.length > 0 ? sumMergedSleepHours(sleepSamples) : null;

  // v1 scoring: simple weighted heuristic, not a clinical algorithm.
  let score = 70;
  if (hrvMs != null) score += hrvMs > 60 ? 10 : hrvMs < 30 ? -15 : 0;
  if (sleepHours != null) score += sleepHours >= 7 ? 10 : sleepHours < 5 ? -20 : -5;

  // Fold in today's spoken check-in if one exists, so an objective sync doesn't
  // wipe the subjective signal (and so order of operations doesn't matter).
  const { data: checkin } = await supabase
    .from('subjective_checkins')
    .select('energy_level, soreness_areas')
    .eq('user_id', userId)
    .eq('checkin_date', today)
    .maybeSingle();
  if (checkin) {
    score += subjectiveModifier(checkin.energy_level, checkin.soreness_areas);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const recommendation = score >= 65 ? 'train' : score >= 40 ? 'easy' : 'rest';

  const { error } = await supabase.from('recovery_scores').upsert(
    {
      user_id: userId,
      score_date: today,
      score,
      hrv_ms: hrvMs,
      resting_hr: restingHr,
      sleep_hours: sleepHours != null ? Math.round(sleepHours * 100) / 100 : null,
      recommendation,
    },
    { onConflict: 'user_id,score_date' },
  );

  return !error;
}

const ACTIVITY_BY_SESSION_TYPE: Record<string, HealthActivity> = {
  run: AppleHealthKit.Constants.Activities.Running,
  lift: AppleHealthKit.Constants.Activities.TraditionalStrengthTraining,
  cross: AppleHealthKit.Constants.Activities.FunctionalStrengthTraining,
};

/**
 * Writes a completed OSPREY workout back to Apple Health.
 */
export async function writeWorkoutToHealthKit(params: {
  sessionType: string;
  startedAt: string;
  endedAt: string;
  calories?: number | null;
  distanceMeters?: number | null;
}): Promise<boolean> {
  if (!isHealthKitSupported() || !initialized) return false;

  const activityType = ACTIVITY_BY_SESSION_TYPE[params.sessionType];
  if (!activityType) return false;

  return new Promise((resolve) => {
    AppleHealthKit.saveWorkout(
      {
        type: activityType,
        startDate: params.startedAt,
        endDate: params.endedAt,
        metadata: {
          distanceMeters: params.distanceMeters ?? undefined,
          calories: params.calories ?? undefined,
        },
      },
      (err) => resolve(!err),
    );
  });
}
