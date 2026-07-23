// INTENSITY_ZONES + intensityZoneForPercent1RM ported from OSPREY-app/src/services/calculators/powerlifting.ts.
// STRENGTH_PHASE_PERCENT copied by value from OSPREY-app/src/services/coaching/strength.ts:17 (private const;
// that file imports @/… so it can't be imported here). Keep in sync; parity: tests/strength-loads.test.ts.
import type { RacePhaseName } from './race-phase';
import type { Range } from './training-zones';

export interface IntensityZone {
  name: string;
  percent1RMRange: [number, number];
  repRange: [number, number];
  rpeRange: [number, number];
  rirRange: [number, number];
}

export const INTENSITY_ZONES: IntensityZone[] = [
  { name: 'Speed / Dynamic', percent1RMRange: [40, 60], repRange: [1, 3], rpeRange: [0, 0], rirRange: [0, 0] },
  { name: 'Hypertrophy', percent1RMRange: [65, 75], repRange: [6, 12], rpeRange: [6, 8], rirRange: [2, 4] },
  { name: 'Strength-Volume', percent1RMRange: [75, 85], repRange: [3, 6], rpeRange: [7, 8], rirRange: [2, 3] },
  { name: 'Max Strength', percent1RMRange: [85, 92], repRange: [1, 3], rpeRange: [8, 9], rirRange: [1, 2] },
  { name: 'Peak / Test', percent1RMRange: [93, 100], repRange: [1, 1], rpeRange: [9, 10], rirRange: [0, 1] },
];

export function intensityZoneForPercent1RM(percent1RM: number): IntensityZone | null {
  return INTENSITY_ZONES.find((z) => percent1RM >= z.percent1RMRange[0] && percent1RM <= z.percent1RMRange[1]) ?? null;
}

export const STRENGTH_PHASE_PERCENT: Record<RacePhaseName, number> = { Base: 80, Build: 88, Peak: 95, Taper: 90 };

export function strengthWorkingLoads(
  oneRepMaxKg: { squat: number | null; bench: number | null; deadlift: number | null },
  phase: RacePhaseName,
): { workingPercent1RM: number; zoneName: string; loads: { squat: number; bench: number; deadlift: number } } {
  const pct = STRENGTH_PHASE_PERCENT[phase];
  const load = (orm: number | null) => (orm && orm > 0 ? Math.round((orm * pct) / 100) : 0);
  return {
    workingPercent1RM: pct,
    zoneName: intensityZoneForPercent1RM(pct)?.name ?? 'Strength-Volume',
    loads: { squat: load(oneRepMaxKg.squat), bench: load(oneRepMaxKg.bench), deadlift: load(oneRepMaxKg.deadlift) },
  };
}

export type PowerliftingLift = 'squat' | 'bench' | 'deadlift';

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

export function powerliftingDailyNutrition(bodyWeightKg: number) {
  return {
    carbG: { min: 4 * bodyWeightKg, max: 7 * bodyWeightKg },
    proteinG: { min: 1.6 * bodyWeightKg, max: 2.2 * bodyWeightKg },
    fatG: { min: 0.8 * bodyWeightKg, max: 1.5 * bodyWeightKg },
  };
}

// Mirrors OSPREY-app/src/services/coaching/strength-params.ts's StrengthGoalParams
// shape exactly (including the optional goalThirdKg mobile's attempt-selector
// reads) — deliberately NOT webapp's own goal-params.ts LiftGoalParams, which
// omits goalThirdKg (webapp never collects it). build-envelope.ts (Task 10) maps
// its parsed LiftGoalParams into this shape at its own call boundary, leaving
// goalThirdKg unset — buildStrengthPrescription's own fallback chain below
// already handles that correctly.
export interface StrengthGoalParams {
  oneRepMaxKg: { squat: number | null; bench: number | null; deadlift: number | null };
  goalThirdKg?: { squat: number | null; bench: number | null; deadlift: number | null };
}

export interface StrengthPrescription {
  oneRepMaxKg: { squat: number; bench: number; deadlift: number };
  workingPercent1RM: number;
  zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
  prilepin: { repsPerSet: [number, number]; totalReps: [number, number] };
  fatG: Range;
  attempts: { squat: AttemptPlan; bench: AttemptPlan; deadlift: AttemptPlan } | null;
}

interface StrengthPrescriptionInput {
  sport: string;
  phase: RacePhaseName;
  bodyWeightKg: number;
  strengthParams?: StrengthGoalParams | null;
}

// Ported from OSPREY-app/src/services/coaching/strength.ts's buildStrengthPrescription.
export function buildStrengthPrescription(input: StrengthPrescriptionInput): StrengthPrescription | null {
  if (input.sport !== 'lift') return null;
  const p = input.strengthParams;
  const orm = { squat: p?.oneRepMaxKg.squat ?? 0, bench: p?.oneRepMaxKg.bench ?? 0, deadlift: p?.oneRepMaxKg.deadlift ?? 0 };
  // A paramless lifter has no 1RM to anchor %1RM loads. Return null so the
  // envelope carries no strength block rather than prescribing 0 kg comp lifts.
  if (orm.squat === 0 && orm.bench === 0 && orm.deadlift === 0) return null;
  const pct = STRENGTH_PHASE_PERCENT[input.phase];
  const z = intensityZoneForPercent1RM(pct)!;
  const pr = prilepinRange(pct);
  const fatG: Range = { min: Math.round(input.bodyWeightKg * 0.8), max: Math.round(input.bodyWeightKg * 1.5) };
  const goalThird = (lift: PowerliftingLift) => p?.goalThirdKg?.[lift] ?? p?.oneRepMaxKg[lift] ?? 0;
  const attempts = (input.phase === 'Peak' || input.phase === 'Taper')
    ? { squat: attemptSelector(goalThird('squat')), bench: attemptSelector(goalThird('bench')), deadlift: attemptSelector(goalThird('deadlift')) }
    : null;
  return {
    oneRepMaxKg: orm, workingPercent1RM: pct,
    zone: { name: z.name, percent1RM: z.percent1RMRange, reps: z.repRange, rpe: z.rpeRange, rir: z.rirRange },
    prilepin: { repsPerSet: pr.repsPerSet, totalReps: pr.totalReps },
    fatG, attempts,
  };
}
