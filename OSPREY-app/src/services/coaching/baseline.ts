import { computeCSSPer100 } from '@/services/calculators/swimming';
import { deriveThresholdSecPerMile } from './anchor';
import { blueprintSport } from './zones';

export type AnchorSource = 'self_report';

// Stored shape of user_goals.threshold_anchor (rowing key is `row`, not `rowing`).
export interface ThresholdAnchorMap {
  run?: { thresholdSecPerMile: number; source: AnchorSource };
  swim?: { cssSecPer100: number; source: AnchorSource };
  row?: { splitSecPer500: number; source: AnchorSource };
  bike?: { ftpWatts: number; source: AnchorSource };
}

// Flat shape consumed by computeEnvelope (see envelope.ts EnvelopeInput).
export interface SelfReportAnchor {
  thresholdSecPerMile: number | null;
  cssSecPer100: number | null;
  splitSecPer500: number | null;
  ftpWatts: number | null;
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

// Plausibility guards keep a typo from poisoning the athlete's zones for weeks.
export function parseSwimBaseline(time400Sec: number, time200Sec: number): ParseResult {
  if (!Number.isFinite(time400Sec) || !Number.isFinite(time200Sec) || time200Sec <= 0) {
    return { ok: false, error: 'Enter both swim times in seconds.' };
  }
  if (time400Sec <= time200Sec) {
    return { ok: false, error: 'Your 400m time should be greater than your 200m time.' };
  }
  const css = computeCSSPer100(time400Sec, time200Sec);
  if (css < 40 || css > 200) {
    return { ok: false, error: "That doesn't look like a valid swim — check your times." };
  }
  return { ok: true, value: css };
}

export function parseRowingBaseline(time2kSec: number): ParseResult {
  if (!Number.isFinite(time2kSec) || time2kSec <= 0) {
    return { ok: false, error: 'Enter your 2k time in seconds.' };
  }
  const split = time2kSec / 4; // 2000 m ÷ 500 m
  if (split < 80 || split > 180) {
    return { ok: false, error: "That doesn't look like a valid 2k time." };
  }
  return { ok: true, value: split };
}

export function parseRunBaseline(distanceMiles: number, timeS: number): ParseResult {
  if (!Number.isFinite(distanceMiles) || !Number.isFinite(timeS) || distanceMiles <= 0 || timeS <= 0) {
    return { ok: false, error: 'Enter a distance and a time.' };
  }
  const threshold = deriveThresholdSecPerMile(distanceMiles, timeS);
  if (threshold < 240 || threshold > 900) {
    return { ok: false, error: "That doesn't look right — check the distance and time." };
  }
  return { ok: true, value: threshold };
}

export function parseFTPBaseline(ftpWatts: number): ParseResult {
  if (!Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    return { ok: false, error: 'Enter your FTP in watts.' };
  }
  if (ftpWatts < 50 || ftpWatts > 600) {
    return { ok: false, error: "That doesn't look like a valid FTP — check your watts." };
  }
  return { ok: true, value: Math.round(ftpWatts) };
}

// The stored anchor key for a primary goal, or null if the goal has no endurance
// anchor to collect. Reuses blueprintSport (run/hybrid/hyrox→run, swim, rowing).
export function anchorKeyForGoal(goal: string): 'run' | 'swim' | 'row' | 'bike' | null {
  if (goal === 'cycling') return 'bike';
  const bp = blueprintSport(goal);
  return bp === 'rowing' ? 'row' : bp; // 'run' | 'swim' | null pass through
}

export function toSelfReportAnchor(map: ThresholdAnchorMap | null | undefined): SelfReportAnchor {
  return {
    thresholdSecPerMile: map?.run?.thresholdSecPerMile ?? null,
    cssSecPer100: map?.swim?.cssSecPer100 ?? null,
    splitSecPer500: map?.row?.splitSecPer500 ?? null,
    ftpWatts: map?.bike?.ftpWatts ?? null,
  };
}
