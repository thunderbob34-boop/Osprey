// Ported from OSPREY-app/src/services/coaching/anchor.ts. deriveThresholdSecPerMile
// is NOT re-ported — webapp/src/lib/baseline.ts already has it (used by the
// Training Baseline feature), imported here instead. Keep in sync;
// parity: tests/anchor-parity.test.ts.
import { deriveThresholdSecPerMile } from './baseline';

export interface RunningAnchor {
  thresholdSecPerMile: number;
  source: 'derived' | 'estimate';
}

// Coarse cold-start estimates (sec/mile) when there is no logged effort yet.
const TIER_ESTIMATE_SEC_PER_MILE: Record<string, number> = {
  advanced: 360, // 6:00/mi
  intermediate: 450, // 7:30/mi
  beginner: 570, // 9:30/mi
};

export interface RunEffort {
  distanceMiles: number;
  timeS: number;
}

/**
 * Choose the anchor effort by QUALITY, not distance — the longest logged run
 * is usually the slowest, biasing every zone slow. The best fitness signal
 * is the effort that projects to the fastest threshold.
 */
export function selectBestRunEffort(runs: RunEffort[]): RunEffort | null {
  const valid = runs.filter((r) => r.distanceMiles >= 1 && r.timeS > 0);
  if (valid.length === 0) return null;
  return valid.reduce((best, r) =>
    deriveThresholdSecPerMile(r.distanceMiles, r.timeS) <
    deriveThresholdSecPerMile(best.distanceMiles, best.timeS)
      ? r
      : best,
  );
}

export function resolveRunningAnchor(input: {
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  fitnessLevel: string;
}): RunningAnchor {
  const { bestRunMiles, bestRunTimeS, fitnessLevel } = input;

  if (bestRunMiles != null && bestRunTimeS != null && bestRunMiles >= 1 && bestRunTimeS > 0) {
    return { thresholdSecPerMile: deriveThresholdSecPerMile(bestRunMiles, bestRunTimeS), source: 'derived' };
  }

  const estimate = TIER_ESTIMATE_SEC_PER_MILE[fitnessLevel] ?? TIER_ESTIMATE_SEC_PER_MILE.beginner;
  return { thresholdSecPerMile: estimate, source: 'estimate' };
}

// Coarse cold-start CSS (sec/100m) by tier — until a real 400+200 TT input feeds the anchor.
const TIER_SWIM_CSS_SEC_PER_100: Record<string, number> = {
  advanced: 80,     // 1:20/100m
  intermediate: 100, // 1:40/100m
  beginner: 130,     // 2:10/100m
};

export function estimateSwimCssByTier(fitnessLevel: string): number {
  return TIER_SWIM_CSS_SEC_PER_100[fitnessLevel] ?? TIER_SWIM_CSS_SEC_PER_100.beginner;
}

// Coarse cold-start rowing splits (sec/500m) by tier — until a real 2k test is added.
const TIER_ROWING_SPLIT_SEC_PER_500: Record<string, number> = {
  advanced: 105,     // 1:45/500m
  intermediate: 120, // 2:00/500m
  beginner: 140,     // 2:20/500m
};

export function estimateRowingSplitByTier(fitnessLevel: string): number {
  return TIER_ROWING_SPLIT_SEC_PER_500[fitnessLevel] ?? TIER_ROWING_SPLIT_SEC_PER_500.beginner;
}

/** Best (fastest) 500m split from logged rowing efforts >= 1000m. */
export function selectBestRowingSplit(efforts: { distanceKm: number; timeS: number }[]): number | null {
  const splits = efforts
    .filter((e) => e.distanceKm >= 1 && e.timeS > 0)
    .map((e) => e.timeS / (e.distanceKm * 2)); // sec per 500m
  if (splits.length === 0) return null;
  return Math.round(Math.min(...splits));
}
