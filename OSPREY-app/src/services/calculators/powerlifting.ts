import { Range } from './types';

export interface PrilepinRange {
  repsPerSet: [number, number];
  totalReps: [number, number];
}

const PRILEPIN_TABLE: { percent1RM: number; range: PrilepinRange }[] = [
  { percent1RM: 70, range: { repsPerSet: [3, 6], totalReps: [12, 24] } },
  { percent1RM: 80, range: { repsPerSet: [2, 4], totalReps: [10, 20] } },
  { percent1RM: 90, range: { repsPerSet: [1, 2], totalReps: [4, 10] } },
];

/** Prilepin volume guardrail, nearest-anchor lookup (docs/coaching/powerlifting.md §2). */
export function prilepinRange(percent1RM: number): PrilepinRange {
  const nearest = PRILEPIN_TABLE.reduce((closest, entry) =>
    Math.abs(entry.percent1RM - percent1RM) < Math.abs(closest.percent1RM - percent1RM) ? entry : closest,
  );
  return nearest.range;
}

export interface IntensityZone {
  name: string;
  percent1RMRange: [number, number];
  repRange: [number, number];
  rpeRange: [number, number];
  rirRange: [number, number];
}

const INTENSITY_ZONES: IntensityZone[] = [
  { name: 'Speed / Dynamic', percent1RMRange: [40, 60], repRange: [1, 3], rpeRange: [0, 0], rirRange: [0, 0] },
  { name: 'Hypertrophy', percent1RMRange: [65, 75], repRange: [6, 12], rpeRange: [6, 8], rirRange: [2, 4] },
  { name: 'Strength-Volume', percent1RMRange: [75, 85], repRange: [3, 6], rpeRange: [7, 8], rirRange: [2, 3] },
  { name: 'Max Strength', percent1RMRange: [85, 92], repRange: [1, 3], rpeRange: [8, 9], rirRange: [1, 2] },
  { name: 'Peak / Test', percent1RMRange: [93, 100], repRange: [1, 1], rpeRange: [9, 10], rirRange: [0, 1] },
];

export function intensityZoneForPercent1RM(percent1RM: number): IntensityZone | null {
  return INTENSITY_ZONES.find(
    (z) => percent1RM >= z.percent1RMRange[0] && percent1RM <= z.percent1RMRange[1],
  ) ?? null;
}

export type PowerliftingLift = 'squat' | 'bench' | 'deadlift';

export interface AttemptPlan {
  opener: Range;
  second: Range;
  third: Range;
}

/** Opener ~89-91%, second ~95-96%, third ~100-102% of the goal third attempt (docs/coaching/powerlifting.md §7). */
export function attemptSelector(goalThirdKg: number): AttemptPlan {
  return {
    opener: { min: goalThirdKg * 0.89, max: goalThirdKg * 0.91 },
    second: { min: goalThirdKg * 0.95, max: goalThirdKg * 0.96 },
    third: { min: goalThirdKg * 1.0, max: goalThirdKg * 1.02 },
  };
}

export function attemptJumpRangePercent(lift: PowerliftingLift): Range {
  return lift === 'bench' ? { min: 3, max: 5 } : { min: 5, max: 7.5 };
}

export function powerliftingDailyNutrition(bodyWeightKg: number) {
  return {
    carbG: { min: 4 * bodyWeightKg, max: 7 * bodyWeightKg },
    proteinG: { min: 1.6 * bodyWeightKg, max: 2.2 * bodyWeightKg },
    fatG: { min: 0.8 * bodyWeightKg, max: 1.5 * bodyWeightKg },
  };
}
