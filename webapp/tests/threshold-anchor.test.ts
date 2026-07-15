import { describe, it, expect } from 'vitest';
import { parseThresholdAnchor, setAnchorEntry, clearAnchorEntry } from '../src/lib/threshold-anchor';

describe('parseThresholdAnchor', () => {
  it('accepts a valid map', () => {
    const m = { swim: { cssSecPer100: 95, source: 'self_report' } };
    expect(parseThresholdAnchor(m)).toEqual(m);
  });
  it('returns {} for malformed input (does not throw or pass NaN through)', () => {
    expect(parseThresholdAnchor({ swim: { cssSecPer100: 'abc' } })).toEqual({});
    expect(parseThresholdAnchor(null)).toEqual({});
    expect(parseThresholdAnchor('garbage')).toEqual({});
  });
  it('accepts a bike entry and round-trips it', () => {
    const m = { bike: { ftpWatts: 240, source: 'self_report' } };
    expect(parseThresholdAnchor(m)).toEqual(m);
  });
});

describe('setAnchorEntry / clearAnchorEntry preserve other sports', () => {
  it('sets one sport without touching others', () => {
    const cur = { run: { thresholdSecPerMile: 443, source: 'self_report' as const } };
    const next = setAnchorEntry(cur, 'swim', { cssSecPer100: 95, source: 'self_report' });
    expect(next).toEqual({
      run: { thresholdSecPerMile: 443, source: 'self_report' },
      swim: { cssSecPer100: 95, source: 'self_report' },
    });
  });
  it('clears one sport, keeps the rest', () => {
    const cur = {
      run: { thresholdSecPerMile: 443, source: 'self_report' as const },
      swim: { cssSecPer100: 95, source: 'self_report' as const },
    };
    expect(clearAnchorEntry(cur, 'swim')).toEqual({ run: { thresholdSecPerMile: 443, source: 'self_report' } });
  });
  it('sets bike without touching other sports', () => {
    const cur = { run: { thresholdSecPerMile: 443, source: 'self_report' as const } };
    const next = setAnchorEntry(cur, 'bike', { ftpWatts: 240, source: 'self_report' });
    expect(next).toEqual({
      run: { thresholdSecPerMile: 443, source: 'self_report' },
      bike: { ftpWatts: 240, source: 'self_report' },
    });
  });
});
