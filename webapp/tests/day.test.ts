import { describe, it, expect } from 'vitest';
import { toDateInputValue, localDayRange, addDays, loggedAtFor } from '../src/lib/day';

describe('day', () => {
  it('toDateInputValue uses local date, not UTC', () => {
    // 2026-07-13T23:30 local — UTC slice would say the 14th for negative offsets
    const d = new Date(2026, 6, 13, 23, 30);
    expect(toDateInputValue(d)).toBe('2026-07-13');
  });
  it('localDayRange covers exactly the local day', () => {
    const { start, end } = localDayRange('2026-07-13');
    expect(new Date(start).getTime()).toBe(new Date(2026, 6, 13, 0, 0, 0).getTime());
    expect(new Date(end).getTime()).toBe(new Date(2026, 6, 14, 0, 0, 0).getTime());
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });
  it('loggedAtFor returns now for today, local noon otherwise', () => {
    const now = new Date(2026, 6, 13, 9, 15);
    expect(loggedAtFor('2026-07-13', now)).toBe(now.toISOString());
    expect(new Date(loggedAtFor('2026-07-10', now)).getTime()).toBe(new Date(2026, 6, 10, 12, 0, 0).getTime());
  });
});
