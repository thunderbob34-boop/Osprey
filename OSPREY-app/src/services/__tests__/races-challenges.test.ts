import { formatRaceTime, goalPacePerMile, parseRaceTime } from '@/services/races';
import { formatChallengeValue } from '@/services/challenges';

// Both services import the supabase client at module level for their fetch
// helpers; the pure helpers under test never touch it.
jest.mock('@/services/supabase', () => ({ supabase: {} }));

describe('parseRaceTime', () => {
  it('parses h:mm:ss', () => {
    expect(parseRaceTime('1:45:00')).toBe(6300);
  });

  it('parses mm:ss', () => {
    expect(parseRaceTime('22:30')).toBe(1350);
  });

  it('treats a bare number as minutes', () => {
    expect(parseRaceTime('90')).toBe(5400);
  });

  it('rejects junk', () => {
    expect(parseRaceTime('abc')).toBeNull();
    expect(parseRaceTime('1:xx:00')).toBeNull();
    expect(parseRaceTime('')).toBeNull();
  });
});

describe('formatRaceTime', () => {
  it('round-trips with parseRaceTime', () => {
    expect(formatRaceTime(parseRaceTime('1:45:00')!)).toBe('1:45:00');
    expect(formatRaceTime(parseRaceTime('22:05')!)).toBe('22:05');
  });

  it('returns null for null input', () => {
    expect(formatRaceTime(null)).toBeNull();
  });
});

describe('goalPacePerMile', () => {
  it('computes mm:ss per mile from goal time + distance', () => {
    // 5K (3.107 mi) in 20:00 → ~6:26/mi
    expect(goalPacePerMile(1200, 5)).toBe('6:26');
  });

  it('returns null without both inputs', () => {
    expect(goalPacePerMile(null, 5)).toBeNull();
    expect(goalPacePerMile(1200, null)).toBeNull();
    expect(goalPacePerMile(1200, 0)).toBeNull();
  });
});

describe('formatChallengeValue', () => {
  it('defaults to imperial', () => {
    expect(formatChallengeValue(26.2, 'mileage')).toBe('26.2 mi');
    expect(formatChallengeValue(12500, 'lift_volume')).toBe('12,500 lbs');
  });

  it('converts mileage and lift volume for metric users', () => {
    expect(formatChallengeValue(10, 'mileage', 'metric')).toBe('16.1 km');
    expect(formatChallengeValue(1000, 'lift_volume', 'metric')).toBe('454 kg');
  });

  it('leaves unit-less types alone regardless of preference', () => {
    expect(formatChallengeValue(5, 'workouts', 'metric')).toBe('5 workouts');
    expect(formatChallengeValue(90, 'duration', 'metric')).toBe('90 min');
    expect(formatChallengeValue(1, 'streak', 'metric')).toBe('1 day');
    expect(formatChallengeValue(7, 'streak', 'metric')).toBe('7 days');
  });
});
