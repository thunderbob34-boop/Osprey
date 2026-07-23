import { describe, it, expect } from 'vitest';
import { blueprintSport as webBlueprint } from '../src/lib/zones';
import { blueprintSport as mobileBlueprint } from '../../OSPREY-app/src/services/coaching/zones';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync webapp/src/lib/zones.ts to the OSPREY-app original.
describe('blueprintSport parity (webapp port === OSPREY-app original)', () => {
  it('matches across every primaryGoal value', () => {
    const goals = ['run', 'hybrid', 'hyrox', 'ultra', 'swim', 'rowing', 'cycling', 'triathlon', 'lift', 'crossfit', 'unknown'];
    for (const goal of goals) expect(webBlueprint(goal)).toBe(mobileBlueprint(goal));
  });
});
