import { buildCrossfitPrescription } from '@/services/coaching/crossfit';

const base = () => ({
  sport: 'crossfit', phase: 'Base', weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'intermediate', bodyWeightKg: 80, rowingSplitSecPer500: null,
  crossfitParams: { oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, competing: true, franSec: 200 },
} as any);

describe('buildCrossfitPrescription', () => {
  it('builds phase-% strength loads + the athlete Fran tier', () => {
    const c = buildCrossfitPrescription(base())!;
    expect(c.workingPercent1RM).toBe(78);                       // Base
    expect(c.strengthLoadsKg.backSquat).toBe(Math.round(140 * 78 / 100)); // 109
    expect(c.benchmark.franTier).toBe('intermediate');          // franTier(200): 200 > 180 (advanced), 200 <= 300 (intermediate)
    expect(c.energySystems.length).toBe(4);
  });
  it('is null for a non-crossfit sport', () => {
    expect(buildCrossfitPrescription({ ...base(), sport: 'run' })).toBeNull();
  });
  it('is null when crossfitParams is absent (paramless → generic plan)', () => {
    expect(buildCrossfitPrescription({ ...base(), crossfitParams: null })).toBeNull();
  });
  it('uses 0 load for a lift with no 1RM (prompt programs it by RPE)', () => {
    const c = buildCrossfitPrescription({ ...base(), crossfitParams: { oneRepMaxKg: { backSquat: null, deadlift: 180, press: null }, competing: false, franSec: null } })!;
    expect(c.strengthLoadsKg.backSquat).toBe(0);
    expect(c.benchmark.franTier).toBeNull();
  });
});
