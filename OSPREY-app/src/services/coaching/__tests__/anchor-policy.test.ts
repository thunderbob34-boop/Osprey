import { confidenceFromEffort, anchorPolicy, widenRaceRange } from '@/services/coaching/anchor-policy';

describe('confidenceFromEffort', () => {
  it('is high for a long effort (≥40min) with plenty of corroboration (≥5 efforts)', () => {
    expect(confidenceFromEffort(45 * 60, 6)).toBe('high');
  });
  it('is moderate for a mid-length effort (≥20min) with some corroboration (≥3 efforts)', () => {
    expect(confidenceFromEffort(25 * 60, 3)).toBe('moderate');
  });
  it('is low for a short effort even with plenty of corroboration', () => {
    // 10min extrapolated to a 60min construct is a 6x extrapolation regardless
    // of how many short efforts back it up.
    expect(confidenceFromEffort(10 * 60, 10)).toBe('low');
  });
  it('is low for a long effort with too little corroboration', () => {
    expect(confidenceFromEffort(45 * 60, 2)).toBe('low');
  });
});

describe('anchorPolicy', () => {
  it('low confidence re-anchors sooner than the standard cadence', () => {
    expect(anchorPolicy('low').reanchorIntervalDays).toBeLessThan(anchorPolicy('high').reanchorIntervalDays);
    expect(anchorPolicy('low').reanchorIntervalDays).toBeLessThan(anchorPolicy('moderate').reanchorIntervalDays);
  });

  it('low confidence widens the displayed race-time range vs high', () => {
    expect(anchorPolicy('low').raceRangePct).toBeGreaterThan(anchorPolicy('high').raceRangePct);
  });

  it('only low confidence marks the anchor provisional and caps hard-work share', () => {
    expect(anchorPolicy('low').provisional).toBe(true);
    expect(anchorPolicy('low').hardShareMultiplier).toBeLessThan(1);
    expect(anchorPolicy('moderate').provisional).toBe(false);
    expect(anchorPolicy('moderate').hardShareMultiplier).toBe(1);
    expect(anchorPolicy('high').provisional).toBe(false);
    expect(anchorPolicy('high').hardShareMultiplier).toBe(1);
  });
});

describe('widenRaceRange', () => {
  it('produces a wider range for low confidence than high confidence around the same prediction', () => {
    const low = widenRaceRange(3600, 'low');
    const high = widenRaceRange(3600, 'high');
    expect(high.highS - high.lowS).toBeLessThan(low.highS - low.lowS);
    expect(low.lowS).toBeLessThan(high.lowS);
    expect(low.highS).toBeGreaterThan(high.highS);
  });
});
