import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/crossfit-zones';
import { buildCrossfitPrescription } from '../src/lib/crossfit-zones';
import { ENERGY_SYSTEM_ZONES as mES, CROSSFIT_BENCHMARKS as mB, franTier as mFran, crossfitDailyNutrition as mobileCrossfitNutrition } from '../../OSPREY-app/src/services/calculators/crossfit';
import { buildCrossfitPrescription as mobileBuild } from '../../OSPREY-app/src/services/coaching/crossfit';

describe('crossfit-zones parity + loads', () => {
  it('energy systems, benchmarks, franTier match OSPREY-app', () => {
    expect(web.ENERGY_SYSTEM_ZONES).toEqual(mES);
    expect(web.CROSSFIT_BENCHMARKS).toEqual(mB);
    for (const s of [90, 120, 180, 300, 500]) expect(web.franTier(s)).toBe(mFran(s));
  });
  it('phase percents + benchmark-by-phase match coaching/crossfit.ts:8-10', () => {
    expect(web.CROSSFIT_PHASE_PERCENT).toEqual({ Base: 78, Build: 84, Peak: 88, Taper: 80 });
    expect(web.BENCHMARK_BY_PHASE).toEqual({ Base: 'Fran', Build: 'Fran', Peak: 'Murph', Taper: 'Fran' });
  });
  it('crossfit strength loads = round(1RM*pct/100), 0 for missing', () => {
    const r = web.crossfitStrengthLoads({ backSquat: 140, deadlift: 180, press: null }, 'Build');
    expect(r.workingPercent1RM).toBe(84);
    expect(r.loads).toEqual({ backSquat: 118, deadlift: 151, press: 0 });
  });
});

// If this ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync buildCrossfitPrescription in webapp/src/lib/crossfit-zones.ts
// to the OSPREY-app original.
describe('buildCrossfitPrescription parity (webapp port === OSPREY-app original)', () => {
  it('returns null when sport is not crossfit', () => {
    const input = { sport: 'run', phase: 'Base' as const, crossfitParams: { oneRepMaxKg: { backSquat: 120, deadlift: 150, press: 60 }, competing: true, franSec: 240 } };
    expect(buildCrossfitPrescription(input)).toBeNull();
  });

  it('returns null when crossfitParams is null', () => {
    const input = { sport: 'crossfit', phase: 'Base' as const, crossfitParams: null };
    expect(buildCrossfitPrescription(input)).toBeNull();
    expect(mobileBuild(input as any)).toBeNull();
  });

  it('matches mobile across phases, with a full 1RM set and a Fran time', () => {
    const crossfitParams = { oneRepMaxKg: { backSquat: 120, deadlift: 150, press: 60 }, competing: true, franSec: 240 };
    for (const phase of ['Base', 'Build', 'Peak', 'Taper'] as const) {
      const input = { sport: 'crossfit', phase, crossfitParams };
      expect(buildCrossfitPrescription(input)).toEqual(mobileBuild(input as any));
    }
  });

  it('matches mobile with no 1RMs and no Fran time (general-fitness, competing:false)', () => {
    const crossfitParams = { oneRepMaxKg: { backSquat: null, deadlift: null, press: null }, competing: false, franSec: null };
    const input = { sport: 'crossfit', phase: 'Build' as const, crossfitParams };
    expect(buildCrossfitPrescription(input)).toEqual(mobileBuild(input as any));
  });
});

// If this ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync crossfitDailyNutrition in webapp/src/lib/crossfit-zones.ts
// to the OSPREY-app original.
describe('crossfitDailyNutrition parity (webapp port === OSPREY-app original)', () => {
  it('matches mobile across representative body weights', () => {
    for (const bodyWeightKg of [55, 75, 95]) {
      expect(web.crossfitDailyNutrition(bodyWeightKg)).toEqual(mobileCrossfitNutrition(bodyWeightKg));
    }
  });
});
