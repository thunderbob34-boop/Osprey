import { resolveRunningAnchor } from '@/services/coaching/anchor';

describe('resolveRunningAnchor', () => {
  it('derives threshold pace from a logged effort (a 20:00 5K → sane T pace)', () => {
    // 5K = 3.107 mi in 1200s → ~6:26/mi race pace; threshold (~1hr pace) is slower.
    const a = resolveRunningAnchor({ bestRunMiles: 3.107, bestRunTimeS: 1200, fitnessLevel: 'intermediate' });
    expect(a.source).toBe('derived');
    // Threshold pace must be slower (bigger sec/mile) than 5K race pace (~386 s/mi) and realistic (< 12 min/mi).
    expect(a.thresholdSecPerMile).toBeGreaterThan(386);
    expect(a.thresholdSecPerMile).toBeLessThan(720);
  });

  it('falls back to an experience-tier estimate with no logged data', () => {
    const a = resolveRunningAnchor({ bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'beginner' });
    expect(a.source).toBe('estimate');
    expect(a.thresholdSecPerMile).toBeGreaterThan(0);
  });

  it('estimates a faster threshold for advanced than beginner', () => {
    const adv = resolveRunningAnchor({ bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'advanced' });
    const beg = resolveRunningAnchor({ bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'beginner' });
    expect(adv.thresholdSecPerMile).toBeLessThan(beg.thresholdSecPerMile);
  });
});
