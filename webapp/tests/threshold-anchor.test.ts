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

  // WS1: mobile's coaching/anchor.ts derives run/row anchors from HealthKit
  // history instead of only self-report. Both new source values, and the
  // optional confidence field that rides along with a 'derived' entry, must
  // round-trip — this is the schema mobile's setThresholdAnchor writes into.
  it("accepts a 'derived' source with a confidence field and round-trips it", () => {
    const m = { run: { thresholdSecPerMile: 480, source: 'derived', confidence: 'low' } };
    expect(parseThresholdAnchor(m)).toEqual(m);
  });

  it("accepts an 'estimate' source (no confidence field required)", () => {
    const m = { row: { splitSecPer500: 120, source: 'estimate' } };
    expect(parseThresholdAnchor(m)).toEqual(m);
  });

  // Guards the invariant WS1's baseline.ts explicitly relies on: a 4th source
  // value would make this schema fail closed and blank the athlete's ENTIRE
  // anchor map (every sport, not just the bad entry) — parseThresholdAnchor's
  // safeParse falls back to {} on any validation failure. A 'timetrial' kind
  // was considered and deliberately rejected for exactly this reason; this
  // test is what would catch someone reintroducing it.
  it('rejects an unrecognized source value and blanks the WHOLE map, not just the bad entry', () => {
    const m = {
      run: { thresholdSecPerMile: 480, source: 'timetrial' },
      swim: { cssSecPer100: 95, source: 'self_report' },
    };
    expect(parseThresholdAnchor(m)).toEqual({});
  });

  it('rejects an unrecognized confidence value the same way', () => {
    const m = { run: { thresholdSecPerMile: 480, source: 'derived', confidence: 'certain' } };
    expect(parseThresholdAnchor(m)).toEqual({});
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
