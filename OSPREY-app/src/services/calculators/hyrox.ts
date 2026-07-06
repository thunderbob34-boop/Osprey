import { Range } from './types';

/** Running zones as offsets (sec/km) from threshold pace (docs/coaching/hyrox.md §2). */
export interface HyroxRunZones {
  thresholdSecPerKm: number;
  z1EasyRecovery: Range;
  z2AerobicBase: Range;
  z3ThresholdRace: Range;
  z4Vo2Max: Range;
}

export function hyroxRunZones(thresholdSecPerKm: number): HyroxRunZones {
  const t = thresholdSecPerKm;
  return {
    thresholdSecPerKm: t,
    z1EasyRecovery: { min: t + 45, max: t + 75 },
    z2AerobicBase: { min: t + 25, max: t + 45 },
    z3ThresholdRace: { min: t - 10, max: t + 10 },
    z4Vo2Max: { min: t - 25, max: t - 10 },
  };
}

/** Compromised-split predictor: race-pace running under station fatigue runs ~15-30s/km slower than threshold. */
export function predictCompromisedRunSplit(thresholdSecPerKm: number): Range {
  return { min: thresholdSecPerKm + 15, max: thresholdSecPerKm + 30 };
}

export type HyroxDivision = 'open_men' | 'open_women' | 'pro_men' | 'pro_women';

export interface HyroxStationWeights {
  sledPushKg: number;
  sledPullKg: number;
  farmersCarryPerHandKg: number;
  sandbagLungesKg: number;
  wallBallKg: number;
}

const HYROX_STATION_WEIGHTS: Record<HyroxDivision, HyroxStationWeights> = {
  open_men: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
  open_women: { sledPushKg: 102, sledPullKg: 78, farmersCarryPerHandKg: 16, sandbagLungesKg: 10, wallBallKg: 4 },
  pro_men: { sledPushKg: 202, sledPullKg: 153, farmersCarryPerHandKg: 32, sandbagLungesKg: 30, wallBallKg: 9 },
  pro_women: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
};

export function hyroxStationWeights(division: HyroxDivision): HyroxStationWeights {
  return HYROX_STATION_WEIGHTS[division];
}

export function hyroxDailyNutrition(bodyWeightKg: number) {
  return {
    carbG: { min: 5 * bodyWeightKg, max: 8 * bodyWeightKg },
    proteinG: { min: 1.6 * bodyWeightKg, max: 2.2 * bodyWeightKg },
  };
}

export function hyroxInRaceCarbGPerHour(raceDurationMinutes: number): Range {
  return raceDurationMinutes > 75 ? { min: 30, max: 60 } : { min: 0, max: 0 };
}

export function hyroxSodiumMgPerHour(): Range {
  return { min: 500, max: 1000 };
}

export function hyroxCaffeineMg(bodyWeightKg: number): Range {
  return { min: 3 * bodyWeightKg, max: 6 * bodyWeightKg };
}
