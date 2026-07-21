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

export type HyroxDivision =
  | 'open_men'
  | 'open_women'
  | 'pro_men'
  | 'pro_women'
  // Doubles: two athletes share ONE race's station workload, but BOTH run every
  // 1km leg together — the running is not split, so a doubles athlete still
  // covers the full 8km. Station reps are divided freely between partners with
  // unlimited swaps (only one works at a time). Loads are the Open loads;
  // mixed pairs (one man, one woman) race at the women's Open loads.
  // Deliberately no `pro_doubles_*` yet — not because of the Pro-weight dispute
  // (resolved 2026-07-20 against hyrox.com's official rules, see the note on
  // HYROX_STATION_WEIGHTS below), but because Pro Doubles' own format rules
  // (loads, swap conventions) haven't been researched yet — a separate gap.
  | 'doubles_men'
  | 'doubles_women'
  | 'doubles_mixed';

export interface HyroxStationWeights {
  sledPushKg: number;
  sledPullKg: number;
  farmersCarryPerHandKg: number;
  sandbagLungesKg: number;
  wallBallKg: number;
}

// Loads per division (docs/coaching/hyrox.md §2).
//
// ✅ RESOLVED 2026-07-20 — the Pro sled figures below were disputed against a
// secondary source (hyroxfitness.com: pro_men 175/125, pro_women 125/100) but
// are CONFIRMED CORRECT against hyrox.com's own official "Weights, Distances
// and Repetitions" table (live-checked division-by-division): Women 102/78,
// Women Pro 152/103, Men 152/103, Men Pro 202/153 — an exact match to every
// figure below, both stations, all four divisions. hyroxfitness.com's figures
// were the incorrect ones. See ~/.claude/skills/hyrox-trainer-experience/
// benchmark/audit-checklist.md row 14 for the full verification record.
const HYROX_STATION_WEIGHTS: Record<HyroxDivision, HyroxStationWeights> = {
  open_men: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
  open_women: { sledPushKg: 102, sledPullKg: 78, farmersCarryPerHandKg: 16, sandbagLungesKg: 10, wallBallKg: 4 },
  pro_men: { sledPushKg: 202, sledPullKg: 153, farmersCarryPerHandKg: 32, sandbagLungesKg: 30, wallBallKg: 9 },
  pro_women: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
  // Doubles races at Open loads; a mixed pair races the women's Open loads.
  doubles_men: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
  doubles_women: { sledPushKg: 102, sledPullKg: 78, farmersCarryPerHandKg: 16, sandbagLungesKg: 10, wallBallKg: 4 },
  doubles_mixed: { sledPushKg: 102, sledPullKg: 78, farmersCarryPerHandKg: 16, sandbagLungesKg: 10, wallBallKg: 4 },
};

/** True when a division shares one race's station workload across two athletes. */
export function isDoublesDivision(division: HyroxDivision): boolean {
  return division === 'doubles_men' || division === 'doubles_women' || division === 'doubles_mixed';
}

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
