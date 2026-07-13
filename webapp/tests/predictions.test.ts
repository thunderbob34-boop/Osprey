import { describe, it, expect } from 'vitest';
import { riegelPredict, buildRacePredictor, formatRaceTimeSec } from '../src/lib/predictions';

describe('riegelPredict', () => {
  it('scales time by (distance ratio)^1.06', () => {
    // 5K in 20:00 → 10K prediction: 1200 * 2^1.06 ≈ 2501.7s
    expect(riegelPredict(3.107, 1200, 6.214)).toBeCloseTo(1200 * 2 ** 1.06, 6);
  });

  it('returns the same time for the same distance', () => {
    expect(riegelPredict(5, 3000, 5)).toBeCloseTo(3000, 8);
  });
});

describe('buildRacePredictor', () => {
  it('returns null without a qualifying best effort', () => {
    expect(buildRacePredictor(0.8, 600)).toBeNull();
    expect(buildRacePredictor(5, 0)).toBeNull();
  });

  it('drops race distances shorter than half the base effort', () => {
    const predictor = buildRacePredictor(10, 5400);
    expect(predictor).not.toBeNull();
    const labels = predictor!.predictions.map((p) => p.label);
    expect(labels).not.toContain('5K'); // 3.107 < 10 * 0.5
    expect(labels).toEqual(['10K', 'Half', 'Marathon']);
  });

  it('computes base pace and rounded predictions', () => {
    const predictor = buildRacePredictor(3.107, 1200)!;
    expect(predictor.basePaceSecPerMile).toBeCloseTo(1200 / 3.107, 5);
    const tenK = predictor.predictions.find((p) => p.label === '10K')!;
    expect(tenK.predictedTimeS).toBe(Math.round(riegelPredict(3.107, 1200, 6.214)));
  });
});

describe('formatRaceTimeSec', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatRaceTimeSec(1200)).toBe('20:00');
  });
  it('formats an hour or more as h:mm:ss', () => {
    expect(formatRaceTimeSec(3725)).toBe('1:02:05');
  });
});
