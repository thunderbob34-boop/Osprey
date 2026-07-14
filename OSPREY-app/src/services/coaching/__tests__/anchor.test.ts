import { estimateSwimCssByTier, resolveRunningAnchor, selectBestRunEffort } from '@/services/coaching/anchor';

describe('estimateSwimCssByTier', () => {
  it('gives a realistic CSS per 100m and ranks advanced faster than beginner', () => {
    const adv = estimateSwimCssByTier('advanced');
    const beg = estimateSwimCssByTier('beginner');
    expect(adv).toBeGreaterThan(60);   // faster than 1:00/100m is implausible for these tiers
    expect(beg).toBeLessThan(180);
    expect(adv).toBeLessThan(beg);
  });
});

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

describe('selectBestRunEffort', () => {
  it('picks the best-QUALITY effort, not the longest run', () => {
    const runs = [
      { distanceMiles: 13, timeS: 6300 }, // 13 mi @ ~8:04/mi — longest, but a slow long run
      { distanceMiles: 3.107, timeS: 1200 }, // 5K @ ~6:26/mi — the real fitness signal
      { distanceMiles: 5, timeS: 2400 }, // 5 mi @ 8:00/mi — easy
    ];
    // The longest-run heuristic would return the 13-miler and derive a slow threshold;
    // best-effort must return the fast 5K.
    expect(selectBestRunEffort(runs)).toEqual({ distanceMiles: 3.107, timeS: 1200 });
  });

  it('ignores too-short or invalid efforts', () => {
    const runs = [
      { distanceMiles: 0.5, timeS: 120 }, // < 1 mi — noise
      { distanceMiles: 4, timeS: 0 }, // no time
      { distanceMiles: 6.2, timeS: 2700 }, // 10K @ ~7:15/mi — valid
    ];
    expect(selectBestRunEffort(runs)).toEqual({ distanceMiles: 6.2, timeS: 2700 });
  });

  it('returns null when there is no valid effort', () => {
    expect(selectBestRunEffort([])).toBeNull();
    expect(selectBestRunEffort([{ distanceMiles: 0.3, timeS: 90 }])).toBeNull();
  });
});
