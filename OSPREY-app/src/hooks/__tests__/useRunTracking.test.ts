import {
  GPS_NOISE_THRESHOLD_M,
  haversineMeters,
  processLocationFix,
  type GpsAnchor,
} from '@/hooks/useRunTracking';

// Degrees of latitude per meter (1° latitude ≈ 111,320 m everywhere).
const DEG_PER_METER = 1 / 111_320;

describe('haversineMeters', () => {
  it('measures one degree of latitude as ~111.2 km', () => {
    expect(haversineMeters(0, 0, 1, 0)).toBeCloseTo(111_195, -3);
  });

  it('returns 0 for identical points', () => {
    expect(haversineMeters(45.5, -122.6, 45.5, -122.6)).toBe(0);
  });
});

describe('processLocationFix', () => {
  it('sets the anchor on the first fix without counting distance', () => {
    const result = processLocationFix(null, 45.0, -122.0);
    expect(result.acceptedDelta).toBe(0);
    expect(result.anchor).toEqual({ lat: 45.0, lon: -122.0 });
  });

  it('rejects sub-threshold jitter and keeps the anchor in place', () => {
    const anchor: GpsAnchor = { lat: 0, lon: 0 };
    const result = processLocationFix(anchor, 0.4 * DEG_PER_METER, 0);
    expect(result.acceptedDelta).toBe(0);
    expect(result.anchor).toBe(anchor); // same reference — anchor did not move
  });

  it('accepts a fix at or beyond the threshold and advances the anchor', () => {
    const anchor: GpsAnchor = { lat: 0, lon: 0 };
    const lat = 1.5 * DEG_PER_METER;
    const result = processLocationFix(anchor, lat, 0);
    expect(result.acceptedDelta).toBeGreaterThanOrEqual(GPS_NOISE_THRESHOLD_M);
    expect(result.acceptedDelta).toBeCloseTo(1.5, 1);
    expect(result.anchor).toEqual({ lat, lon: 0 });
  });

  it('counts slow steady movement made of sub-meter steps (audit regression)', () => {
    // The 2026-07-02 audit bug: the anchor reset on every fix, so a walker
    // moving 0.5 m per fix never accumulated any distance at all. With a
    // stable anchor, cumulative displacement crosses the threshold on the
    // second fix and gets counted.
    let anchor: GpsAnchor | null = { lat: 0, lon: 0 };
    let total = 0;
    for (let step = 1; step <= 8; step++) {
      const lat = step * 0.6 * DEG_PER_METER; // +0.6 m per fix, walking north
      const result = processLocationFix(anchor, lat, 0);
      total += result.acceptedDelta;
      anchor = result.anchor;
    }
    // 8 fixes × 0.6 m = 4.8 m of real movement, accepted in ~1.2 m increments
    // every second fix. The old bug counted 0 here.
    expect(total).toBeCloseTo(4.8, 1);
  });

  it('never counts pure stationary noise as distance', () => {
    let anchor: GpsAnchor | null = { lat: 0, lon: 0 };
    let total = 0;
    // Oscillate ±0.45 m around the anchor — a phone sitting on a park bench.
    for (let i = 0; i < 20; i++) {
      const jitter = (i % 2 === 0 ? 0.45 : -0.45) * DEG_PER_METER;
      const result = processLocationFix(anchor, jitter, 0);
      total += result.acceptedDelta;
      anchor = result.anchor;
    }
    expect(total).toBe(0);
  });
});
