// INTENSITY_ZONES + intensityZoneForPercent1RM ported from OSPREY-app/src/services/calculators/powerlifting.ts.
// STRENGTH_PHASE_PERCENT copied by value from OSPREY-app/src/services/coaching/strength.ts:17 (private const;
// that file imports @/… so it can't be imported here). Keep in sync; parity: tests/strength-loads.test.ts.
import type { RacePhaseName } from './race-phase';

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
