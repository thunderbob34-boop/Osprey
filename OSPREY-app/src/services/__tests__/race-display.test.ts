import { formatRaceDistance, RACE_DISTANCE_LADDER } from '@/services/race-display';

describe('RACE_DISTANCE_LADDER', () => {
  it('has the four standard race distances in km', () => {
    expect(RACE_DISTANCE_LADDER).toEqual([
      { label: '5K', km: 5 },
      { label: '10K', km: 10 },
      { label: 'Half', km: 21.0975 },
      { label: 'Full', km: 42.195 },
    ]);
  });
});

describe('formatRaceDistance', () => {
  it('labels an exact 5K (metric)', () => {
    expect(formatRaceDistance(5.0, 'metric')).toBe('5K');
  });
  it('labels an exact 10K (imperial)', () => {
    expect(formatRaceDistance(10.0, 'imperial')).toBe('10K');
  });
  it('labels the half marathon distance as "Half Marathon"', () => {
    expect(formatRaceDistance(21.0975, 'metric')).toBe('Half Marathon');
  });
  it('labels a value within tolerance of the half marathon distance', () => {
    expect(formatRaceDistance(21.1, 'metric')).toBe('Half Marathon');
  });
  it('labels the marathon distance as "Marathon"', () => {
    expect(formatRaceDistance(42.195, 'metric')).toBe('Marathon');
  });
  it('falls back to unit-aware raw distance for a non-standard distance (metric)', () => {
    expect(formatRaceDistance(15.0, 'metric')).toBe('15 km');
  });
  it('falls back to unit-aware raw distance for a non-standard distance (imperial)', () => {
    expect(formatRaceDistance(15.0, 'imperial')).toBe('9.3 mi');
  });
  it('does not match a value outside tolerance of any ladder rung', () => {
    expect(formatRaceDistance(22.0, 'metric')).toBe('22 km');
  });
});
