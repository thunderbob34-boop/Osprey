import { intensityZoneForPercent1RM, prilepinRange, attemptSelector, AttemptPlan, PowerliftingLift } from '@/services/calculators/powerlifting';
import { Range } from '@/services/calculators/types';
import { Phase } from './periodization';
import type { EnvelopeInput } from './envelope';

export interface StrengthPrescription {
  oneRepMaxKg: { squat: number; bench: number; deadlift: number };
  workingPercent1RM: number;                          // % that × 1RM = the day's working load
  zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
  prilepin: { repsPerSet: [number, number]; totalReps: [number, number] };
  fatG: Range;                                        // daily fat target (powerlifting-specific; not in FuelPlan)
  attempts: { squat: AttemptPlan; bench: AttemptPlan; deadlift: AttemptPlan } | null; // Peak/Taper only
}

// Block periodization → one representative working %1RM per phase (docs/coaching/powerlifting.md §2).
// Each value lands inside an INTENSITY_ZONES band, so intensityZoneForPercent1RM never returns null.
const STRENGTH_PHASE_PERCENT: Record<Phase, number> = { Base: 80, Build: 88, Peak: 95, Taper: 90 };

export function buildStrengthPrescription(input: EnvelopeInput): StrengthPrescription | null {
  if (input.sport !== 'lift') return null;
  const p = input.strengthParams;
  const orm = { squat: p?.oneRepMaxKg.squat ?? 0, bench: p?.oneRepMaxKg.bench ?? 0, deadlift: p?.oneRepMaxKg.deadlift ?? 0 };
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
