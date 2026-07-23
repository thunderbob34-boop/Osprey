// Ported from OSPREY-app/src/services/coaching/fuel.ts. The ultra branch
// (ultraRaceCarbGPerHour, and the gutTrained parameter that only it reads) is
// omitted — `sport` can never be 'ultra' from a webapp-originated call (no
// webapp UI lets an athlete select it). running/cycling/swimming's single
// in-session fuel-rate function each is inlined below rather than split into
// a webapp calculators/ subdirectory that doesn't otherwise exist — this file
// is their only consumer. Keep in sync; parity: tests/fuel-parity.test.ts.
import { midpoint, type Range } from './training-zones';
import { powerliftingDailyNutrition } from './strength-loads';
import { hyroxDailyNutrition, hyroxInRaceCarbGPerHour } from './hyrox-loads';
import { crossfitDailyNutrition } from './crossfit-zones';

export type EnduranceDayType = 'easy' | 'moderate' | 'high' | 'peak';

const ENDURANCE_DAILY_CARB_G_PER_KG: Record<EnduranceDayType, Range> = {
  easy: { min: 3, max: 5 },
  moderate: { min: 5, max: 7 },
  high: { min: 8, max: 10 },
  peak: { min: 10, max: 12 },
};

function dailyCarbGrams(dayType: EnduranceDayType, bodyWeightKg: number): Range {
  const perKg = ENDURANCE_DAILY_CARB_G_PER_KG[dayType];
  return {
    min: perKg.min != null ? perKg.min * bodyWeightKg : null,
    max: perKg.max != null ? perKg.max * bodyWeightKg : null,
  };
}

function runningRaceFuelGPerHour(distance: 'marathon' | 'half' | '10k' | '5k', estimatedDurationMinutes?: number): Range {
  switch (distance) {
    case 'marathon':
      return { min: 60, max: 90 };
    case 'half':
      return estimatedDurationMinutes != null && estimatedDurationMinutes >= 90 ? { min: 30, max: 60 } : { min: 0, max: 0 };
    case '10k':
    case '5k':
      return { min: 0, max: 0 };
  }
}

function cyclingInRideCarbGPerHour(duration: 'short_steady' | 'long_or_hard' | 'very_long_or_racing'): Range {
  switch (duration) {
    case 'short_steady':
      return { min: 30, max: 60 };
    case 'long_or_hard':
      return { min: 60, max: 90 };
    case 'very_long_or_racing':
      return { min: 90, max: 120 };
  }
}

function swimMeetDayCarbGPerHour(longDemandingSession: boolean): Range {
  return { min: 25, max: longDemandingSession ? 90 : 60 };
}

export interface FuelPlan {
  dailyCarbGByDayType: Record<EnduranceDayType, Range>;
  proteinG: Range;
  longSessionCarbGPerHour: number;
}

// Per-sport in-session carb rate (g/hr), midpoint of the sport's in-ride/race table.
function inSessionCarbGPerHour(sport: string): number {
  if (sport === 'cycling') return Math.round(midpoint(cyclingInRideCarbGPerHour('long_or_hard')) ?? 60);
  if (sport === 'swim') return Math.round(midpoint(swimMeetDayCarbGPerHour(true)) ?? 60);
  return Math.round(midpoint(runningRaceFuelGPerHour('marathon')) ?? 60); // run/hybrid/rowing/triathlon/default
}

export function computeFuel(sport: string, bodyWeightKg: number): FuelPlan {
  if (sport === 'lift') {
    const n = powerliftingDailyNutrition(bodyWeightKg);
    const mid = Math.round((n.carbG.min + n.carbG.max) / 2);
    const low: Range = { min: Math.round(n.carbG.min), max: mid };
    const high: Range = { min: mid, max: Math.round(n.carbG.max) };
    return {
      dailyCarbGByDayType: { easy: low, moderate: low, high, peak: high },
      proteinG: { min: Math.round(n.proteinG.min), max: Math.round(n.proteinG.max) },
      longSessionCarbGPerHour: 0,
    };
  }
  if (sport === 'hyrox') {
    const n = hyroxDailyNutrition(bodyWeightKg);
    const mid = Math.round((n.carbG.min + n.carbG.max) / 2);
    const low: Range = { min: Math.round(n.carbG.min), max: mid };
    const high: Range = { min: mid, max: Math.round(n.carbG.max) };
    return {
      dailyCarbGByDayType: { easy: low, moderate: low, high, peak: high },
      proteinG: { min: Math.round(n.proteinG.min), max: Math.round(n.proteinG.max) },
      longSessionCarbGPerHour: Math.round(midpoint(hyroxInRaceCarbGPerHour(90)) ?? 45),
    };
  }
  if (sport === 'crossfit') {
    const n = crossfitDailyNutrition(bodyWeightKg);
    const mid = Math.round((n.carbG.min + n.carbG.max) / 2);
    const low: Range = { min: Math.round(n.carbG.min), max: mid };
    const high: Range = { min: mid, max: Math.round(n.carbG.max) };
    return {
      dailyCarbGByDayType: { easy: low, moderate: low, high, peak: high },
      proteinG: { min: Math.round(n.proteinG.min), max: Math.round(n.proteinG.max) },
      longSessionCarbGPerHour: 45,
    };
  }
  const carb = (dt: EnduranceDayType) => dailyCarbGrams(dt, bodyWeightKg);
  return {
    dailyCarbGByDayType: { easy: carb('easy'), moderate: carb('moderate'), high: carb('high'), peak: carb('peak') },
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.2) },
    longSessionCarbGPerHour: inSessionCarbGPerHour(sport),
  };
}
