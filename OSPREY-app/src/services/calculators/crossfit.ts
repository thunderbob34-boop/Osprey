export interface EnergySystemZone {
  system: string;
  minDurationSec: number;
  maxDurationSec: number | null;
  workToRest: string;
  purpose: string;
}

/** Energy-system zones by time domain (docs/coaching/crossfit.md §2). */
const ENERGY_SYSTEM_ZONES: EnergySystemZone[] = [
  { system: 'Phosphagen / alactic', minDurationSec: 0, maxDurationSec: 15, workToRest: '1:5-1:10', purpose: 'Power, speed' },
  { system: 'Glycolytic / anaerobic', minDurationSec: 15, maxDurationSec: 120, workToRest: '1:1-1:3', purpose: 'Lactate tolerance' },
  { system: 'Aerobic threshold', minDurationSec: 120, maxDurationSec: 600, workToRest: 'Short rest', purpose: 'Sustainable power' },
  { system: 'Aerobic base (Z2)', minDurationSec: 600, maxDurationSec: null, workToRest: 'Continuous', purpose: 'Engine & recovery' },
];

export function energySystemForDurationSec(durationSec: number): EnergySystemZone {
  return (
    ENERGY_SYSTEM_ZONES.find(
      (z) => durationSec >= z.minDurationSec && (z.maxDurationSec == null || durationSec < z.maxDurationSec),
    ) ?? ENERGY_SYSTEM_ZONES[ENERGY_SYSTEM_ZONES.length - 1]
  );
}

export function crossfitDailyNutrition(bodyWeightKg: number) {
  return {
    carbG: { min: 4 * bodyWeightKg, max: 8 * bodyWeightKg },
    proteinG: { min: 1.6 * bodyWeightKg, max: 2.2 * bodyWeightKg },
  };
}
