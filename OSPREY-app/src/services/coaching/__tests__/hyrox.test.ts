import { buildHyroxPrescription } from '@/services/coaching/hyrox';
import { hyroxStationWeights, predictCompromisedRunSplit } from '@/services/calculators/hyrox';

const base = () => ({
  sport: 'hyrox', phase: 'Base', weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'intermediate', bodyWeightKg: 70,
  rowingSplitSecPer500: null,
  selfReportAnchor: { thresholdSecPerMile: 483, cssSecPer100: null, splitSecPer500: null, ftpWatts: null }, // ~300 s/km
  hyroxParams: { division: 'open_men', targetTimeMinutes: null },
} as any);

describe('buildHyroxPrescription', () => {
  it('builds a prescription from the division + run threshold', () => {
    const h = buildHyroxPrescription(base())!;
    expect(h.division).toBe('open_men');
    expect(h.stationWeights).toEqual(hyroxStationWeights('open_men'));   // sled push 152kg, etc.
    // 483 s/mile → 300 s/km → compromised split = threshold + 15..30
    expect(h.compromisedRunSplitSecPerKm).toEqual(predictCompromisedRunSplit(300));
    expect(h.sodiumMgPerHour).toEqual({ min: 500, max: 1000 });
    expect(h.caffeineMg).toEqual({ min: Math.round(3 * 70), max: Math.round(6 * 70) });
  });
  it('is null for a non-hyrox sport', () => {
    expect(buildHyroxPrescription({ ...base(), sport: 'run' })).toBeNull();
  });
  it('is null when hyroxParams is absent (paramless hyrox → generic plan)', () => {
    expect(buildHyroxPrescription({ ...base(), hyroxParams: null })).toBeNull();
    expect(buildHyroxPrescription({ ...base(), hyroxParams: undefined })).toBeNull();
  });
});
