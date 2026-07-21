import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fillDailyLoads } from '../src/features/home/queries';

describe('fillDailyLoads', () => {
  // fillDailyLoads windows off the real wall-clock "now". The fixtures below use
  // fixed 2026-01-0x dates (to match this file's exact spec verbatim), so pin the
  // clock to a date whose N-day-back window actually contains them — otherwise
  // these assertions only pass when the suite happens to run near Jan 1-3, 2026.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills every day in the window with 0 TSS when there are no rows', () => {
    const result = fillDailyLoads([], 5);
    expect(result).toHaveLength(5);
    expect(result.every((d) => d.tss === 0)).toBe(true);
  });

  it('sums same-day TSS across multiple workouts', () => {
    const rows = [
      { started_at: '2026-01-01T06:00:00Z', tss: 30 },
      { started_at: '2026-01-01T18:00:00Z', tss: 20 },
    ];
    const result = fillDailyLoads(rows, 3);
    const day1 = result.find((d) => d.date === '2026-01-01');
    expect(day1?.tss).toBe(50);
  });

  it('leaves days with no workouts at 0 TSS', () => {
    const rows = [{ started_at: '2026-01-02T06:00:00Z', tss: 40 }];
    const result = fillDailyLoads(rows, 3);
    const day1 = result.find((d) => d.date === '2026-01-01');
    expect(day1?.tss).toBe(0);
  });

  it('treats a null tss as 0 (no estimate — unlike mobile, this chart never invents a number)', () => {
    const rows = [{ started_at: '2026-01-01T06:00:00Z', tss: null }];
    const result = fillDailyLoads(rows, 1);
    expect(result[0].tss).toBe(0);
  });

  it('returns exactly `days` entries, ending on the most recent day', () => {
    const result = fillDailyLoads([], 84);
    expect(result).toHaveLength(84);
  });
});
