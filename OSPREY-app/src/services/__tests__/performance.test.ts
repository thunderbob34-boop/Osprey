import {
  computeAtlCtlTsb,
  computeInjuryRisk,
  computeAcwrTrend,
  riegelPredict,
  buildRacePredictor,
  type DailyLoad,
} from '@/services/performance';

// Hoisted above the import above by babel-plugin-jest-hoist, so the real
// supabase client (which throws without env vars configured) is never
// constructed when this module is required.
jest.mock('@/services/supabase', () => ({ supabase: {} }));

function mkLoads(tssValues: number[]): DailyLoad[] {
  return tssValues.map((tss, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    tss,
  }));
}

describe('computeAtlCtlTsb', () => {
  it('returns an empty series for no data', () => {
    expect(computeAtlCtlTsb([])).toEqual([]);
  });

  it('converges ATL and CTL toward a constant daily TSS', () => {
    const loads = mkLoads(new Array(100).fill(60));
    const series = computeAtlCtlTsb(loads);

    expect(series).toHaveLength(100);

    const last = series[series.length - 1];
    // ATL (7-day time constant) converges essentially fully after 100 days.
    expect(last.atl).toBeCloseTo(60, 1);
    // CTL (42-day time constant) converges more slowly but should be closing in.
    expect(last.ctl).toBeGreaterThan(50);
    expect(last.ctl).toBeLessThan(60);
    // With a constant load, ATL has caught up faster than CTL, so TSB is negative.
    expect(last.tsb).toBeLessThan(0);
  });

  it('accumulates atl/ctl monotonically upward under a constant positive load', () => {
    const loads = mkLoads(new Array(10).fill(50));
    const series = computeAtlCtlTsb(loads);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].atl).toBeGreaterThanOrEqual(series[i - 1].atl);
      expect(series[i].ctl).toBeGreaterThanOrEqual(series[i - 1].ctl);
    }
  });

  it('matches the exponentially-weighted-average formula for the first day', () => {
    const loads = mkLoads([70]);
    const [first] = computeAtlCtlTsb(loads);
    // atl = 0 + (70 - 0) / 7 = 10; ctl = 0 + (70 - 0) / 42 = 1.666...
    expect(first.atl).toBeCloseTo(10, 5);
    expect(first.ctl).toBeCloseTo(1.7, 1);
    expect(first.tsb).toBeCloseTo(first.ctl - first.atl, 5);
  });
});

describe('computeInjuryRisk', () => {
  it('flags undertrained when there is not enough recent load', () => {
    const risk = computeInjuryRisk(mkLoads([0, 0, 0]));
    expect(risk.level).toBe('undertrained');
    expect(risk.acwr).toBe(0);
  });

  it('flags high risk on a sharp load spike (ACWR > 1.5)', () => {
    // 21 easy days followed by a week-long spike so the 7-day acute average
    // jumps well above the 28-day chronic average.
    const loads = mkLoads([...new Array(21).fill(40), ...new Array(7).fill(120)]);
    const risk = computeInjuryRisk(loads);
    expect(risk.level).toBe('high');
    expect(risk.acwr).toBeGreaterThan(1.5);
  });

  it('reports low risk when load is steady in the optimal zone', () => {
    const loads = mkLoads(new Array(28).fill(50));
    const risk = computeInjuryRisk(loads);
    expect(risk.level).toBe('low');
    expect(risk.acwr).toBeCloseTo(1, 5);
  });
});

describe('computeAcwrTrend', () => {
  it('reports stable with null daysToHighRisk when there is too little history', () => {
    const trend = computeAcwrTrend(mkLoads([10, 20, 30]));
    expect(trend).toEqual({ direction: 'stable', daysToHighRisk: null });
  });

  it('reports stable for a flat, unchanging load history', () => {
    const trend = computeAcwrTrend(mkLoads(new Array(28).fill(50)));
    expect(trend).toEqual({ direction: 'stable', daysToHighRisk: null });
  });

  it('detects a climbing trend ahead of a load spike', () => {
    const loads = mkLoads([...new Array(24).fill(50), 80, 120, 160, 200]);
    const trend = computeAcwrTrend(loads);
    expect(trend.direction).toBe('climbing');
    // Already at/over the moderate-risk threshold by the last day in this series.
    expect(trend.daysToHighRisk).toBe(0);
  });

  it('detects a falling trend when load is tapering down', () => {
    const loads = mkLoads([...new Array(24).fill(100), 80, 60, 40, 20]);
    const trend = computeAcwrTrend(loads);
    expect(trend).toEqual({ direction: 'falling', daysToHighRisk: null });
  });
});

describe('riegelPredict', () => {
  it('predicts a longer time for a longer distance using the Riegel exponent', () => {
    // 5K in 20:00 (1200s) -> 10K prediction should be more than double (fatigue factor)
    // but less than a naive linear 2x-would-suggest bound sanity check isn't right;
    // Riegel's exponent (1.06) makes the predicted time slightly MORE than double.
    const predicted10k = riegelPredict(3.107, 1200, 6.214);
    expect(predicted10k).toBeGreaterThan(2400); // more than exactly double
    expect(predicted10k).toBeCloseTo(1200 * Math.pow(2, 1.06), 5);
  });

  it('returns the same time when source and target distance are equal', () => {
    expect(riegelPredict(5, 1800, 5)).toBeCloseTo(1800, 5);
  });
});

describe('buildRacePredictor', () => {
  it('returns null for invalid inputs', () => {
    expect(buildRacePredictor(mkLoads([]), 0.5, 600)).toBeNull();
    expect(buildRacePredictor(mkLoads([]), 5, 0)).toBeNull();
  });

  it('builds predictions only for distances at least half the best-effort distance', () => {
    // Best effort: 6.214 miles (10K) in 2400s -> only distances >= 3.107 miles included.
    const predictor = buildRacePredictor(mkLoads([]), 6.214, 2400);
    expect(predictor).not.toBeNull();
    expect(predictor!.baseMiles).toBe(6.214);
    expect(predictor!.basePaceSecPerMile).toBeCloseTo(2400 / 6.214, 5);

    const labels = predictor!.predictions.map((p) => p.label);
    expect(labels).toEqual(['5K', '10K', 'Half', 'Marathon']);

    const tenK = predictor!.predictions.find((p) => p.label === '10K')!;
    expect(tenK.predictedTimeS).toBe(2400);
  });

  it('excludes distances shorter than half the best effort', () => {
    // Best effort is a marathon (26.219mi) -> 5K (3.107mi) is well under half, excluded.
    const predictor = buildRacePredictor(mkLoads([]), 26.219, 3600 * 4);
    expect(predictor).not.toBeNull();
    const labels = predictor!.predictions.map((p) => p.label);
    expect(labels).not.toContain('5K');
    expect(labels).toContain('Marathon');
  });
});
