import { computeElevationGainM } from '@/services/workouts';
import type { TrackPoint } from '@/types/workout';

// workouts.ts imports the supabase client and healthkit/offline-cache at
// module level for its fetch/save helpers; the pure function under test
// never touches any of them.
jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@/services/healthkit', () => ({ writeWorkoutToHealthKit: jest.fn() }));
jest.mock('@/services/offline-cache', () => ({ withCache: (_key: unknown, fn: () => unknown) => fn() }));

function point(altitudeM?: number): TrackPoint {
  return { lat: 0, lon: 0, recordedAt: new Date().toISOString(), altitudeM };
}

describe('computeElevationGainM', () => {
  it('returns null with fewer than two altitude-bearing points', () => {
    expect(computeElevationGainM([])).toBeNull();
    expect(computeElevationGainM([point(100)])).toBeNull();
  });

  it('ignores points with no altitude reading', () => {
    const points = [point(undefined), point(undefined)];
    expect(computeElevationGainM(points)).toBeNull();
  });

  it('sums only positive deltas — descents do not offset climbs', () => {
    // 100 -> 150 (+50) -> 120 (-30, ignored) -> 180 (+60) = 110m gain
    const points = [point(100), point(150), point(120), point(180)];
    expect(computeElevationGainM(points)).toBe(110);
  });

  it('returns 0 for a flat or descending-only track', () => {
    const points = [point(200), point(190), point(150)];
    expect(computeElevationGainM(points)).toBe(0);
  });

  it('skips points with no altitude when computing deltas between neighbors', () => {
    // Only the two altitude-bearing points count: 100 -> 250 = +150.
    const points = [point(100), point(undefined), point(250)];
    expect(computeElevationGainM(points)).toBe(150);
  });

  it('rounds the total to the nearest meter', () => {
    const points = [point(100.2), point(100.9)];
    expect(computeElevationGainM(points)).toBe(1);
  });
});
