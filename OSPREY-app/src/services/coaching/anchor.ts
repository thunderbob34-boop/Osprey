import { riegelPredict } from '@/services/performance';

export interface RunningAnchor {
  thresholdSecPerMile: number;
  source: 'derived' | 'estimate';
}

// Threshold (Daniels T) ≈ pace you could race for ~1 hour (docs/coaching/running.md).
const ONE_HOUR_S = 3600;

// Coarse cold-start estimates (sec/mile) when there is no logged effort yet.
const TIER_ESTIMATE_SEC_PER_MILE: Record<string, number> = {
  advanced: 360, // 6:00/mi
  intermediate: 450, // 7:30/mi
  beginner: 570, // 9:30/mi
};

/**
 * Threshold pace (sec/mile) implied by one logged effort: find the distance the
 * athlete would cover in ~1 hour at Riegel-scaled effort — that 1-hour pace ≈ T.
 */
export function deriveThresholdSecPerMile(distanceMiles: number, timeS: number): number {
  let miles = distanceMiles;
  for (let i = 0; i < 40; i++) {
    const t = riegelPredict(distanceMiles, timeS, miles);
    if (Math.abs(t - ONE_HOUR_S) < 5) break;
    miles *= ONE_HOUR_S / t;
  }
  return Math.round(ONE_HOUR_S / miles);
}

export interface RunEffort {
  distanceMiles: number;
  timeS: number;
}

/**
 * Choose the anchor effort by QUALITY, not distance. The old heuristic picked
 * the longest logged run — usually the slowest — biasing every zone slow. The
 * best fitness signal is the effort that projects to the fastest threshold.
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
