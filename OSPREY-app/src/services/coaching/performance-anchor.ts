import {
  isHealthKitSupported,
  requestHealthKitAuthorization,
  fetchHealthKitWorkouts,
  type HealthKitWorkout,
} from '@/services/healthkit';
import { selectBestRunEffort, type RunEffort } from './anchor';
import { parseRunBaseline, type AnchorConfidence } from './baseline';
import { confidenceFromEffort } from './anchor-policy';

/**
 * Derives a threshold anchor from the athlete's own HealthKit training history,
 * instead of asking them to type a race time (Runna's primary path — see
 * docs/design-references/RUNNA-app-teardown.md Gap 01).
 *
 * Run and row only. Swim CSS needs a 400m/200m time-trial pair and bike FTP
 * needs power data — neither is present in a HealthKit workout sample
 * (duration/distance/calories only), so those two stay self-report. Shipping
 * two honestly-derived anchors is better than four, two of which would be
 * fiction dressed as data.
 */
export type DerivableAnchorKey = 'run' | 'row';

export interface AnchorProposal {
  key: DerivableAnchorKey;
  /** thresholdSecPerMile for run, splitSecPer500 for row. */
  value: number;
  confidence: AnchorConfidence;
  qualifyingEffortCount: number;
  derivedFrom: {
    externalId: string;
    startedAt: string;
    distanceMiles?: number;
    distanceKm?: number;
    timeS: number;
  };
}

// 90 days gives the sufficiency gate room to find >=3 qualifying efforts without
// reaching back so far the fitness signal is stale (vs healthkit-import.ts's
// 14-day recent-workout-sync window — a different purpose, same source data).
export const ANCHOR_LOOKBACK_DAYS = 90;
const MIN_QUALIFYING_EFFORTS = 3;
const MIN_BEST_RUN_EFFORT_MILES = 1.5;
const MIN_BEST_ROW_EFFORT_KM = 1; // matches selectBestRowingSplit's own >=1km filter
const METERS_PER_MILE = 1609.344;

// Real-run activities only. healthkit-import.ts maps Walking and Hiking to the
// same 'run' session_type for LOAD ACCOUNTING purposes — correct there, wrong
// here: a walk's pace has no business anchoring a threshold pace. TrackAndField
// covers track workouts some watches label distinctly from plain Running.
const QUALIFYING_RUN_ACTIVITIES = new Set(['Running', 'TrackAndField']);
const QUALIFYING_ROW_ACTIVITIES = new Set(['Rowing']);

function qualifyingWorkouts(workouts: HealthKitWorkout[], activities: Set<string>): HealthKitWorkout[] {
  return workouts.filter((w) => activities.has(w.activityName) && w.distanceMeters != null && w.durationS > 0);
}

/**
 * Pure derivation from an already-fetched workout list — testable without
 * mocking HealthKit. Returns null anywhere along the fallback ladder: below
 * the sufficiency gate, or the derived value fails the plausibility band.
 */
export function deriveRunAnchorProposal(workouts: HealthKitWorkout[]): AnchorProposal | null {
  const qualifying = qualifyingWorkouts(workouts, QUALIFYING_RUN_ACTIVITIES);
  if (qualifying.length < MIN_QUALIFYING_EFFORTS) return null;

  // Extra `workout` field beyond RunEffort's shape is fine structurally — TS only
  // excess-property-checks object literals assigned directly, not arrays passed
  // through a variable — so this keeps provenance without a fragile re-match.
  const efforts: (RunEffort & { workout: HealthKitWorkout })[] = qualifying.map((w) => ({
    distanceMiles: (w.distanceMeters as number) / METERS_PER_MILE,
    timeS: w.durationS,
    workout: w,
  }));
  // Picks by projected-threshold QUALITY, not longest distance — a deliberate
  // prior fix (see anchor.ts's selectBestRunEffort doc); reused rather than
  // re-implementing "find the longest run", which is the bug it replaced.
  // selectBestRunEffort's reduce returns one of the input objects by reference
  // (never a copy), so the extra `workout` field survives the call untyped but intact.
  const best = selectBestRunEffort(efforts) as (RunEffort & { workout: HealthKitWorkout }) | null;
  if (!best || best.distanceMiles < MIN_BEST_RUN_EFFORT_MILES) return null;
  const sourceWorkout = best.workout;

  const parsed = parseRunBaseline(best.distanceMiles, best.timeS);
  if (!parsed.ok) return null;

  return {
    key: 'run',
    value: parsed.value,
    confidence: confidenceFromEffort(best.timeS, qualifying.length),
    qualifyingEffortCount: qualifying.length,
    derivedFrom: {
      externalId: sourceWorkout.externalId,
      startedAt: sourceWorkout.startedAt,
      distanceMiles: Math.round(best.distanceMiles * 100) / 100,
      timeS: best.timeS,
    },
  };
}

// Same 80-180 sec/500m plausibility band coaching/baseline.ts's parseRowingBaseline
// checks — that function's signature is 2k-time-specific (splits a single 2k
// effort), which doesn't fit an arbitrary logged rowing workout of any distance,
// so the band is duplicated here rather than reusing a function shaped for a
// different input.
const MIN_PLAUSIBLE_SPLIT_S = 80;
const MAX_PLAUSIBLE_SPLIT_S = 180;

export function deriveRowAnchorProposal(workouts: HealthKitWorkout[]): AnchorProposal | null {
  const qualifying = qualifyingWorkouts(workouts, QUALIFYING_ROW_ACTIVITIES);
  if (qualifying.length < MIN_QUALIFYING_EFFORTS) return null;

  const efforts = qualifying
    .map((w) => ({ workout: w, distanceKm: (w.distanceMeters as number) / 1000, timeS: w.durationS }))
    .filter((e) => e.distanceKm >= MIN_BEST_ROW_EFFORT_KM);
  if (efforts.length === 0) return null;

  // selectBestRowingSplit (anchor.ts) returns just the numeric best split, with
  // no reference back to which workout produced it — re-derive with the exact
  // same formula here so provenance (which workout, when) survives alongside it.
  const best = efforts.reduce((a, b) => (a.timeS / (a.distanceKm * 2) < b.timeS / (b.distanceKm * 2) ? a : b));
  const splitSecPer500 = Math.round(best.timeS / (best.distanceKm * 2));
  if (splitSecPer500 < MIN_PLAUSIBLE_SPLIT_S || splitSecPer500 > MAX_PLAUSIBLE_SPLIT_S) return null;

  return {
    key: 'row',
    value: splitSecPer500,
    confidence: confidenceFromEffort(best.timeS, qualifying.length),
    qualifyingEffortCount: qualifying.length,
    derivedFrom: {
      externalId: best.workout.externalId,
      startedAt: best.workout.startedAt,
      distanceKm: Math.round(best.distanceKm * 100) / 100,
      timeS: best.timeS,
    },
  };
}

/**
 * Async orchestrator: authorize, fetch the lookback window, derive. Returns
 * null anywhere the fallback ladder bottoms out (unsupported platform, denied
 * permission, insufficient history, implausible result) — callers fall through
 * to the self-report screen, exactly as documented in the WS1 plan's ladder.
 */
export async function proposeAnchorFromHealthKit(key: DerivableAnchorKey): Promise<AnchorProposal | null> {
  if (!isHealthKitSupported()) return null;
  const authorized = await requestHealthKitAuthorization();
  if (!authorized) return null;

  const since = new Date(Date.now() - ANCHOR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const workouts = await fetchHealthKitWorkouts(since);

  return key === 'run' ? deriveRunAnchorProposal(workouts) : deriveRowAnchorProposal(workouts);
}
