import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import type {
  HealthActivity,
  HealthInputOptions,
  HealthKitPermissions,
  HealthValue,
  HKWorkoutQueriedSampleType,
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
      AppleHealthKit.Constants.Permissions.Workout,
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
    fetchSamples(AppleHealthKit.getHeartRateVariabilitySamples, {
      startDate: since,
      unit: AppleHealthKit.Constants.Units.count,
    }),
    fetchSamples(AppleHealthKit.getRestingHeartRateSamples, { startDate: since }),
    fetchSamples(AppleHealthKit.getSleepSamples, { startDate: since }),
  ]);

  if (hrvSamples.length === 0 && restingHrSamples.length === 0 && sleepSamples.length === 0) {
    return false; // nothing new to sync
  }

  const hrvMs = hrvSamples.length > 0 ? hrvSamples[hrvSamples.length - 1].value : null;
  const restingHr = restingHrSamples.length > 0 ? restingHrSamples[restingHrSamples.length - 1].value : null;

  const sleepHours =
    sleepSamples.length > 0
      ? sleepSamples.reduce((sum, s) => {
          const start = new Date(s.startDate).getTime();
          const end = new Date(s.endDate).getTime();
          return sum + (end - start) / 3600000;
        }, 0)
      : null;

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

// Must match ios.bundleIdentifier in app.json — HealthKit stamps this as the
// HKSource bundle id on anything OSPREY itself wrote via saveWorkout above,
// so import can skip those and avoid re-importing our own workouts.
const OWN_BUNDLE_ID = 'com.SillyGoose.OSPREY';

export interface HealthKitWorkout {
  externalId: string;
  activityName: string;
  startedAt: string;
  endedAt: string;
  durationS: number;
  distanceMeters: number | null;
  calories: number | null;
}

/**
 * Reads workouts recorded by any source (Apple Watch, Garmin via its
 * HealthKit bridge, etc.) in the given window, excluding ones OSPREY itself
 * wrote — those are already in workout_logs from the in-app flow.
 */
export async function fetchHealthKitWorkouts(sinceISO: string): Promise<HealthKitWorkout[]> {
  if (!isHealthKitSupported() || !initialized) return [];

  return new Promise((resolve) => {
    AppleHealthKit.getAnchoredWorkouts({ startDate: sinceISO }, (err, res) => {
      if (err || !res?.data) {
        resolve([]);
        return;
      }
      const workouts = (res.data as HKWorkoutQueriedSampleType[])
        .filter((w) => w.sourceId !== OWN_BUNDLE_ID)
        .map((w) => ({
          externalId: w.id,
          activityName: w.activityName,
          startedAt: w.start,
          endedAt: w.end,
          durationS: Math.round(w.duration),
          distanceMeters: w.distance > 0 ? w.distance : null,
          calories: w.calories > 0 ? Math.round(w.calories) : null,
        }));
      resolve(workouts);
    });
  });
}
