import { describe, it, expect } from 'vitest';
import { buildRunSignupSearchUrl } from '../src/lib/racesearch';

describe('buildRunSignupSearchUrl', () => {
  it('builds a URL with the confirmed RunSignup query params', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 10.0, centerDateISO: '2026-08-08' });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://runsignup.com/Races');
    expect(parsed.searchParams.get('zipcodeRadius')).toBe('28202');
    expect(parsed.searchParams.get('eventType')).toBe('running_race');
    expect(parsed.searchParams.get('country')).toBe('US');
    expect(parsed.searchParams.get('units')).toBe('K');
  });

  it('defaults the search radius to 25 miles', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 5.0, centerDateISO: '2026-08-08' });
    expect(new URL(url).searchParams.get('radius')).toBe('25');
  });

  it('allows overriding the search radius', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 5.0, centerDateISO: '2026-08-08', radiusMiles: 50 });
    expect(new URL(url).searchParams.get('radius')).toBe('50');
  });

  it('builds a +/-1km distance band around the ladder distance', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 5.0, centerDateISO: '2026-08-08' });
    const p = new URL(url).searchParams;
    expect(p.get('distance')).toBe('4.0');
    expect(p.get('max_distance')).toBe('6.0');
  });

  it('rounds a fractional ladder distance (Half) to one decimal for the band', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 21.0975, centerDateISO: '2026-08-08' });
    const p = new URL(url).searchParams;
    expect(p.get('distance')).toBe('20.1');
    expect(p.get('max_distance')).toBe('22.1');
  });

  it('centers the date window one day before and after, Saturday example', () => {
    // 2026-08-08 is a Saturday.
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 10.0, centerDateISO: '2026-08-08' });
    const p = new URL(url).searchParams;
    expect(p.get('start_date')).toBe('2026-08-07');
    expect(p.get('end_date')).toBe('2026-08-09');
  });

  it('handles a month boundary correctly', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 10.0, centerDateISO: '2026-08-01' });
    const p = new URL(url).searchParams;
    expect(p.get('start_date')).toBe('2026-07-31');
    expect(p.get('end_date')).toBe('2026-08-02');
  });
});
