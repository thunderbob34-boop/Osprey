import { describe, it, expect } from 'vitest';
import { raceRunwayLabel } from '../src/lib/race-runway';

describe('raceRunwayLabel', () => {
  it('flags race week at 1 week or fewer out', () => {
    expect(raceRunwayLabel(0)).toBe("Race week — trust the work you've put in.");
    expect(raceRunwayLabel(1)).toBe("Race week — trust the work you've put in.");
  });
  it('flags a peak window for 2-4 weeks out', () => {
    expect(raceRunwayLabel(2)).toBe('Peak block window — sharpen up with race-specific work.');
    expect(raceRunwayLabel(4)).toBe('Peak block window — sharpen up with race-specific work.');
  });
  it('flags a focused build for 5-11 weeks out', () => {
    expect(raceRunwayLabel(5)).toBe('Time for a focused build — base phase should be behind you.');
    expect(raceRunwayLabel(11)).toBe('Time for a focused build — base phase should be behind you.');
  });
  it('flags a full build for 12-20 weeks out, matching the reported 17-week case', () => {
    expect(raceRunwayLabel(12)).toBe('Full build fits, with room for a base block first.');
    expect(raceRunwayLabel(17)).toBe('Full build fits, with room for a base block first.');
    expect(raceRunwayLabel(20)).toBe('Full build fits, with room for a base block first.');
  });
  it('flags plenty of runway beyond 20 weeks out', () => {
    expect(raceRunwayLabel(21)).toBe('Plenty of runway — no need to rush into hard training yet.');
    expect(raceRunwayLabel(52)).toBe('Plenty of runway — no need to rush into hard training yet.');
  });
});
