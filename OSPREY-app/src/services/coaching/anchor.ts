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

export function resolveRunningAnchor(input: {
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  fitnessLevel: string;
}): RunningAnchor {
  const { bestRunMiles, bestRunTimeS, fitnessLevel } = input;

  if (bestRunMiles != null && bestRunTimeS != null && bestRunMiles >= 1 && bestRunTimeS > 0) {
    // Find the distance this athlete would cover in ~1 hour at Riegel-scaled effort,
    // then threshold pace = that 1-hour pace.
    let miles = bestRunMiles;
    for (let i = 0; i < 40; i++) {
      const t = riegelPredict(bestRunMiles, bestRunTimeS, miles);
      if (Math.abs(t - ONE_HOUR_S) < 5) break;
      miles *= ONE_HOUR_S / t;
    }
    return { thresholdSecPerMile: Math.round(ONE_HOUR_S / miles), source: 'derived' };
  }

  const estimate = TIER_ESTIMATE_SEC_PER_MILE[fitnessLevel] ?? TIER_ESTIMATE_SEC_PER_MILE.beginner;
  return { thresholdSecPerMile: estimate, source: 'estimate' };
}
