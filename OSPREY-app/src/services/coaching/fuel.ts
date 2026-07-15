import { runningRaceFuelGPerHour } from '@/services/calculators/running';
import { cyclingInRideCarbGPerHour } from '@/services/calculators/cycling';
import { swimMeetDayCarbGPerHour } from '@/services/calculators/swimming';
import { dailyCarbGrams, EnduranceDayType } from '@/services/calculators/shared';
import { midpoint, Range } from '@/services/calculators/types';

export interface FuelPlan {
  dailyCarbGByDayType: Record<EnduranceDayType, Range>; // easy / moderate / high / peak
  proteinG: Range;
  longSessionCarbGPerHour: number; // per-sport in-session rate (name kept for the stored session-fuel shape)
}

// Per-sport in-session carb rate (g/hr), midpoint of the sport's in-ride/race table.
function inSessionCarbGPerHour(sport: string): number {
  if (sport === 'cycling') return Math.round(midpoint(cyclingInRideCarbGPerHour('long_or_hard')) ?? 60);
  if (sport === 'swim') return Math.round(midpoint(swimMeetDayCarbGPerHour(true)) ?? 60);
  return Math.round(midpoint(runningRaceFuelGPerHour('marathon')) ?? 60); // run/hybrid/hyrox/rowing/triathlon/default
}

export function computeFuel(sport: string, bodyWeightKg: number): FuelPlan {
  const carb = (dt: EnduranceDayType) => dailyCarbGrams(dt, bodyWeightKg);
  return {
    dailyCarbGByDayType: { easy: carb('easy'), moderate: carb('moderate'), high: carb('high'), peak: carb('peak') },
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.2) },
    longSessionCarbGPerHour: inSessionCarbGPerHour(sport),
  };
}
