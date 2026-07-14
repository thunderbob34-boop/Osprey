import { loadingWeek, targetWeeklyLoad } from '@/services/coaching/periodization';

describe('loadingWeek (3:1)', () => {
  it('cycles build/build/build/recovery', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(loadingWeek)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });
});

describe('targetWeeklyLoad', () => {
  const base = 100;

  it('caps week-over-week growth at 10%', () => {
    const load = targetWeeklyLoad({ baselineLoad: base, phase: 'Build', weekNumber: 2, prevWeekLoad: 100 });
    expect(load).toBeLessThanOrEqual(110);
  });

  it('cuts a recovery week (loadingWeek 4) below the build weeks', () => {
    const build = targetWeeklyLoad({ baselineLoad: base, phase: 'Build', weekNumber: 3, prevWeekLoad: 100 });
    const recovery = targetWeeklyLoad({ baselineLoad: base, phase: 'Build', weekNumber: 4, prevWeekLoad: build });
    expect(recovery).toBeLessThan(build);
  });

  it('tapers hard in Taper phase', () => {
    const peak = targetWeeklyLoad({ baselineLoad: base, phase: 'Peak', weekNumber: 10, prevWeekLoad: 120 });
    const taper = targetWeeklyLoad({ baselineLoad: base, phase: 'Taper', weekNumber: 11, prevWeekLoad: peak });
    expect(taper).toBeLessThan(peak * 0.8);
  });
});
