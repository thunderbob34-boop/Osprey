import { buildHyroxPrescription } from '@/services/coaching/hyrox';
import {
  hyroxStationWeights,
  predictCompromisedRunSplit,
  isDoublesDivision,
  type HyroxDivision,
} from '@/services/calculators/hyrox';

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

  describe('doubles divisions', () => {
    const forDivision = (division: HyroxDivision) =>
      buildHyroxPrescription({ ...base(), hyroxParams: { division, targetTimeMinutes: null } } as any)!;

    it('races at Open loads — a doubles pair does not get a lighter sled', () => {
      expect(forDivision('doubles_men').stationWeights).toEqual(hyroxStationWeights('open_men'));
      expect(forDivision('doubles_women').stationWeights).toEqual(hyroxStationWeights('open_women'));
    });

    it('a mixed pair races the WOMEN\'S Open loads, not the men\'s', () => {
      // The one rule that is easy to get backwards, so pin it explicitly.
      expect(forDivision('doubles_mixed').stationWeights).toEqual(hyroxStationWeights('open_women'));
      expect(forDivision('doubles_mixed').stationWeights).not.toEqual(hyroxStationWeights('open_men'));
    });

    it('still prescribes the full compromised run split — running is NOT shared', () => {
      // Both partners run all 8 x 1km, so the run prescription is identical to an
      // individual race. Halving it here would under-prepare every doubles athlete.
      expect(forDivision('doubles_mixed').compromisedRunSplitSecPerKm)
        .toEqual(buildHyroxPrescription(base())!.compromisedRunSplitSecPerKm);
    });

    it('classifies divisions correctly', () => {
      expect(isDoublesDivision('doubles_mixed')).toBe(true);
      expect(isDoublesDivision('open_men')).toBe(false);
      expect(isDoublesDivision('pro_women')).toBe(false);
    });
  });
});
