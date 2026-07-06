import { Range } from './types';

/**
 * The 4-tier daily-carb-by-day-type structure shared verbatim across
 * ultra, cycling, swimming, rowing and triathlon (docs/coaching/*.md §6).
 * Running has its own top tier (race-week carb-load) so it isn't included here.
 */
export type EnduranceDayType = 'easy' | 'moderate' | 'high' | 'peak';

export const ENDURANCE_DAILY_CARB_G_PER_KG: Record<EnduranceDayType, Range> = {
  easy: { min: 3, max: 5 },
  moderate: { min: 5, max: 7 },
  high: { min: 8, max: 10 },
  peak: { min: 10, max: 12 },
};

export function dailyCarbGrams(dayType: EnduranceDayType, bodyWeightKg: number): Range {
  const perKg = ENDURANCE_DAILY_CARB_G_PER_KG[dayType];
  return {
    min: perKg.min != null ? perKg.min * bodyWeightKg : null,
    max: perKg.max != null ? perKg.max * bodyWeightKg : null,
  };
}

export function sodiumMgPerHourFromSweatRate(sweatRateLPerHour: number, mgPerLiter = 800): number {
  return sweatRateLPerHour * mgPerLiter;
}

export function maxWeeklyProgression(currentWeekLoad: number, capFraction = 0.1): number {
  return currentWeekLoad * (1 + capFraction);
}

export function applyVolumeCut(baseline: number, cutFraction: number): number {
  return baseline * (1 - cutFraction);
}

export function percentOfMaxHR(maxHR: number, minPct: number, maxPct: number | null): Range {
  return {
    min: Math.round(maxHR * (minPct / 100)),
    max: maxPct != null ? Math.round(maxHR * (maxPct / 100)) : null,
  };
}
