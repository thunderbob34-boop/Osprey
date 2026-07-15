import { computeFuel } from '@/services/coaching/fuel';
import { dailyCarbGrams } from '@/services/calculators/shared';

describe('computeFuel', () => {
  it('returns the carb ladder by day-type for the given body weight', () => {
    const f = computeFuel('run', 70);
    expect(f.dailyCarbGByDayType.easy).toEqual(dailyCarbGrams('easy', 70));
    expect(f.dailyCarbGByDayType.high).toEqual(dailyCarbGrams('high', 70));
    expect(f.dailyCarbGByDayType.peak).toEqual(dailyCarbGrams('peak', 70));
  });
  it('sets a positive per-sport in-session carb rate + a sane protein range', () => {
    const f = computeFuel('cycling', 70);
    expect(f.longSessionCarbGPerHour).toBeGreaterThan(0);
    expect(f.proteinG.min).toBe(Math.round(70 * 1.6));
    expect(f.proteinG.max).toBe(Math.round(70 * 2.2));
  });
});
