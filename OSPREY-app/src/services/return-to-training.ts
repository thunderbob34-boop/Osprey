import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

export type GapReason = 'illness' | 'injury' | 'travel' | 'life';

export interface TrainingGap {
  gapDays: number;
  lastWorkoutAt: string; // ISO timestamp of the most recent workout
  priorWorkoutCount: number; // workouts in the 60 days before the gap began
}

const MIN_GAP_DAYS = 14;
const MIN_PRIOR_WORKOUTS = 3;

/**
 * Detects a meaningful break in training: at least MIN_GAP_DAYS since the
 * last workout, from a user who had a real habit before the break (at least
 * MIN_PRIOR_WORKOUTS in the 60 days leading up to it). Brand-new users with
 * no history are not "returning" — they get the normal plan flow instead.
 */
export async function detectTrainingGap(userId: string): Promise<TrainingGap | null> {
  const { data: latest, error } = await supabase
    .from('workout_logs')
    .select('started_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !latest) return null;

  const lastWorkoutAt = latest.started_at as string;
  const gapDays = Math.floor((Date.now() - new Date(lastWorkoutAt).getTime()) / 86400000);
  if (gapDays < MIN_GAP_DAYS) return null;

  const windowStart = new Date(new Date(lastWorkoutAt).getTime() - 60 * 86400000);
  const { count } = await supabase
    .from('workout_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('started_at', windowStart.toISOString())
    .lte('started_at', lastWorkoutAt);

  if ((count ?? 0) < MIN_PRIOR_WORKOUTS) return null;

  return { gapDays, lastWorkoutAt, priorWorkoutCount: count ?? 0 };
}

// ── Banner dismissal ──────────────────────────────────────────────────────────
// Keyed by the gap's last-workout timestamp so dismissing hides the banner for
// THIS break only — a future break surfaces it again.

function dismissKey(userId: string): string {
  return `osprey:ramp-dismissed:${userId}`;
}

export async function isRampBannerDismissed(userId: string, gap: TrainingGap): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(dismissKey(userId));
    return stored === gap.lastWorkoutAt;
  } catch {
    return false;
  }
}

export async function dismissRampBanner(userId: string, lastWorkoutAt: string): Promise<void> {
  try {
    await AsyncStorage.setItem(dismissKey(userId), lastWorkoutAt);
  } catch {
    // non-fatal — banner just reappears next launch
  }
}

// ── Ramp plan generation ──────────────────────────────────────────────────────

export interface RampPlanResult {
  sessions: unknown[];
}

/**
 * Asks ozzie-generate-plan to rebuild this week as week 1 of a
 * return-to-training ramp: reduced volume, easy intensity only. The edge
 * function computes the exact ramp percentage from the gap length.
 */
export async function generateRampPlan(params: {
  gapDays: number;
  reason: GapReason;
  painFlag: boolean;
}): Promise<RampPlanResult> {
  const { data, error } = await supabase.functions.invoke('ozzie-generate-plan', {
    body: {
      force: true,
      ramp: {
        gapDays: params.gapDays,
        reason: params.reason,
        painFlag: params.painFlag,
      },
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));

  return { sessions: (data?.sessions ?? []) as unknown[] };
}
