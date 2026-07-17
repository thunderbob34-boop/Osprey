import { describe, it, expect } from 'vitest';
import { computeRacePhase, phaseOrBase } from '../src/lib/race-phase';

const NOW = new Date('2026-03-01T12:00:00-05:00'); // fixed clock

describe('computeRacePhase', () => {
  it('returns null when undated or no total weeks', () => {
    expect(computeRacePhase({ targetRace: 'Marathon', targetDate: null, totalWeeksPlanned: 16 }, NOW)).toBeNull();
    expect(computeRacePhase({ targetRace: 'Marathon', targetDate: '2026-06-01', totalWeeksPlanned: null }, NOW)).toBeNull();
  });
  it('splits a 16-week plan Base/Build/Peak/Taper', () => {
    // week 1 of 16 (race ~16 weeks out) → Base
    expect(computeRacePhase({ targetRace: 'M', targetDate: '2026-06-21', totalWeeksPlanned: 16 }, NOW)!.phase).toBe('Base');
    // final 3 weeks → Taper
    expect(computeRacePhase({ targetRace: 'M', targetDate: '2026-03-15', totalWeeksPlanned: 16 }, NOW)!.phase).toBe('Taper');
  });
  it('phaseOrBase falls back to Base when undated', () => {
    expect(phaseOrBase({ targetRace: null, targetDate: null, totalWeeksPlanned: null }, NOW)).toBe('Base');
  });
});
