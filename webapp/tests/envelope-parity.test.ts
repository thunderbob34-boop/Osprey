import { describe, it, expect } from 'vitest';
import { computeEnvelope as webCompute, resolveZones as webResolveZones } from '../src/lib/envelope';
import { computeEnvelope as mobileCompute, resolveZones as mobileResolveZones } from '../../OSPREY-app/src/services/coaching/envelope';

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

  it('matches with a fractional baselineLoad (mobile rounds it into scaledBaseline before targetWeeklyLoad)', () => {
    // phase=Peak (non-1.0 factor) + prevWeekLoad=null (no progression cap to mask the
    // rounding) is required for this case to actually distinguish Math.round(baselineLoad)
    // from a raw baselineLoad: 305.5*1.1 rounds to 336, but Math.round(305.5)*1.1 rounds to
    // 337 — the two only diverge once the fractional part survives to interact with a
    // non-integer phase factor.
    const mobileInput = { ...base, sport: 'run', phase: 'Peak' as const, prevWeekLoad: null, baselineLoad: 305.5, ultraParams: null, ...noSportParams };
    const webInput = { ...base, sport: 'run', phase: 'Peak' as const, prevWeekLoad: null, baselineLoad: 305.5, ...noSportParams };
    expect(webCompute(webInput)).toEqual(mobileCompute(mobileInput as any));
  });
});

// computeEnvelope above calls resolveZones internally but discards its second return
// value (zonesConfidence), so the parity coverage above never exercises resolveZones'
// confidence signal directly. This block calls resolveZones itself and asserts the FULL
// { zones, zonesConfidence } return value, with inputs picked so each sport actually
// lands on both 'measured' and 'estimated' — not just whichever value the shared `base`
// object above happens to produce for it.
describe('resolveZones confidence parity (webapp port === OSPREY-app original)', () => {
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
  const noAnchor = base.selfReportAnchor;
  const noSportParams = { strengthParams: null, hyroxParams: null, crossfitParams: null };

  it('run: tier-estimate fallback with no logged data and no self-report', () => {
    const input = { ...base, sport: 'run', bestRunMiles: null, bestRunTimeS: null };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('estimated');
  });

  it('run: measured — derived from logged best-effort data, no self-report', () => {
    const input = { ...base, sport: 'run' };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('measured');
  });

  it('run: measured — self-reported threshold, no logged data', () => {
    const input = { ...base, sport: 'run', bestRunMiles: null, bestRunTimeS: null, selfReportAnchor: { ...noAnchor, thresholdSecPerMile: 420 } };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('measured');
  });

  it('swim: tier-estimate fallback with no self-report (swim has no logged-data path)', () => {
    const input = { ...base, sport: 'swim' };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('estimated');
  });

  it('swim: measured — self-reported CSS', () => {
    const input = { ...base, sport: 'swim', selfReportAnchor: { ...noAnchor, cssSecPer100: 90 } };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('measured');
  });

  it('rowing: tier-estimate fallback with no logged split and no self-report', () => {
    const input = { ...base, sport: 'rowing', rowingSplitSecPer500: null };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('estimated');
  });

  it('rowing: measured — derived from a logged split, no self-report', () => {
    const input = { ...base, sport: 'rowing' };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('measured');
  });

  it('rowing: measured — self-reported split overrides absent logged data', () => {
    const input = { ...base, sport: 'rowing', rowingSplitSecPer500: null, selfReportAnchor: { ...noAnchor, splitSecPer500: 110 } };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('measured');
  });

  it('cycling: no FTP anywhere -> zones stay null and confidence stays estimated', () => {
    const input = { ...base, sport: 'cycling' };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zones).toBeNull();
    expect(result.zonesConfidence).toBe('estimated');
  });

  it('cycling: measured — self-reported FTP produces power zones', () => {
    const input = { ...base, sport: 'cycling', selfReportAnchor: { ...noAnchor, ftpWatts: 220 } };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zones).not.toBeNull();
    expect(result.zonesConfidence).toBe('measured');
  });

  it('triathlon: measured — every shown leg self-reported', () => {
    const input = { ...base, sport: 'triathlon', selfReportAnchor: { thresholdSecPerMile: 420, cssSecPer100: 90, splitSecPer500: null, ftpWatts: 220 } };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('measured');
  });

  it('triathlon: estimated overall when the swim leg falls to tier, even with run self-reported', () => {
    const input = {
      ...base, sport: 'triathlon', bestRunMiles: null, bestRunTimeS: null,
      selfReportAnchor: { ...noAnchor, thresholdSecPerMile: 420 },
    };
    const mobileInput = { ...input, ultraParams: null, ...noSportParams };
    const webInput = { ...input, ...noSportParams };
    const result = webResolveZones(webInput);
    expect(result).toEqual(mobileResolveZones(mobileInput as any));
    expect(result.zonesConfidence).toBe('estimated');
  });
});
