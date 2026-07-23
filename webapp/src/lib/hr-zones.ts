// Ported from OSPREY-app/src/services/coaching/hr.ts (resolveMaxHR) +
// OSPREY-app/src/services/calculators/ultra.ts's ultraHRZones — despite the
// "ultra" name, this is mobile's universal HR-zone calculator, called
// unconditionally for every sport's hrZones field (not gated on the
// athlete's goal being ultra). Nothing else from calculators/ultra.ts is
// ported. Keep in sync; parity: tests/hr-zones-parity.test.ts.
import type { Range } from './training-zones';

export interface HRZones {
  maxHR: number;
  z1Recovery: Range;
  z2Endurance: Range;
  z3SteadyMarathon: Range;
  z4Threshold: Range;
  z5Vo2Hills: Range;
}

export function ultraHRZones(maxHR: number): HRZones {
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

export const DEFAULT_MAX_HR = 190;

// Resolve a working max HR from an observed value. Accept only physiologically
// plausible readings (120-220 bpm) — this rejects a spurious sensor spike or a
// zero; otherwise fall back to a conservative default, flagged low-confidence.
export function resolveMaxHR(observed: number | null): { maxHR: number; source: 'observed' | 'estimated' } {
  if (observed != null && observed >= 120 && observed <= 220) {
    return { maxHR: observed, source: 'observed' };
  }
  return { maxHR: DEFAULT_MAX_HR, source: 'estimated' };
}
