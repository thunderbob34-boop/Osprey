import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import type {
  HealthActivity,
  HealthInputOptions,
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health';
import { supabase } from '@/services/supabase';

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

/**
 * HealthKit sleep samples overlap by design (an INBED range spans the ASLEEP
 * ranges within it, and stage-based sources can overlap each other too).
 * Summing durations naively roughly doubles the reported total, so we drop
 * INBED entries and merge overlapping ASLEEP intervals before summing.
 */
function computeSleepHours(samples: HealthValue[]): number {
  const intervals = samples
    .filter((s) => (s as unknown as { value?: string }).value !== 'INBED')
    .map((s) => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  let totalMs = 0;
  let curStart: number | null = null;
  let curEnd: number | null = null;
  for (const [start, end] of intervals) {
    if (curEnd == null || start > curEnd) {
      if (curStart != null && curEnd != null) totalMs += curEnd - curStart;
      curStart = start;
      curEnd = end;
    } else if (end > curEnd) {
      curEnd = end;
    }
  }
  if (curStart != null && curEnd != null) totalMs += curEnd - curStart;

  return totalMs / 3600000;
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

/**
 * Pulls last night's HRV, resting HR, and sleep duration from HealthKit and
 * writes a recovery_scores row for today using a simple v1 scoring formula.
 * Real algorithmic tuning is a future pass — this establishes the pipeline.
 */
export async function syncRecoveryFromHealthKit(userId: string): Promise<boolean> {
  if (!isHealthKitSupported() || !initialized) return false;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [hrvSamples, restingHrSamples, sleepSamples] = await Promise.all([
    // HRV SDNN samples are always returned in milliseconds — no unit param needed,
    // and `Units.count` was the wrong unit for a time quantity (either rejected by
    // the native call or silently mis-scaling every value).
    fetchSamples(AppleHealthKit.getHeartRateVariabilitySamples, {
      startDate: since,
    }),
    fetchSamples(AppleHealthKit.getRestingHeartRateSamples, { startDate: since }),
    fetchSamples(AppleHealthKit.getSleepSamples, { startDate: since }),
  ]);

  if (hrvSamples.length === 0 && restingHrSamples.length === 0 && sleepSamples.length === 0) {
    return false; // nothing new to sync
  }

  const hrvMs = hrvSamples.length > 0 ? hrvSamples[hrvSamples.length - 1].value : null;
  const restingHr = restingHrSamples.length > 0 ? restingHrSamples[restingHrSamples.length - 1].value : null;

  const sleepHours = sleepSamples.length > 0 ? computeSleepHours(sleepSamples) : null;

  // v1 scoring: simple weighted heuristic, not a clinical algorithm.
  let score = 70;
  if (hrvMs != null) score += hrvMs > 60 ? 10 : hrvMs < 30 ? -15 : 0;
  if (sleepHours != null) score += sleepHours >= 7 ? 10 : sleepHours < 5 ? -20 : -5;
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
