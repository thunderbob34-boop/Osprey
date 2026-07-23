import { describe, it, expect } from 'vitest';
import { computeFuel as webFuel } from '../src/lib/fuel';
import { computeFuel as mobileFuel } from '../../OSPREY-app/src/services/coaching/fuel';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth (for every non-ultra sport — ultra is explicitly excluded from this
// port). Re-sync webapp/src/lib/fuel.ts to the OSPREY-app original.
describe('computeFuel parity (webapp port === OSPREY-app original, non-ultra sports)', () => {
  const sports = ['run', 'swim', 'rowing', 'cycling', 'triathlon', 'hybrid', 'lift', 'hyrox', 'crossfit'];

  it('matches across every non-ultra sport and a range of body weights', () => {
    for (const sport of sports) {
      for (const bw of [55, 70, 90, 110]) {
        expect(webFuel(sport, bw)).toEqual(mobileFuel(sport, bw));
      }
    }
  });
});
