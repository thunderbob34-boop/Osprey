import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/crossfit-zones';
import { ENERGY_SYSTEM_ZONES as mES, CROSSFIT_BENCHMARKS as mB, franTier as mFran } from '../../OSPREY-app/src/services/calculators/crossfit';

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
