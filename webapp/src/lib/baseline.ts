// Baseline anchor parse/validate — ported from OSPREY-app/src/services/coaching/
// baseline.ts (parse fns) + anchor.ts (deriveThresholdSecPerMile). Uses the webapp's
// existing riegelPredict port. Keep the validation bounds in sync with the mobile file.
import { computeCSSPer100 } from './training-zones';
import { riegelPredict } from './predictions';

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

const ONE_HOUR_S = 3600;

export function deriveThresholdSecPerMile(distanceMiles: number, timeS: number): number {
  let miles = distanceMiles;
  for (let i = 0; i < 40; i++) {
    const t = riegelPredict(distanceMiles, timeS, miles);
    if (Math.abs(t - ONE_HOUR_S) < 5) break;
    miles *= ONE_HOUR_S / t;
  }
  return Math.round(ONE_HOUR_S / miles);
}

export function parseSwimBaseline(time400Sec: number, time200Sec: number): ParseResult {
  if (!Number.isFinite(time400Sec) || !Number.isFinite(time200Sec) || time200Sec <= 0) {
    return { ok: false, error: 'Enter both swim times in seconds.' };
  }
  if (time400Sec <= time200Sec) {
    return { ok: false, error: 'Your 400m time should be greater than your 200m time.' };
  }
  const css = computeCSSPer100(time400Sec, time200Sec);
  if (css < 40 || css > 200) return { ok: false, error: "That doesn't look like a valid swim — check your times." };
  return { ok: true, value: css };
}

export function parseRowingBaseline(time2kSec: number): ParseResult {
  if (!Number.isFinite(time2kSec) || time2kSec <= 0) return { ok: false, error: 'Enter your 2k time in seconds.' };
  const split = time2kSec / 4;
  if (split < 80 || split > 180) return { ok: false, error: "That doesn't look like a valid 2k time." };
  return { ok: true, value: split };
}

export function parseRunBaseline(distanceMiles: number, timeS: number): ParseResult {
  if (!Number.isFinite(distanceMiles) || !Number.isFinite(timeS) || distanceMiles <= 0 || timeS <= 0) {
    return { ok: false, error: 'Enter a distance and a time.' };
  }
  const threshold = deriveThresholdSecPerMile(distanceMiles, timeS);
  if (threshold < 240 || threshold > 900) return { ok: false, error: "That doesn't look right — check the distance and time." };
  return { ok: true, value: threshold };
}
