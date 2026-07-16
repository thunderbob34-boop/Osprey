import { intensityZoneForPercent1RM } from '@/services/calculators/powerlifting';
import { ENERGY_SYSTEM_ZONES, franTier, CROSSFIT_BENCHMARKS, type EnergySystemZone, type BenchmarkTier } from '@/services/calculators/crossfit';
import { Phase } from './periodization';
import type { EnvelopeInput } from './envelope';

// Concurrent-strength %1RM by phase (crossfit is not peaking a 1RM like powerlifting).
// Each value lands inside an INTENSITY_ZONES band so intensityZoneForPercent1RM is non-null.
const CROSSFIT_PHASE_PERCENT: Record<Phase, number> = { Base: 78, Build: 84, Peak: 88, Taper: 80 };
// Benchmark to test per phase (short in Base/Build, a Hero before Competition, retest at Taper).
const BENCHMARK_BY_PHASE: Record<Phase, string> = { Base: 'Fran', Build: 'Fran', Peak: 'Murph', Taper: 'Fran' };

export interface CrossfitPrescription {
  strengthLoadsKg: { backSquat: number; deadlift: number; press: number }; // 0 = no 1RM → RPE
  workingPercent1RM: number;
  zoneName: string;
  energySystems: EnergySystemZone[];
  benchmark: { name: string; timeDomain: string; athleteFranSec: number | null; franTier: BenchmarkTier | null };
}

export function buildCrossfitPrescription(input: EnvelopeInput): CrossfitPrescription | null {
  if (input.sport !== 'crossfit') return null;
  const p = input.crossfitParams;
  if (!p) return null;
  const pct = CROSSFIT_PHASE_PERCENT[input.phase];
  const zone = intensityZoneForPercent1RM(pct);
  const load = (orm: number | null) => (orm && orm > 0 ? Math.round(orm * pct / 100) : 0);
  const name = BENCHMARK_BY_PHASE[input.phase];
  return {
    strengthLoadsKg: { backSquat: load(p.oneRepMaxKg.backSquat), deadlift: load(p.oneRepMaxKg.deadlift), press: load(p.oneRepMaxKg.press) },
    workingPercent1RM: pct,
    zoneName: zone?.name ?? 'Strength-Volume',
    energySystems: ENERGY_SYSTEM_ZONES,
    benchmark: {
      name,
      timeDomain: CROSSFIT_BENCHMARKS.find((b) => b.name === name)?.timeDomain ?? 'short',
      athleteFranSec: p.franSec,
      franTier: p.franSec != null ? franTier(p.franSec) : null,
    },
  };
}
