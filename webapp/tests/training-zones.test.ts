import { describe, it, expect } from 'vitest';
import { swimPaceZones, runningPaceZones, rowingTrainingZones, computeCSSPer100, cyclingPowerZones } from '../src/lib/training-zones';

describe('swimPaceZones', () => {
  it('offsets bands from CSS', () => {
    const z = swimPaceZones(95);
    expect(z.z3Threshold).toEqual({ min: 93, max: 97 });
    expect(z.z2Aerobic).toEqual({ min: 98, max: 101 });
    expect(z.z1EasyRecovery).toEqual({ min: 103, max: null });
  });
  it('computeCSSPer100 = (400 − 200) / 2', () => {
    expect(computeCSSPer100(360, 170)).toBe(95);
  });
});

describe('runningPaceZones', () => {
  it('offsets bands from threshold sec/mile', () => {
    const z = runningPaceZones(443);
    expect(z.easy).toEqual({ min: 503, max: 563 });
    expect(z.tenKPace).toEqual({ min: 428, max: 438 });
    expect(z.fiveKPace).toEqual({ min: 413, max: 423 });
  });
});

describe('rowingTrainingZones', () => {
  it('offsets bands from 2k split', () => {
    const z = rowingTrainingZones(108);
    expect(z.ut2.splitSecPer500).toEqual({ min: 120, max: 124 });
    expect(z.at.splitSecPer500).toEqual({ min: 111, max: 113 });
    expect(z.an.splitSecPer500).toEqual({ min: null, max: 108 });
  });
});

describe('cyclingPowerZones', () => {
  it('derives power bands from FTP (pct(56)=134, pct(75)=180, pct(91)=218, pct(105)=252)', () => {
    const z = cyclingPowerZones(240);
    expect(z.z2Endurance).toEqual({ min: 134, max: 180 });
    expect(z.z4Threshold).toEqual({ min: 218, max: 252 });
  });
});
