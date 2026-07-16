import { franTier, CROSSFIT_BENCHMARKS } from '@/services/calculators/crossfit';

describe('franTier', () => {
  it('buckets a Fran time to the fastest tier it beats', () => {
    expect(franTier(110)).toBe('elite');       // <= 120
    expect(franTier(170)).toBe('advanced');     // <= 180
    expect(franTier(280)).toBe('intermediate'); // <= 300
    expect(franTier(600)).toBe('beginner');     // slower than all
  });
});
describe('CROSSFIT_BENCHMARKS', () => {
  it('includes the five iconic WODs', () => {
    expect(CROSSFIT_BENCHMARKS.map((b) => b.name)).toEqual(['Fran', 'Grace', 'Helen', 'Cindy', 'Murph']);
  });
});
