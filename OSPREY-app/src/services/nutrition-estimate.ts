// Estimates a training-day's macro targets for days OTHER than today, by
// back-solving today's already-computed (server, weight-trend-adjusted)
// target down to its goal+trend baseline, then re-applying a different
// day's session-calorie bump. Mirrors computeTarget() in
// supabase/functions/ozzie-nutrition-coach/index.ts — keep these two in sync
// if that function's constants change.

export type SessionTypeForEstimate = 'run' | 'swim' | 'bike' | 'lift' | 'cross' | 'race' | 'rest' | string;

/** cal/min by session type — ported 1:1 from ozzie-nutrition-coach/index.ts SESSION_CAL_PER_MIN. */
export const SESSION_CAL_PER_MIN: Record<string, number> = {
  run: 7,
  swim: 8,
  bike: 6,
  lift: 4,
  cross: 5,
  race: 9,
  rest: 0,
};

const FALLBACK_CAL_PER_MIN = 5; // matches the `?? 5` fallback in computeTarget()
const CALORIE_FLOOR = 1600;
const FAT_PCT_OF_CALORIES = 0.26;

export function sessionCalorieBump(
  sessionType: SessionTypeForEstimate | null,
  plannedMinutes: number | null,
): number {
  if (!sessionType || sessionType === 'rest') return 0;
  const minutes = plannedMinutes ?? 45; // matches computeTarget()'s `?? 45` default
  const ratePerMin = SESSION_CAL_PER_MIN[sessionType] ?? FALLBACK_CAL_PER_MIN;
  return Math.round(minutes * ratePerMin);
}

export interface DayMacroEstimate {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** True when the target day's session matches today's exactly — that number isn't actually an estimate. */
  isExact: boolean;
}

/**
 * Estimates macros for a target day given TODAY's real, GPT/server-computed
 * target and today's own session. Back-solves the goal+weight-trend baseline
 * from today's numbers, then re-applies a different day's activity bump.
 * proteinG is carried over unchanged (goal-based, not session-based).
 */
export function estimateDayMacros(
  todayTarget: { calories: number; proteinG: number },
  todaySessionType: SessionTypeForEstimate | null,
  todayPlannedMinutes: number | null,
  targetDaySessionType: SessionTypeForEstimate | null,
  targetDayPlannedMinutes: number | null,
): DayMacroEstimate {
  const todayBump = sessionCalorieBump(todaySessionType, todayPlannedMinutes);
  const impliedBaselinePlusTrend = todayTarget.calories - todayBump;

  const targetBump = sessionCalorieBump(targetDaySessionType, targetDayPlannedMinutes);
  const calories = Math.max(CALORIE_FLOOR, impliedBaselinePlusTrend + targetBump);

  const proteinG = todayTarget.proteinG;
  const proteinCals = proteinG * 4;
  const fatG = Math.round((calories * FAT_PCT_OF_CALORIES) / 9);
  const remainingCals = Math.max(0, calories - proteinCals - fatG * 9);
  const carbsG = Math.round(remainingCals / 4);

  const isExact = todaySessionType === targetDaySessionType && todayPlannedMinutes === targetDayPlannedMinutes;

  return { calories: Math.round(calories), proteinG, carbsG, fatG, isExact };
}
