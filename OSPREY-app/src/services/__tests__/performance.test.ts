import {
  buildRacePredictor,
  buildTriathlonPredictor,
  computeAcwrTrend,
  computeAtlCtlTsb,
  computeInjuryRisk,
  formatRaceTimeSec,
  readinessFromTsb,
  riegelPredict,
  type DailyLoad,
} from '@/services/performance';

// performance.ts imports the supabase client at module level for its fetch
// helpers; the pure math under test never touches it.
jest.mock('@/services/supabase', () => ({ supabase: {} }));

function days(tssValues: number[]): DailyLoad[] {
  const start = new Date('2026-01-01T00:00:00Z');
  return tssValues.map((tss, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    // eslint-disable-next-line no-restricted-syntax -- mirrors performance.ts's intentional UTC day keying
    return { date: d.toISOString().slice(0, 10), tss };
  });
}

describe('computeAtlCtlTsb', () => {
  it('returns [] for no loads', () => {
    expect(computeAtlCtlTsb([])).toEqual([]);
  });

  it('matches the closed-form EWA on day one (atl = tss/7, ctl = tss/42)', () => {
    const [first] = computeAtlCtlTsb(days([70]));
    expect(first.atl).toBeCloseTo(10, 5);
    expect(first.ctl).toBeCloseTo(70 / 42, 1);
    expect(first.tsb).toBeCloseTo(first.ctl - first.atl, 1);
  });

  it('reports tsb = ctl - atl on every day (within rounding)', () => {
    const series = computeAtlCtlTsb(days([50, 80, 0, 120, 60, 0, 90, 40]));
    for (const day of series) {
      // atl, ctl, and tsb are each rounded to one decimal independently,
      // so the identity can drift by up to 0.1 (plus float epsilon).
      expect(Math.abs(day.tsb - (day.ctl - day.atl))).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('has atl converge toward a constant load faster than ctl (negative tsb while building)', () => {
    const series = computeAtlCtlTsb(days(Array(42).fill(100)));
    const last = series[series.length - 1];
    // After 42 days at TSS 100: atl ≈ 100 * (1 - (6/7)^42), ctl ≈ 100 * (1 - (41/42)^42)
    expect(last.atl).toBeCloseTo(100 * (1 - (6 / 7) ** 42), 0);
    expect(last.ctl).toBeCloseTo(100 * (1 - (41 / 42) ** 42), 0);
    expect(last.atl).toBeGreaterThan(last.ctl);
    expect(last.tsb).toBeLessThan(0);
  });
});

describe('computeInjuryRisk', () => {
  it('guards against insufficient history (chronic avg < 5)', () => {
    const risk = computeInjuryRisk(days([0, 0, 0, 2, 0]));
    expect(risk.level).toBe('undertrained');
    expect(risk.acwr).toBe(0);
  });

  it('reports low risk for steady load (ACWR = 1.0)', () => {
    const risk = computeInjuryRisk(days(Array(28).fill(50)));
    expect(risk.level).toBe('low');
    expect(risk.acwr).toBeCloseTo(1.0, 5);
  });

  it('reports high risk for a big acute spike (ACWR > 1.5)', () => {
    // 21 days at 50, last 7 at 100 → acute 100, chronic 62.5 → ACWR 1.6
    const risk = computeInjuryRisk(days([...Array(21).fill(50), ...Array(7).fill(100)]));
    expect(risk.level).toBe('high');
    expect(risk.acwr).toBeCloseTo(1.6, 5);
  });

  it('reports moderate risk between 1.3 and 1.5', () => {
    // 21 days at 50, last 7 at 80 → acute 80, chronic 57.5 → ACWR ≈ 1.39
    const risk = computeInjuryRisk(days([...Array(21).fill(50), ...Array(7).fill(80)]));
    expect(risk.level).toBe('moderate');
  });

  it('reports undertrained when acute load dips well below chronic baseline', () => {
    // 21 days at 50, last 7 at 10 → ACWR 0.25 with chronic avg 40
    const risk = computeInjuryRisk(days([...Array(21).fill(50), ...Array(7).fill(10)]));
    expect(risk.level).toBe('undertrained');
    expect(risk.acwr).toBeLessThan(0.8);
  });
});

describe('computeAcwrTrend', () => {
  it('is stable with fewer than 4 days of history', () => {
    expect(computeAcwrTrend(days([50, 50, 50]))).toEqual({
      direction: 'stable',
      daysToHighRisk: null,
    });
  });

  it('is stable (no-op) when there is not enough training history for an ACWR', () => {
    expect(computeAcwrTrend(days(Array(10).fill(0)))).toEqual({
      direction: 'stable',
      daysToHighRisk: null,
    });
  });

  it('is stable under constant load', () => {
    const trend = computeAcwrTrend(days(Array(30).fill(50)));
    expect(trend.direction).toBe('stable');
    expect(trend.daysToHighRisk).toBeNull();
  });

  it('detects a climbing trend and projects days to the 1.3 threshold', () => {
    const trend = computeAcwrTrend(days([...Array(28).fill(40), 80, 100, 120, 140]));
    expect(trend.direction).toBe('climbing');
    expect(trend.daysToHighRisk).not.toBeNull();
    expect(trend.daysToHighRisk!).toBeGreaterThanOrEqual(0);
  });

  it('projects 0 days when already past the moderate threshold', () => {
    // Sustained heavy ramp: latest ACWR is already ≥ 1.3 while still climbing.
    const trend = computeAcwrTrend(days([...Array(24).fill(30), 90, 110, 130, 150, 170, 190, 210, 230]));
    expect(trend.direction).toBe('climbing');
    expect(trend.daysToHighRisk).toBe(0);
  });

  it('detects a falling trend during a taper', () => {
    const trend = computeAcwrTrend(days([...Array(28).fill(80), 60, 40, 20, 10]));
    expect(trend.direction).toBe('falling');
    expect(trend.daysToHighRisk).toBeNull();
  });
});

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
    expect(buildRacePredictor([], 0.8, 600)).toBeNull();
    expect(buildRacePredictor([], 5, 0)).toBeNull();
  });

  it('drops race distances shorter than half the base effort', () => {
    const predictor = buildRacePredictor([], 10, 5400);
    expect(predictor).not.toBeNull();
    const labels = predictor!.predictions.map((p) => p.label);
    expect(labels).not.toContain('5K'); // 3.107 < 10 * 0.5
    expect(labels).toEqual(['10K', 'Half', 'Marathon']);
  });

  it('computes base pace and rounded predictions', () => {
    const predictor = buildRacePredictor([], 3.107, 1200)!;
    expect(predictor.basePaceSecPerMile).toBeCloseTo(1200 / 3.107, 5);
    const tenK = predictor.predictions.find((p) => p.label === '10K')!;
    expect(tenK.predictedTimeS).toBe(Math.round(riegelPredict(3.107, 1200, 6.214)));
  });
});

describe('buildTriathlonPredictor', () => {
  it('never invents a split for a leg with no recorded effort', () => {
    const predictor = buildTriathlonPredictor('sprint', null, null, null);
    expect(predictor.splits.every((s) => s.predictedTimeS === null)).toBe(true);
    expect(predictor.totalTimeS).toBeNull();
  });

  it('leaves total null until every leg has data', () => {
    const predictor = buildTriathlonPredictor(
      'sprint',
      { miles: 0.5, timeS: 900 },
      { miles: 15, timeS: 2700 },
      null,
    );
    expect(predictor.splits.filter((s) => s.predictedTimeS != null)).toHaveLength(2);
    expect(predictor.totalTimeS).toBeNull();
  });

  it('totals all splits plus the transition estimate when every leg has data', () => {
    const predictor = buildTriathlonPredictor(
      'sprint',
      { miles: 0.466, timeS: 900 },
      { miles: 12.4, timeS: 2400 },
      { miles: 3.107, timeS: 1500 },
    );
    const splitSum = predictor.splits.reduce((s, leg) => s + (leg.predictedTimeS ?? 0), 0);
    expect(predictor.totalTimeS).toBe(splitSum + predictor.transitionEstimateS);
    // Bests match the target distances exactly, so splits equal the recorded times.
    expect(predictor.splits.map((s) => s.predictedTimeS)).toEqual([900, 2400, 1500]);
  });
});

describe('readinessFromTsb', () => {
  it.each([
    [20, 'Peak Fresh'],
    [10, 'Fresh'],
    [0, 'Ready'],
    [-10, 'Carrying Load'],
    [-20, 'Fatigued'],
    [-30, 'Overreached'],
  ])('labels tsb %d as %s', (tsb, label) => {
    expect(readinessFromTsb(tsb, 50).label).toBe(label);
  });
});

describe('formatRaceTimeSec', () => {
  it('formats hours when present', () => {
    expect(formatRaceTimeSec(3661)).toBe('1:01:01');
  });

  it('formats minutes:seconds under an hour', () => {
    expect(formatRaceTimeSec(125)).toBe('2:05');
  });
});
