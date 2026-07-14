import {
  parseSwimBaseline,
  parseRowingBaseline,
  parseRunBaseline,
  anchorKeyForGoal,
  toSelfReportAnchor,
} from '@/services/coaching/baseline';

describe('parseSwimBaseline', () => {
  it('computes CSS = (400 − 200) / 2 for valid times', () => {
    // 400m in 6:00 (360s), 200m in 2:50 (170s) → CSS = (360-170)/2 = 95 s/100m
    expect(parseSwimBaseline(360, 170)).toEqual({ ok: true, value: 95 });
  });
  it('rejects when the 400 time is not greater than the 200 time (CSS would be ≤ 0)', () => {
    const r = parseSwimBaseline(170, 360);
    expect(r.ok).toBe(false);
  });
  it('rejects non-positive input', () => {
    expect(parseSwimBaseline(0, 0).ok).toBe(false);
  });
});

describe('parseRowingBaseline', () => {
  it('splits a 2k time into sec/500m (time / 4)', () => {
    // 2k in 8:00 (480s) → 120 s/500m
    expect(parseRowingBaseline(480)).toEqual({ ok: true, value: 120 });
  });
  it('rejects an implausible 2k time', () => {
    expect(parseRowingBaseline(30).ok).toBe(false);   // 30s 2k is impossible
    expect(parseRowingBaseline(0).ok).toBe(false);
  });
});

describe('parseRunBaseline', () => {
  it('derives a plausible threshold sec/mile from a recent run', () => {
    // ~6.2 mi (10K) in 50:00 (3000s) → threshold in a sane 4:00–15:00/mi band
    const r = parseRunBaseline(6.2, 3000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeGreaterThan(240);
      expect(r.value).toBeLessThan(900);
    }
  });
  it('rejects non-positive input', () => {
    expect(parseRunBaseline(0, 3000).ok).toBe(false);
    expect(parseRunBaseline(6.2, 0).ok).toBe(false);
  });
});

describe('anchorKeyForGoal', () => {
  it('maps sports to their stored anchor key', () => {
    expect(anchorKeyForGoal('swim')).toBe('swim');
    expect(anchorKeyForGoal('rowing')).toBe('row');
    expect(anchorKeyForGoal('run')).toBe('run');
    expect(anchorKeyForGoal('hyrox')).toBe('run');
    expect(anchorKeyForGoal('hybrid')).toBe('run');
  });
  it('returns null for non-endurance goals (no baseline to collect)', () => {
    expect(anchorKeyForGoal('lift')).toBeNull();
    expect(anchorKeyForGoal('weight_loss')).toBeNull();
    expect(anchorKeyForGoal('general_fitness')).toBeNull();
  });
});

describe('toSelfReportAnchor', () => {
  it('flattens the stored per-sport map to the flat envelope input', () => {
    expect(toSelfReportAnchor({ swim: { cssSecPer100: 95, source: 'self_report' } })).toEqual({
      thresholdSecPerMile: null,
      cssSecPer100: 95,
      splitSecPer500: null,
    });
  });
  it('returns all-null for null/undefined', () => {
    expect(toSelfReportAnchor(null)).toEqual({
      thresholdSecPerMile: null,
      cssSecPer100: null,
      splitSecPer500: null,
    });
  });
});
