export interface EnergySystemZone {
  system: string;
  minDurationSec: number;
  maxDurationSec: number | null;
  workToRest: string;
  purpose: string;
}

/** Energy-system zones by time domain (docs/coaching/crossfit.md §2). */
export const ENERGY_SYSTEM_ZONES: EnergySystemZone[] = [
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

export type BenchmarkTier = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface CrossfitBenchmark {
  name: string;
  movements: string;
  timeDomain: 'short' | 'medium' | 'long';
  scoreType: 'time' | 'rounds';
  // time: seconds (lower = fitter); rounds: total rounds (higher = fitter). Normative by tier.
  normativeByTier: Record<BenchmarkTier, number>;
}

export const CROSSFIT_BENCHMARKS: CrossfitBenchmark[] = [
  { name: 'Fran', movements: '21-15-9 thrusters (43/30 kg) + pull-ups', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 120, advanced: 180, intermediate: 300, beginner: 480 } },
  { name: 'Grace', movements: '30 clean & jerks (60/40 kg) for time', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 90, advanced: 150, intermediate: 240, beginner: 420 } },
  { name: 'Helen', movements: '3 RFT: 400m run, 21 KB swings (24/16 kg), 12 pull-ups', timeDomain: 'medium', scoreType: 'time', normativeByTier: { elite: 480, advanced: 600, intermediate: 780, beginner: 1020 } },
  { name: 'Cindy', movements: '20 min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats', timeDomain: 'long', scoreType: 'rounds', normativeByTier: { elite: 30, advanced: 24, intermediate: 18, beginner: 12 } },
  { name: 'Murph', movements: '1mi run, 100 pull-ups, 200 push-ups, 300 squats, 1mi run', timeDomain: 'long', scoreType: 'time', normativeByTier: { elite: 2400, advanced: 2880, intermediate: 3600, beginner: 4800 } },
];

// Bucket a Fran time (sec) to a tier — the fastest tier whose normative bound it beats.
export function franTier(franSec: number): BenchmarkTier {
  const fran = CROSSFIT_BENCHMARKS[0].normativeByTier;
  if (franSec <= fran.elite) return 'elite';
  if (franSec <= fran.advanced) return 'advanced';
  if (franSec <= fran.intermediate) return 'intermediate';
  return 'beginner';
}
