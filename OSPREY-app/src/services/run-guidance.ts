// In-run structured guidance: turns today's interval_prescription into live
// step-by-step targets during a GPS run — pace band per effort, auto-advance
// on time/distance, and Ozzie cue text at every transition. Pace bands are
// anchored to the athlete's own fitness (Riegel-predicted 10K pace from their
// best recent run ≈ threshold pace), so "hard" means *their* hard.

import { fetchPerformanceData, riegelPredict } from '@/services/performance';
import { ozzieCueForStep, type IntervalStep } from '@/services/intervals';
import type { IntervalEffort } from '@/types/workout';

const TEN_K_MILES = 6.214;

export interface PaceBand {
  minSecPerMile: number; // fastest acceptable
  maxSecPerMile: number; // slowest acceptable
}

export type PaceBands = Record<IntervalEffort, PaceBand>;

// Multipliers on threshold pace (higher = slower). Standard training-zone
// ratios: easy ~25-45% slower than threshold, VO2 work ~3-12% faster.
const EFFORT_MULTIPLIERS: Record<IntervalEffort, [number, number]> = {
  easy: [1.25, 1.45],
  moderate: [1.12, 1.25],
  threshold: [0.97, 1.05],
  hard: [0.88, 0.97],
  max: [0.75, 0.88],
};

/**
 * Pace bands derived from the athlete's best run in the last 84 days, or null
 * when there isn't enough history (guidance then shows effort labels only).
 */
export async function fetchPaceBands(userId: string): Promise<PaceBands | null> {
  const { bestRunMiles, bestRunTimeS } = await fetchPerformanceData(userId);
  if (bestRunMiles < 1 || bestRunTimeS <= 0) return null;

  const tenKTimeS = riegelPredict(bestRunMiles, bestRunTimeS, TEN_K_MILES);
  const thresholdSecPerMile = tenKTimeS / TEN_K_MILES;

  const bands = {} as PaceBands;
  for (const effort of Object.keys(EFFORT_MULTIPLIERS) as IntervalEffort[]) {
    const [fast, slow] = EFFORT_MULTIPLIERS[effort];
    bands[effort] = {
      minSecPerMile: thresholdSecPerMile * fast,
      maxSecPerMile: thresholdSecPerMile * slow,
    };
  }
  return bands;
}

export function formatPaceSecPerMile(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPaceBand(band: PaceBand): string {
  return `${formatPaceSecPerMile(band.minSecPerMile)}–${formatPaceSecPerMile(band.maxSecPerMile)} /mi`;
}

export type PaceStatus = 'in_band' | 'too_fast' | 'too_slow';

export function paceStatusForBand(currentSecPerMile: number, band: PaceBand): PaceStatus {
  if (currentSecPerMile < band.minSecPerMile) return 'too_fast';
  if (currentSecPerMile > band.maxSecPerMile) return 'too_slow';
  return 'in_band';
}

/** Progress within the active step, measured from where the step began. */
export interface StepProgress {
  elapsedInStepS: number;
  distanceInStepM: number;
  /** Rolling pace over this step only, or null before enough distance is covered. */
  stepPaceSecPerMile: number | null;
  /** Seconds left (duration steps) or meters left (distance steps). */
  remainingS: number | null;
  remainingM: number | null;
  done: boolean;
}

const MIN_PACE_SAMPLE_MILES = 0.03; // ~50m before showing a step pace

export function computeStepProgress(
  step: IntervalStep,
  stepStartElapsedS: number,
  stepStartDistanceM: number,
  elapsedS: number,
  distanceM: number,
): StepProgress {
  const elapsedInStepS = Math.max(0, elapsedS - stepStartElapsedS);
  const distanceInStepM = Math.max(0, distanceM - stepStartDistanceM);
  const stepMiles = distanceInStepM / 1609.344;

  const stepPaceSecPerMile =
    stepMiles >= MIN_PACE_SAMPLE_MILES && elapsedInStepS > 0 ? elapsedInStepS / stepMiles : null;

  const remainingS = step.durationS != null ? Math.max(0, step.durationS - elapsedInStepS) : null;
  const remainingM = step.distanceM != null ? Math.max(0, step.distanceM - distanceInStepM) : null;

  const done =
    step.durationS != null
      ? elapsedInStepS >= step.durationS
      : step.distanceM != null
        ? distanceInStepM >= step.distanceM
        : false;

  return { elapsedInStepS, distanceInStepM, stepPaceSecPerMile, remainingS, remainingM, done };
}

/** Ozzie's spoken cue for a step transition, with the pace target when known. */
export function runCueForStep(step: IntervalStep, bands: PaceBands | null): string {
  const base = ozzieCueForStep(step);
  if (step.phase === 'rest' || !bands) return base;
  const band = bands[step.effort as IntervalEffort];
  if (!band) return base;
  return `${base} Target ${formatPaceSecPerMile(band.minSecPerMile)} to ${formatPaceSecPerMile(band.maxSecPerMile)} per mile.`;
}
