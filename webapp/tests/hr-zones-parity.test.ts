import { describe, it, expect } from 'vitest';
import { resolveMaxHR as webResolve, ultraHRZones as webZones } from '../src/lib/hr-zones';
import { resolveMaxHR as mobileResolve } from '../../OSPREY-app/src/services/coaching/hr';
import { ultraHRZones as mobileZones } from '../../OSPREY-app/src/services/calculators/ultra';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync webapp/src/lib/hr-zones.ts to the OSPREY-app original.
describe('resolveMaxHR + ultraHRZones parity (webapp port === OSPREY-app original)', () => {
  it('resolveMaxHR matches for observed, out-of-range, and null inputs', () => {
    for (const observed of [null, 150, 119, 221, 190, 205]) {
      expect(webResolve(observed)).toEqual(mobileResolve(observed));
    }
  });

  it('ultraHRZones matches across a range of maxHR values', () => {
    for (const maxHR of [160, 175, 190, 205, 220]) {
      expect(webZones(maxHR)).toEqual(mobileZones(maxHR));
    }
  });
});
