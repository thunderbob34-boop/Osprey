// Pin a positive-offset zone so an early-morning local time falls on the
// PREVIOUS day in UTC — this is what makes the "not UTC" regression catchable.
process.env.TZ = 'Asia/Kolkata'; // UTC+5:30

import { localDateString } from '@/utils/date';

describe('localDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(localDateString(new Date(2026, 6, 13, 12, 0, 0))).toBe('2026-07-13');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateString(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05');
  });

  it('uses the LOCAL calendar day, not the UTC day', () => {
    // 2026-01-15 02:00 local (UTC+5:30) is 2026-01-14 20:30 UTC.
    // The old `new Date().toISOString().slice(0,10)` returned '2026-01-14' here.
    expect(localDateString(new Date(2026, 0, 15, 2, 0, 0))).toBe('2026-01-15');
  });

  it('defaults to the current local day when called with no argument', () => {
    const now = new Date();
    const expected = localDateString(now);
    expect(localDateString()).toBe(expected);
  });
});
