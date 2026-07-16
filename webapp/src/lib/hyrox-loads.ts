// Ported from OSPREY-app/src/services/calculators/hyrox.ts + coaching/hyrox.ts (compromised-split wrapper).
// Keep in sync; parity: tests/hyrox-loads.test.ts.

export interface Range {
  min: number;
  max: number;
}

export type HyroxDivision = 'open_men' | 'open_women' | 'pro_men' | 'pro_women';

export const HYROX_DIVISIONS: readonly HyroxDivision[] = [
  'open_men',
  'open_women',
  'pro_men',
  'pro_women',
];

export const MILES_PER_KM = 0.621371;

export interface HyroxStationWeights {
  sledPushKg: number;
  sledPullKg: number;
  farmersCarryPerHandKg: number;
  sandbagLungesKg: number;
  wallBallKg: number;
}

const HYROX_STATION_WEIGHTS: Record<HyroxDivision, HyroxStationWeights> = {
  open_men: {
    sledPushKg: 152,
    sledPullKg: 103,
    farmersCarryPerHandKg: 24,
    sandbagLungesKg: 20,
    wallBallKg: 6,
  },
  open_women: {
    sledPushKg: 102,
    sledPullKg: 78,
    farmersCarryPerHandKg: 16,
    sandbagLungesKg: 10,
    wallBallKg: 4,
  },
  pro_men: {
    sledPushKg: 202,
    sledPullKg: 153,
    farmersCarryPerHandKg: 32,
    sandbagLungesKg: 30,
    wallBallKg: 9,
  },
  pro_women: {
    sledPushKg: 152,
    sledPullKg: 103,
    farmersCarryPerHandKg: 24,
    sandbagLungesKg: 20,
    wallBallKg: 6,
  },
};

export function hyroxStationWeights(division: HyroxDivision): HyroxStationWeights {
  return HYROX_STATION_WEIGHTS[division];
}

export function predictCompromisedRunSplit(thresholdSecPerKm: number): Range {
  return { min: thresholdSecPerKm + 15, max: thresholdSecPerKm + 30 };
}

export function compromisedSplitFromThresholdMile(
  thresholdSecPerMile: number,
): Range {
  return predictCompromisedRunSplit(
    Math.round(thresholdSecPerMile * MILES_PER_KM),
  );
}
