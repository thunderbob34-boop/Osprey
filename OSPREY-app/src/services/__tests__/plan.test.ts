// Pin a positive-offset zone: local-midnight dates serialized via toISOString()
// would render the PREVIOUS day here — this is what the fixes must avoid.
process.env.TZ = 'Asia/Kolkata'; // UTC+5:30

// plan.ts imports the supabase client at module level; the pure functions under
// test never touch it.
jest.mock('@/services/supabase', () => ({ supabase: {} }));
// plan.ts transitively pulls in AsyncStorage (a native module, null under Jest).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { currentWeekStartDate, computeRacePhase } from '@/services/plan';

describe('currentWeekStartDate', () => {
  it('returns the LOCAL Monday of the week, not a UTC-shifted day', () => {
    // Wed 2026-07-15, 02:00 local. Monday of that week is 2026-07-13.
    // The old toISOString() version returned '2026-07-12' in this zone.
    expect(currentWeekStartDate(new Date(2026, 6, 15, 2, 0, 0))).toBe('2026-07-13');
  });

  it('treats Sunday as the end of the current week (Monday-start)', () => {
    // Sun 2026-07-19 → its week's Monday is 2026-07-13.
    expect(currentWeekStartDate(new Date(2026, 6, 19, 2, 0, 0))).toBe('2026-07-13');
  });
});

describe('computeRacePhase', () => {
  const goal = { targetDate: '2026-08-10', totalWeeksPlanned: 12 } as Parameters<
    typeof computeRacePhase
  >[0];

  it('computes weeks remaining from LOCAL midnight on both sides', () => {
    // now = 2026-07-13 local; race 2026-08-10 → exactly 4 weeks out.
    const phase = computeRacePhase(goal, new Date(2026, 6, 13, 2, 0, 0));
    expect(phase?.weeksRemaining).toBe(4);
    expect(phase?.currentWeekNumber).toBe(9); // 12 - 4 + 1
    expect(phase?.phase).toBe('Build'); // 9/12 = 0.75
  });

  it('returns null without a target date', () => {
    expect(computeRacePhase({ targetDate: null, totalWeeksPlanned: 12 } as typeof goal)).toBeNull();
  });
});
