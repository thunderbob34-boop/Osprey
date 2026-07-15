import { describe, it, expect } from 'vitest';
import { parseSwimBaseline, parseRowingBaseline, parseRunBaseline, parseFTPBaseline } from '../src/lib/baseline';

describe('parseSwimBaseline', () => {
  it('computes CSS for valid times', () => {
    expect(parseSwimBaseline(360, 170)).toEqual({ ok: true, value: 95 });
  });
  it('rejects 400 ≤ 200 (would give ≤0 CSS)', () => {
    expect(parseSwimBaseline(170, 360).ok).toBe(false);
  });
});

describe('parseRowingBaseline', () => {
  it('splits 2k time by 4', () => {
    expect(parseRowingBaseline(480)).toEqual({ ok: true, value: 120 });
  });
  it('rejects implausible', () => {
    expect(parseRowingBaseline(30).ok).toBe(false);
  });
});

describe('parseRunBaseline', () => {
  it('derives a plausible threshold', () => {
    const r = parseRunBaseline(6.2, 3000);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value).toBeGreaterThan(240); expect(r.value).toBeLessThan(900); }
  });
  it('rejects non-positive', () => {
    expect(parseRunBaseline(0, 3000).ok).toBe(false);
  });
});

describe('parseFTPBaseline', () => {
  it('accepts a valid FTP', () => {
    expect(parseFTPBaseline(240)).toEqual({ ok: true, value: 240 });
  });
  it('rejects implausible values', () => {
    expect(parseFTPBaseline(0).ok).toBe(false);
    expect(parseFTPBaseline(49).ok).toBe(false);
    expect(parseFTPBaseline(601).ok).toBe(false);
  });
});
