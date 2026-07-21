import { sessionPaceBand } from '../session-pace';
import type { ZoneSet } from '@/services/coaching/zones';

const runZones = {
  kind: 'run',
  thresholdSecPerMile: 420,
  bands: { easy: { min: 540, max: 600 } },
} as unknown as ZoneSet;

const swimZones = {
  kind: 'swim',
  cssSecPer100: 94,
  bands: { z2Aerobic: { min: 100, max: 106 }, z3Threshold: { min: 92, max: 96 } },
} as unknown as ZoneSet;

describe('sessionPaceBand', () => {
  it('gives an easy session its easy band', () => {
    expect(sessionPaceBand('easy', runZones, 'imperial')).toBe('9:00–10:00/mi');
  });

  it('gives a threshold session its threshold anchor', () => {
    expect(sessionPaceBand('threshold', runZones, 'imperial')).toBe('~7:00/mi');
  });

  it('converts to metric when the athlete prefers km', () => {
    expect(sessionPaceBand('threshold', runZones, 'metric')).toBe('~4:21/km');
  });

  it('uses per-100 formatting for a swimmer', () => {
    expect(sessionPaceBand('easy', swimZones, 'metric')).toBe('1:40–1:46/100m');
  });

  // Never invent a number: moderate/interval/race have no single clean band in
  // the ZoneSet, and no zones at all means nothing to show.
  it('returns null for intensities with no clean band', () => {
    expect(sessionPaceBand('interval', runZones, 'imperial')).toBeNull();
    expect(sessionPaceBand('moderate', runZones, 'imperial')).toBeNull();
  });

  it('returns null when there are no zones', () => {
    expect(sessionPaceBand('easy', null, 'imperial')).toBeNull();
  });

  it('returns null for a missing intensity', () => {
    expect(sessionPaceBand(null, runZones, 'imperial')).toBeNull();
    expect(sessionPaceBand(undefined, runZones, 'imperial')).toBeNull();
  });
});
