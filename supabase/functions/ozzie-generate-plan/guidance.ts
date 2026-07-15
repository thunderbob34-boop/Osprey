// Pure prompt-guidance builders. Hand-narrowed mirror of the app's HR zone shape
// (OSPREY-app/src/services/coaching/hr.ts + calculators/ultra.ts UltraHRZones).
// Keep in sync if those change.
interface Range {
  min: number | null;
  max: number | null;
}

interface HRZones {
  maxHR: number;
  z1Recovery: Range;
  z2Endurance: Range;
  z3SteadyMarathon: Range;
  z4Threshold: Range;
  z5Vo2Hills: Range;
}

export interface HrZoneInfo {
  maxHR: number;
  source: 'observed' | 'estimated';
  bands: HRZones;
}

// Prompt-only HR guidance for cross-training / non-pace cardio. Never clamps.
export function hrGuidance(hr: HrZoneInfo | null | undefined): string {
  if (!hr) return '';
  const approx = hr.source === 'estimated' ? ' (estimated — treat as approximate)' : '';
  const z2 = hr.bands.z2Endurance;
  const z4 = hr.bands.z4Threshold;
  return (
    ` HR zones from max HR ~${hr.maxHR} bpm${approx}: keep easy / cross-training cardio in Z2 ${z2.min}-${z2.max} bpm,` +
    ` one harder Z4 ${z4.min}-${z4.max} bpm. Use HR zones (not pace) for bike/cross/easy-cardio sessions,` +
    ` and for all cardio when no pace bands are given.`
  );
}
