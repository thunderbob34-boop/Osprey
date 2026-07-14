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
  const goal = { targetRace: null, targetDate: '2026-08-10', totalWeeksPlanned: 12 };

  it('computes weeks remaining from LOCAL midnight on both sides', () => {
    // now = 2026-07-13 local; race 2026-08-10 → exactly 4 weeks out.
    const phase = computeRacePhase(goal, new Date(2026, 6, 13, 2, 0, 0));
    expect(phase?.weeksRemaining).toBe(4);
    expect(phase?.currentWeekNumber).toBe(9); // 12 - 4 + 1
    expect(phase?.phase).toBe('Build'); // 9/12 = 0.75
  });

  it('returns null without a target date', () => {
    expect(computeRacePhase({ targetRace: null, targetDate: null, totalWeeksPlanned: 12 })).toBeNull();
  });
});

describe('computeRacePhase taper window', () => {
  const now = new Date(2026, 0, 5, 12, 0, 0); // Mon 2026-01-05

  it('gives a 16-week plan 3 taper weeks (final 3), not ~1.6', () => {
    // race 3 weeks out in a 16-week plan → Taper
    const goal = { targetRace: null, targetDate: '2026-01-26', totalWeeksPlanned: 16 };
    expect(computeRacePhase(goal, now)?.phase).toBe('Taper');
  });

  it('keeps week 4-of-16-out in Peak/Build, not Taper', () => {
    const goal = { targetRace: null, targetDate: '2026-02-02', totalWeeksPlanned: 16 };
    expect(computeRacePhase(goal, now)?.phase).not.toBe('Taper');
  });

  it('scales taper to 1 week for a short 5-week plan', () => {
    const goal2wk = { targetRace: null, targetDate: '2026-01-19', totalWeeksPlanned: 5 };
    expect(computeRacePhase(goal2wk, now)?.phase).not.toBe('Taper'); // 2 weeks out, taper=1 → still Build/Peak
    const goal1wk = { targetRace: null, targetDate: '2026-01-12', totalWeeksPlanned: 5 };
    expect(computeRacePhase(goal1wk, now)?.phase).toBe('Taper'); // 1 week out → Taper
  });
});
