// Training-zone math — ported verbatim from OSPREY-app/src/services/calculators/
// {types,swimming,running,rowing}.ts, the tested, shipped formulas the mobile app
// uses. Keep in sync with those; do not fork the math (parity test: tests/zone-parity.test.ts).

/** A numeric band; either bound is null when the zone is open-ended. */
export interface Range {
  min: number | null;
  max: number | null;
}

export function midpoint(range: Range): number | null {
  if (range.min == null || range.max == null) return null;
  return (range.min + range.max) / 2;
}

export function formatMinSec(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

/** CSS per 100 = (400 time − 200 time) ÷ 2, both in seconds. */
export function computeCSSPer100(time400Sec: number, time200Sec: number): number {
  return (time400Sec - time200Sec) / 2;
}

export interface SwimPaceZones {
  cssSecPer100: number;
  z1EasyRecovery: Range;
  z2Aerobic: Range;
  z3Threshold: Range;
  z4Vo2Max: Range;
}

export function swimPaceZones(cssSecPer100: number): SwimPaceZones {
  return {
    cssSecPer100,
    z1EasyRecovery: { min: cssSecPer100 + 8, max: null },
    z2Aerobic: { min: cssSecPer100 + 3, max: cssSecPer100 + 6 },
    z3Threshold: { min: cssSecPer100 - 2, max: cssSecPer100 + 2 },
    z4Vo2Max: { min: cssSecPer100 - 5, max: cssSecPer100 - 2 },
  };
}

export interface RunningPaceZones {
  thresholdSecPerMile: number;
  easy: Range;
  marathonPace: Range;
  halfMarathonPace: Range;
  tenKPace: Range;
  fiveKPace: Range;
  intervalPace: Range;
}

export function runningPaceZones(thresholdSecPerMile: number): RunningPaceZones {
  const t = thresholdSecPerMile;
  return {
    thresholdSecPerMile: t,
    easy: { min: t + 60, max: t + 120 },
    marathonPace: { min: t + 15, max: t + 30 },
    halfMarathonPace: { min: t + 5, max: t + 15 },
    tenKPace: { min: t - 15, max: t - 5 },
    fiveKPace: { min: t - 30, max: t - 20 },
    intervalPace: { min: t - 20, max: t - 10 },
  };
}

export function formatRunningPace(secPerMile: number): string {
  return `${formatMinSec(secPerMile)}/mi`;
}

export interface RowingZone {
  splitSecPer500: Range;
  strokeRateSpm: Range;
  percentOf2kPower: Range;
}

export interface RowingTrainingZones {
  current2kSplitSecPer500: number;
  ut2: RowingZone;
  ut1: RowingZone;
  at: RowingZone;
  tr: RowingZone;
  an: RowingZone;
}

export function rowingTrainingZones(current2kSplitSecPer500: number): RowingTrainingZones {
  const split = current2kSplitSecPer500;
  return {
    current2kSplitSecPer500: split,
    ut2: { splitSecPer500: { min: split + 12, max: split + 16 }, strokeRateSpm: { min: 18, max: 20 }, percentOf2kPower: { min: 55, max: 65 } },
    ut1: { splitSecPer500: { min: split + 6, max: split + 10 }, strokeRateSpm: { min: 22, max: 24 }, percentOf2kPower: { min: 65, max: 75 } },
    at: { splitSecPer500: { min: split + 3, max: split + 5 }, strokeRateSpm: { min: 26, max: 28 }, percentOf2kPower: { min: 75, max: 85 } },
    tr: { splitSecPer500: { min: split, max: split + 2 }, strokeRateSpm: { min: 28, max: 32 }, percentOf2kPower: { min: 85, max: 95 } },
    an: { splitSecPer500: { min: null, max: split }, strokeRateSpm: { min: 34, max: 40 }, percentOf2kPower: { min: 95, max: 110 } },
  };
}
