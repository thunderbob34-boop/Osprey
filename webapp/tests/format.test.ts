import { describe, it, expect } from 'vitest';
import { formatRaceDistance } from '../src/lib/format';

describe('formatRaceDistance', () => {
  it('returns null for null input', () => {
    expect(formatRaceDistance(null)).toBeNull();
  });
  it('labels an exact 5K', () => {
    expect(formatRaceDistance(5.0)).toBe('5K');
  });
  it('labels an exact 10K', () => {
    expect(formatRaceDistance(10.0)).toBe('10K');
  });
  it('labels the half marathon distance as "Half Marathon"', () => {
    expect(formatRaceDistance(21.0975)).toBe('Half Marathon');
  });
  it('labels a value within tolerance of the half marathon distance (the live F3 case)', () => {
    expect(formatRaceDistance(21.098)).toBe('Half Marathon');
  });
  it('labels the marathon distance', () => {
    expect(formatRaceDistance(42.195)).toBe('Marathon');
  });
  it('falls back to a raw km reading for a non-standard distance', () => {
    expect(formatRaceDistance(15.0)).toBe('15.0km');
  });
  it('does not match a value outside tolerance of any ladder rung', () => {
    expect(formatRaceDistance(22.0)).toBe('22.0km');
  });
});
