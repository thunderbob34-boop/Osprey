import { localDateString } from '@/utils/date';

describe('localDateString', () => {
  it('formats a date with zero-padded single-digit month and day', () => {
    // January 5, 2026 (month index 0, day 5) -> zero padding needed on both.
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('formats a date with a double-digit month and single-digit day', () => {
    // November 3, 2026 (month index 10 -> "11", day 3 -> "03").
    expect(localDateString(new Date(2026, 10, 3))).toBe('2026-11-03');
  });

  it('formats a date with double-digit month and day', () => {
    expect(localDateString(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  it('formats December 31st correctly (year-end boundary)', () => {
    expect(localDateString(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('uses the local calendar day, not the UTC day', () => {
    // A date constructed from explicit local y/m/d components should always
    // reflect those local components regardless of the machine's timezone.
    const d = new Date(2026, 5, 15, 23, 30); // June 15, 2026, 11:30pm local
    expect(localDateString(d)).toBe('2026-06-15');
  });
});
