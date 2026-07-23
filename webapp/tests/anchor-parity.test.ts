import { describe, it, expect } from 'vitest';
import {
  selectBestRunEffort as webBestRun,
  selectBestRowingSplit as webBestRow,
  resolveRunningAnchor as webResolve,
  estimateSwimCssByTier as webSwimTier,
  estimateRowingSplitByTier as webRowTier,
} from '../src/lib/anchor';
import {
  selectBestRunEffort as mobileBestRun,
  selectBestRowingSplit as mobileBestRow,
  resolveRunningAnchor as mobileResolve,
  estimateSwimCssByTier as mobileSwimTier,
  estimateRowingSplitByTier as mobileRowTier,
} from '../../OSPREY-app/src/services/coaching/anchor';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync webapp/src/lib/anchor.ts to the OSPREY-app original.
describe('anchor parity (webapp port === OSPREY-app original)', () => {
  it('selectBestRunEffort matches across effort lists, including empty', () => {
    const lists = [
      [],
      [{ distanceMiles: 5, timeS: 2400 }],
      [{ distanceMiles: 3, timeS: 1350 }, { distanceMiles: 8, timeS: 4200 }, { distanceMiles: 0.5, timeS: 200 }],
    ];
    for (const runs of lists) expect(webBestRun(runs)).toEqual(mobileBestRun(runs));
  });

  it('selectBestRowingSplit matches across effort lists, including empty', () => {
    const lists = [
      [],
      [{ distanceKm: 5, timeS: 1200 }],
      [{ distanceKm: 2, timeS: 480 }, { distanceKm: 0.5, timeS: 200 }],
    ];
    for (const efforts of lists) expect(webBestRow(efforts)).toEqual(mobileBestRow(efforts));
  });

  it('resolveRunningAnchor matches for a real effort and for the tier fallback', () => {
    const inputs = [
      { bestRunMiles: 6, bestRunTimeS: 2700, fitnessLevel: 'intermediate' },
      { bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'beginner' },
      { bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'advanced' },
      { bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'unknown-tier' },
    ];
    for (const input of inputs) expect(webResolve(input)).toEqual(mobileResolve(input));
  });

  it('estimateSwimCssByTier and estimateRowingSplitByTier match across tiers', () => {
    for (const tier of ['advanced', 'intermediate', 'beginner', 'unknown-tier']) {
      expect(webSwimTier(tier)).toBe(mobileSwimTier(tier));
      expect(webRowTier(tier)).toBe(mobileRowTier(tier));
    }
  });
});
