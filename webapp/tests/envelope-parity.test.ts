import { describe, it, expect } from 'vitest';
import { computeEnvelope as webCompute } from '../src/lib/envelope';
import { computeEnvelope as mobileCompute } from '../../OSPREY-app/src/services/coaching/envelope';

// If this test ever fails, the webapp port has DRIFTED from the mobile source
// of truth (for every non-ultra sport — ultra is explicitly excluded).
// Re-sync webapp/src/lib/envelope.ts to the OSPREY-app original.
describe('computeEnvelope parity (webapp port === OSPREY-app original, non-ultra sports)', () => {
  const base = {
    phase: 'Build' as const,
    weekNumber: 5,
    totalWeeks: 12,
    baselineLoad: 300,
    prevWeekLoad: 280,
    bestRunMiles: 6,
    bestRunTimeS: 2700,
    fitnessLevel: 'intermediate',
    bodyWeightKg: 75,
    rowingSplitSecPer500: 115,
    selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: null, ftpWatts: null },
    maxHR: 185,
  };
  const noSportParams = { strengthParams: null, hyroxParams: null, crossfitParams: null };

  it.each(['run', 'swim', 'rowing', 'cycling', 'triathlon'])('matches for sport=%s with no sport-specific params', (sport) => {
    const mobileInput = { ...base, sport, ultraParams: null, ...noSportParams };
    const webInput = { ...base, sport, ...noSportParams };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });

  it('matches for sport=lift with a full strength params set, across phases', () => {
    const strengthParams = { oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 }, goalThirdKg: { squat: 150, bench: 105, deadlift: 190 } };
    for (const phase of ['Base', 'Build', 'Peak', 'Taper'] as const) {
      const mobileInput = { ...base, sport: 'lift', phase, ultraParams: null, strengthParams, hyroxParams: null, crossfitParams: null };
      const webInput = { ...base, sport: 'lift', phase, strengthParams, hyroxParams: null, crossfitParams: null };
      expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
    }
  });

  it('matches for sport=hyrox with a division set', () => {
    const mobileInput = { ...base, sport: 'hyrox', ultraParams: null, strengthParams: null, hyroxParams: { division: 'open_men', targetTimeMinutes: 75 }, crossfitParams: null };
    const webInput = { ...base, sport: 'hyrox', strengthParams: null, hyroxParams: { division: 'open_men' as const, targetTimeMinutes: 75 }, crossfitParams: null };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });

  it('matches for sport=hyrox with no division (null block)', () => {
    const mobileInput = { ...base, sport: 'hyrox', ultraParams: null, strengthParams: null, hyroxParams: null, crossfitParams: null };
    const webInput = { ...base, sport: 'hyrox', strengthParams: null, hyroxParams: { division: null, targetTimeMinutes: null }, crossfitParams: null };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });

  it('matches for sport=crossfit with params', () => {
    const crossfitParams = { oneRepMaxKg: { backSquat: 120, deadlift: 150, press: 60 }, competing: true, franSec: 240 };
    const mobileInput = { ...base, sport: 'crossfit', ultraParams: null, strengthParams: null, hyroxParams: null, crossfitParams };
    const webInput = { ...base, sport: 'crossfit', strengthParams: null, hyroxParams: null, crossfitParams };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });

  it('matches with a self-reported anchor set on every leg (measured confidence path)', () => {
    const selfReportAnchor = { thresholdSecPerMile: 420, cssSecPer100: 90, splitSecPer500: 110, ftpWatts: 220 };
    const mobileInput = { ...base, sport: 'triathlon', selfReportAnchor, ultraParams: null, ...noSportParams };
    const webInput = { ...base, sport: 'triathlon', selfReportAnchor, ...noSportParams };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });

  it('matches with no maxHR observed (estimated HR fallback)', () => {
    const mobileInput = { ...base, sport: 'run', maxHR: null, ultraParams: null, ...noSportParams };
    const webInput = { ...base, sport: 'run', maxHR: null, ...noSportParams };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });

  it('matches with no logged run/rowing data at all (tier-estimate fallback)', () => {
    const emptyBase = { ...base, bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null };
    const mobileInput = { ...emptyBase, sport: 'rowing', ultraParams: null, ...noSportParams };
    const webInput = { ...emptyBase, sport: 'rowing', ...noSportParams };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });
});
