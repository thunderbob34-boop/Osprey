// Energy systems + benchmarks + franTier ported from OSPREY-app/src/services/calculators/crossfit.ts.
// CROSSFIT_PHASE_PERCENT + BENCHMARK_BY_PHASE copied by value from coaching/crossfit.ts:8-10 (private consts).
// Keep in sync; parity: tests/crossfit-zones.test.ts.
import type { RacePhaseName } from './race-phase';
import { intensityZoneForPercent1RM } from './strength-loads';

export interface EnergySystemZone {
  system: string;
  minDurationSec: number;
  maxDurationSec: number | null;
  workToRest: string;
  purpose: string;
}

export const ENERGY_SYSTEM_ZONES: EnergySystemZone[] = [
  { system: 'Phosphagen / alactic', minDurationSec: 0, maxDurationSec: 15, workToRest: '1:5-1:10', purpose: 'Power, speed' },
  { system: 'Glycolytic / anaerobic', minDurationSec: 15, maxDurationSec: 120, workToRest: '1:1-1:3', purpose: 'Lactate tolerance' },
  { system: 'Aerobic threshold', minDurationSec: 120, maxDurationSec: 600, workToRest: 'Short rest', purpose: 'Sustainable power' },
  { system: 'Aerobic base (Z2)', minDurationSec: 600, maxDurationSec: null, workToRest: 'Continuous', purpose: 'Engine & recovery' },
];

export type BenchmarkTier = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface CrossfitBenchmark {
  name: string;
  movements: string;
  timeDomain: 'short' | 'medium' | 'long';
  scoreType: 'time' | 'rounds';
  normativeByTier: Record<BenchmarkTier, number>;
}

export const CROSSFIT_BENCHMARKS: CrossfitBenchmark[] = [
  { name: 'Fran', movements: '21-15-9 thrusters (43/30 kg) + pull-ups', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 120, advanced: 180, intermediate: 300, beginner: 480 } },
  { name: 'Grace', movements: '30 clean & jerks (60/40 kg) for time', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 90, advanced: 150, intermediate: 240, beginner: 420 } },
  { name: 'Helen', movements: '3 RFT: 400m run, 21 KB swings (24/16 kg), 12 pull-ups', timeDomain: 'medium', scoreType: 'time', normativeByTier: { elite: 480, advanced: 600, intermediate: 780, beginner: 1020 } },
  { name: 'Cindy', movements: '20 min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats', timeDomain: 'long', scoreType: 'rounds', normativeByTier: { elite: 30, advanced: 24, intermediate: 18, beginner: 12 } },
  { name: 'Murph', movements: '1mi run, 100 pull-ups, 200 push-ups, 300 squats, 1mi run', timeDomain: 'long', scoreType: 'time', normativeByTier: { elite: 2400, advanced: 2880, intermediate: 3600, beginner: 4800 } },
];

export function franTier(franSec: number): BenchmarkTier {
  const fran = CROSSFIT_BENCHMARKS[0].normativeByTier;
  if (franSec <= fran.elite) return 'elite';
  if (franSec <= fran.advanced) return 'advanced';
  if (franSec <= fran.intermediate) return 'intermediate';
  return 'beginner';
}

export const CROSSFIT_PHASE_PERCENT: Record<RacePhaseName, number> = { Base: 78, Build: 84, Peak: 88, Taper: 80 };
export const BENCHMARK_BY_PHASE: Record<RacePhaseName, string> = { Base: 'Fran', Build: 'Fran', Peak: 'Murph', Taper: 'Fran' };

export function crossfitStrengthLoads(
  oneRepMaxKg: { backSquat: number | null; deadlift: number | null; press: number | null },
  phase: RacePhaseName,
): { workingPercent1RM: number; zoneName: string; loads: { backSquat: number; deadlift: number; press: number } } {
  const pct = CROSSFIT_PHASE_PERCENT[phase];
  const load = (orm: number | null) => (orm && orm > 0 ? Math.round((orm * pct) / 100) : 0);
  return {
    workingPercent1RM: pct,
    zoneName: intensityZoneForPercent1RM(pct)?.name ?? 'Strength-Volume',
    loads: { backSquat: load(oneRepMaxKg.backSquat), deadlift: load(oneRepMaxKg.deadlift), press: load(oneRepMaxKg.press) },
  };
}
