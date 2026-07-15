import { runningDailyCarbGrams, runningRaceFuelGPerHour } from '@/services/calculators/running';
import { midpoint, Range } from '@/services/calculators/types';

export interface FuelTargets {
  dailyCarbG: Range;
  proteinG: Range;
  longSessionCarbGPerHour: number;
}

export function computeRunningFuel(input: { bodyWeightKg: number; hardWeek: boolean }): FuelTargets {
  const { bodyWeightKg, hardWeek } = input;
  const carbRange = runningRaceFuelGPerHour('marathon'); // 60–90 g/hr for long efforts
  return {
    dailyCarbG: runningDailyCarbGrams(hardWeek ? 'high' : 'moderate', bodyWeightKg),
    // running.md §6: ~1.6–2.0 g/kg/day (narrower than the general _index 1.6–2.2 range).
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.0) },
    longSessionCarbGPerHour: Math.round(midpoint(carbRange) ?? 60),
  };
}
