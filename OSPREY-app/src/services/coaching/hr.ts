import { ultraHRZones, UltraHRZones } from '@/services/calculators/ultra';

// HR-based training zones (%-of-max-HR). The math is `ultraHRZones` — the "ultra"
// name is legacy; the 5-zone model is generic. Aliased here so the coaching layer
// reads semantically without forking the calculator.
export type HRZones = UltraHRZones;
export { ultraHRZones };

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
