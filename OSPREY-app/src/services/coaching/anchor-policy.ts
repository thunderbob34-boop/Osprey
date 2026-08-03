import type { AnchorConfidence } from './baseline';

/**
 * Confidence policy for a derived (HealthKit) threshold anchor.
 *
 * Threshold (docs/coaching/running.md §2) is a ~60-minute construct — the pace
 * an athlete could hold for about an hour. Projecting it from a logged effort is
 * an extrapolation, and the extrapolation distance matters: a 6-mile tempo run
 * (~40+ min) is close to the construct itself; a 1.5-mile effort (~13 min at a
 * 9:00/mi pace) is a 4-5x extrapolation with real error. Both can clear
 * performance-anchor.ts's sufficiency gate (>=3 efforts, best >=1.5mi) and they
 * are not the same quality of number — this module is what tells them apart.
 *
 * That extrapolation compounds with a second, one-directional bias: a training
 * run projects SLOWER than a race effort at the same fitness (no taper, no
 * competitive arousal, often not truly maximal). So a short, low-confidence
 * derived anchor isn't just uncertain — it's uncertain in a fitness-slow
 * direction, which is exactly the wrong error to prescribe aggressive work off.
 */

// Standard cadence for a PASSIVE re-derivation from logged training (the doc's WS1
// acceptance: "every 3 weeks, recompute the performance anchor"). This is a
// different act from the PRESCRIBED threshold re-test workout every 4-6 weeks
// (docs/coaching/running.md:22, docs/coaching/_index.md:18) — both are kept, and
// onboarding copy says so, so the athlete isn't told two conflicting numbers.
const STANDARD_REANCHOR_INTERVAL_DAYS = 21;

export interface AnchorPolicy {
  confidence: AnchorConfidence;
  /** Days until a re-derive is due. Shorter than standard when confidence is low. */
  reanchorIntervalDays: number;
  /** How much to widen a displayed race-time range around the anchor's projection. */
  raceRangePct: number;
  /** True when the anchor should be treated as not-yet-trustworthy — surfaced in copy. */
  provisional: boolean;
  /**
   * Multiplies computeEnvelope's hardSessionShareMax (docs/coaching/_index.md's ~20%
   * hard-work polarization cap) for weeks 1-3 of a plan built on a provisional
   * anchor. 1 = no change. Never applied past week 3 — see envelope.ts.
   */
  hardShareMultiplier: number;
}

const POLICY: Record<AnchorConfidence, AnchorPolicy> = {
  high: {
    confidence: 'high',
    reanchorIntervalDays: STANDARD_REANCHOR_INTERVAL_DAYS,
    raceRangePct: 0.03,
    provisional: false,
    hardShareMultiplier: 1,
  },
  moderate: {
    confidence: 'moderate',
    reanchorIntervalDays: STANDARD_REANCHOR_INTERVAL_DAYS,
    raceRangePct: 0.06,
    provisional: false,
    hardShareMultiplier: 1,
  },
  low: {
    confidence: 'low',
    reanchorIntervalDays: 10,
    raceRangePct: 0.12,
    provisional: true,
    // Halves the hard-work cap (0.2 -> 0.1) for weeks 1-3 rather than prescribing
    // aggressive threshold work off a 4x+ extrapolation that's also biased slow.
    hardShareMultiplier: 0.5,
  },
};

export function anchorPolicy(confidence: AnchorConfidence): AnchorPolicy {
  return POLICY[confidence];
}

/**
 * Confidence tier from the source effort's duration (seconds) and how many
 * qualifying efforts backed the derivation. Duration is compared against the
 * ~60-min threshold construct: >=40min is a tight extrapolation, >=20min is
 * moderate, anything shorter (or fewer than 3 corroborating efforts) is low.
 */
export function confidenceFromEffort(effortDurationS: number, qualifyingEffortCount: number): AnchorConfidence {
  if (effortDurationS >= 40 * 60 && qualifyingEffortCount >= 5) return 'high';
  if (effortDurationS >= 20 * 60 && qualifyingEffortCount >= 3) return 'moderate';
  return 'low';
}

/** Widens a point race-time prediction into a display range using the policy's raceRangePct. */
export function widenRaceRange(predictedS: number, confidence: AnchorConfidence): { lowS: number; highS: number } {
  const pct = anchorPolicy(confidence).raceRangePct;
  return { lowS: Math.round(predictedS * (1 - pct)), highS: Math.round(predictedS * (1 + pct)) };
}
