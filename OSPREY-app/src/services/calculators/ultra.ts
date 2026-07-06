import { Range } from './types';

/** Five zones as %max HR — this is ultra's threshold anchor (effort/RPE + HR), docs/coaching/ultra.md §2. */
export interface UltraHRZones {
  maxHR: number;
  z1Recovery: Range;
  z2Endurance: Range;
  z3SteadyMarathon: Range;
  z4Threshold: Range;
  z5Vo2Hills: Range;
}

export function ultraHRZones(maxHR: number): UltraHRZones {
  const pct = (p: number) => Math.round(maxHR * (p / 100));
  return {
    maxHR,
    z1Recovery: { min: null, max: pct(70) },
    z2Endurance: { min: pct(70), max: pct(80) },
    z3SteadyMarathon: { min: pct(80), max: pct(87) },
    z4Threshold: { min: pct(87), max: pct(92) },
    z5Vo2Hills: { min: pct(92), max: null },
  };
}

/** In-race carbs g/hr — 60-90 baseline, up to 100-120 with a trained gut (docs/coaching/ultra.md §6). */
export function ultraRaceCarbGPerHour(gutTrained: boolean): Range {
  return gutTrained ? { min: 60, max: 120 } : { min: 60, max: 90 };
}

/** Taper cuts ~25/25/30% off baseline weekly volume across the final 3 weeks (docs/coaching/ultra.md §8). */
export function ultraTaperWeeklyVolumes(baselineWeeklyVolume: number): [number, number, number] {
  const cuts: [number, number, number] = [0.25, 0.25, 0.3];
  return cuts.map((c) => baselineWeeklyVolume * (1 - c)) as [number, number, number];
}
