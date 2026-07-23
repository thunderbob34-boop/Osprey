import { describe, it, expect } from 'vitest';
import { targetWeeklyLoad as webTarget } from '../src/lib/periodization';
import { targetWeeklyLoad as mobileTarget } from '../../OSPREY-app/src/services/coaching/periodization';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync webapp/src/lib/periodization.ts to the OSPREY-app original.
describe('targetWeeklyLoad parity (webapp port === OSPREY-app original)', () => {
  const phases = ['Base', 'Build', 'Peak', 'Taper'] as const;
  const weeks = [1, 2, 3, 4, 5, 8];
  const prevWeekLoads = [null, 180, 250];

  it('matches across phase × week × prevWeekLoad matrix', () => {
    for (const phase of phases) {
      for (const weekNumber of weeks) {
        for (const prevWeekLoad of prevWeekLoads) {
          const input = { baselineLoad: 200, phase, weekNumber, prevWeekLoad };
          expect(webTarget(input)).toBe(mobileTarget(input));
        }
      }
    }
  });

  it('matches with a different baseline load', () => {
    const input = { baselineLoad: 350, phase: 'Build' as const, weekNumber: 3, prevWeekLoad: 300 };
    expect(webTarget(input)).toBe(mobileTarget(input));
  });
});
