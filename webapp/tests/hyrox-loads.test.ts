import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/hyrox-loads';
import { buildHyroxPrescription } from '../src/lib/hyrox-loads';
import { buildHyroxPrescription as mobileBuild } from '../../OSPREY-app/src/services/coaching/hyrox';
import { predictCompromisedRunSplit as mSplit, hyroxStationWeights as mW } from '../../OSPREY-app/src/services/calculators/hyrox';

describe('hyrox-loads parity', () => {
  it('compromised split matches OSPREY-app', () => {
    for (const t of [200, 240, 300]) expect(web.predictCompromisedRunSplit(t)).toEqual(mSplit(t));
  });
  it('station weights match OSPREY-app for all divisions', () => {
    for (const d of web.HYROX_DIVISIONS) expect(web.hyroxStationWeights(d)).toEqual(mW(d));
  });
  it('threshold sec/mile → compromised sec/km', () => {
    expect(web.compromisedSplitFromThresholdMile(450)).toEqual(mSplit(Math.round(450 * 0.621371)));
  });
});

// If this ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync buildHyroxPrescription in webapp/src/lib/hyrox-loads.ts to
// the OSPREY-app original.
describe('buildHyroxPrescription parity (webapp port === OSPREY-app original)', () => {
  const base = { sport: 'hyrox', bodyWeightKg: 78, selfReportAnchor: null, bestRunMiles: 6, bestRunTimeS: 2700, fitnessLevel: 'intermediate' };

  it('returns null when sport is not hyrox', () => {
    const input = { ...base, sport: 'run', hyroxParams: { division: 'open_men' as const, targetTimeMinutes: 75 } };
    expect(buildHyroxPrescription(input)).toBeNull();
  });

  it('returns null when hyroxParams is null', () => {
    const input = { ...base, hyroxParams: null };
    expect(buildHyroxPrescription(input)).toBeNull();
    expect(mobileBuild({ ...input, hyroxParams: null } as any)).toBeNull();
  });

  it('returns null when division is null (webapp shape, matching mobile\'s null-object case)', () => {
    const webResult = buildHyroxPrescription({ ...base, hyroxParams: { division: null, targetTimeMinutes: null } });
    const mobileResult = mobileBuild({ ...base, hyroxParams: null } as any);
    expect(webResult).toEqual(mobileResult);
  });

  it('matches mobile across divisions, using the self-report threshold when present', () => {
    const divisions = ['open_men', 'open_women', 'pro_men', 'pro_women', 'doubles_men', 'doubles_women', 'doubles_mixed'] as const;
    for (const division of divisions) {
      const input = { ...base, selfReportAnchor: { thresholdSecPerMile: 420 }, hyroxParams: { division, targetTimeMinutes: 90 } };
      const webResult = buildHyroxPrescription(input);
      const mobileResult = mobileBuild({ ...input, selfReportAnchor: { thresholdSecPerMile: 420, cssSecPer100: null, splitSecPer500: null, ftpWatts: null } } as any);
      expect(webResult).toEqual(mobileResult);
    }
  });

  it('matches mobile falling back to the tier-estimate threshold when no self-report or logged run exists', () => {
    const input = { sport: 'hyrox', bodyWeightKg: 78, selfReportAnchor: null, bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'beginner', hyroxParams: { division: 'open_women' as const, targetTimeMinutes: null } };
    const webResult = buildHyroxPrescription(input);
    const mobileResult = mobileBuild({ ...input, selfReportAnchor: null } as any);
    expect(webResult).toEqual(mobileResult);
  });
});
