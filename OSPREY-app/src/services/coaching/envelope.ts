import { runningPaceZones } from '@/services/calculators/running';
import { Phase, loadingWeek, targetWeeklyLoad } from './periodization';
import { resolveRunningAnchor } from './anchor';
import { computeRunningFuel, FuelTargets } from './fuel';
import { ZoneSet, blueprintSport } from './zones';

export interface CoachingEnvelope {
  sport: string;
  phase: Phase;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number; // polarization cap (docs/coaching/_index.md:16)
  zones: ZoneSet | null;
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

  let zones: ZoneSet | null = null;
  const bp = blueprintSport(input.sport);
  if (bp === 'run') {
    const t = resolveRunningAnchor({
      bestRunMiles: input.bestRunMiles,
      bestRunTimeS: input.bestRunTimeS,
      fitnessLevel: input.fitnessLevel,
    }).thresholdSecPerMile;
    zones = { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) };
  }
  // swim / rowing added in Tasks 2 & 3.

  const hardWeek = loadingWeek(input.weekNumber) !== 4 && input.phase !== 'Taper';

  return {
    sport: input.sport,
    phase: input.phase,
    weekNumber: input.weekNumber,
    totalWeeks: input.totalWeeks,
    targetWeeklyLoad: load,
    hardSessionShareMax: 0.2,
    zones,
    fuel: computeRunningFuel({ bodyWeightKg: input.bodyWeightKg, hardWeek }),
  };
}
