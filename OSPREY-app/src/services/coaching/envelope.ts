import { runningPaceZones, RunningPaceZones } from '@/services/calculators/running';
import { Phase, loadingWeek, targetWeeklyLoad } from './periodization';
import { resolveRunningAnchor } from './anchor';
import { computeRunningFuel, FuelTargets } from './fuel';

export interface CoachingEnvelope {
  sport: string;
  phase: Phase;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number; // polarization cap (docs/coaching/_index.md:16)
  runZones: RunningPaceZones | null;
  fuel: FuelTargets;
}

export interface EnvelopeInput {
  sport: string;
  phase: Phase;
  weekNumber: number;
  totalWeeks: number;
  baselineLoad: number;
  prevWeekLoad: number | null;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  fitnessLevel: string;
  bodyWeightKg: number;
}

export function computeEnvelope(input: EnvelopeInput): CoachingEnvelope {
  const load = targetWeeklyLoad({
    baselineLoad: input.baselineLoad,
    phase: input.phase,
    weekNumber: input.weekNumber,
    prevWeekLoad: input.prevWeekLoad,
  });

  const isRun = input.sport === 'run' || input.sport === 'hybrid';
  const runZones = isRun
    ? runningPaceZones(
        resolveRunningAnchor({
          bestRunMiles: input.bestRunMiles,
          bestRunTimeS: input.bestRunTimeS,
          fitnessLevel: input.fitnessLevel,
        }).thresholdSecPerMile,
      )
    : null;

  const hardWeek = loadingWeek(input.weekNumber) !== 4 && input.phase !== 'Taper';

  return {
    sport: input.sport,
    phase: input.phase,
    weekNumber: input.weekNumber,
    totalWeeks: input.totalWeeks,
    targetWeeklyLoad: load,
    hardSessionShareMax: 0.2,
    runZones,
    fuel: computeRunningFuel({ bodyWeightKg: input.bodyWeightKg, hardWeek }),
  };
}
