// Ported from OSPREY-app/src/services/calculators/hyrox.ts + coaching/hyrox.ts (compromised-split wrapper).
// Keep in sync; parity: tests/hyrox-loads.test.ts.
import { resolveRunningAnchor } from './anchor';

export interface Range {
  min: number;
  max: number;
}

export type HyroxDivision =
  | 'open_men'
  | 'open_women'
  | 'pro_men'
  | 'pro_women'
  // Doubles: two athletes share ONE race's station workload, but BOTH run every
  // 1km leg together — running is not split, so a doubles athlete still covers
  // the full 8km. Open loads; a mixed pair races the women's Open loads.
  // No `pro_doubles_*` yet — not a weight dispute (resolved, see
  // HYROX_STATION_WEIGHTS below), but Pro Doubles' own format rules are
  // unresearched, a separate gap.
  | 'doubles_men'
  | 'doubles_women'
  | 'doubles_mixed';

export const HYROX_DIVISIONS: readonly HyroxDivision[] = [
  'open_men',
  'open_women',
  'pro_men',
  'pro_women',
  'doubles_men',
  'doubles_women',
  'doubles_mixed',
];

export const MILES_PER_KM = 0.621371;

export interface HyroxStationWeights {
  sledPushKg: number;
  sledPullKg: number;
  farmersCarryPerHandKg: number;
  sandbagLungesKg: number;
  wallBallKg: number;
}

// ✅ RESOLVED 2026-07-20 — the Pro sled figures below were disputed against a
// secondary source but are confirmed correct against hyrox.com's own official
// rules. See the full verification note in
// OSPREY-app/src/services/calculators/hyrox.ts (this file is a maintained
// port; tests/hyrox-loads.test.ts enforces parity, so do not diverge here).
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
  // Doubles races at Open loads; a mixed pair races the women's Open loads.
  doubles_men: {
    sledPushKg: 152,
    sledPullKg: 103,
    farmersCarryPerHandKg: 24,
    sandbagLungesKg: 20,
    wallBallKg: 6,
  },
  doubles_women: {
    sledPushKg: 102,
    sledPullKg: 78,
    farmersCarryPerHandKg: 16,
    sandbagLungesKg: 10,
    wallBallKg: 4,
  },
  doubles_mixed: {
    sledPushKg: 102,
    sledPullKg: 78,
    farmersCarryPerHandKg: 16,
    sandbagLungesKg: 10,
    wallBallKg: 4,
  },
};

/** True when a division shares one race's station workload across two athletes. */
export function isDoublesDivision(division: HyroxDivision): boolean {
  return division === 'doubles_men' || division === 'doubles_women' || division === 'doubles_mixed';
}

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

// Mirrors OSPREY-app/src/services/coaching/hyrox-params.ts's HyroxGoalParams
// shape but with a nullable `division` — webapp's own goal-params.ts
// parseHyroxParams always returns an object (division:null when unset)
// rather than mobile's toHyroxParams returning null outright.
// buildHyroxPrescription's `division` check below handles both shapes
// identically via optional chaining, so no adaptation is needed at the
// build-envelope.ts call boundary beyond passing the parsed object through.
export interface HyroxPrescriptionParams {
  division: HyroxDivision | null;
  targetTimeMinutes: number | null;
}

export interface HyroxPrescription {
  division: HyroxDivision;
  compromisedRunSplitSecPerKm: Range;
  stationWeights: HyroxStationWeights;
  sodiumMgPerHour: Range;
  caffeineMg: Range;
}

interface HyroxPrescriptionInput {
  sport: string;
  bodyWeightKg: number;
  hyroxParams?: HyroxPrescriptionParams | null;
  selfReportAnchor?: { thresholdSecPerMile: number | null } | null;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  fitnessLevel: string;
}

// Ported from OSPREY-app/src/services/coaching/hyrox.ts's buildHyroxPrescription.
export function buildHyroxPrescription(input: HyroxPrescriptionInput): HyroxPrescription | null {
  if (input.sport !== 'hyrox') return null;
  const division = input.hyroxParams?.division;
  if (!division) return null;
  const thresholdSecPerMile =
    input.selfReportAnchor?.thresholdSecPerMile ??
    resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).thresholdSecPerMile;
  const thresholdSecPerKm = Math.round(thresholdSecPerMile * MILES_PER_KM);
  return {
    division,
    compromisedRunSplitSecPerKm: predictCompromisedRunSplit(thresholdSecPerKm),
    stationWeights: hyroxStationWeights(division),
    sodiumMgPerHour: hyroxSodiumMgPerHour(),
    caffeineMg: hyroxCaffeineMg(input.bodyWeightKg),
  };
}
