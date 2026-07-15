import { computeFuel } from '@/services/coaching/fuel';
import { dailyCarbGrams } from '@/services/calculators/shared';

describe('computeFuel', () => {
  it('returns the carb ladder by day-type for the given body weight', () => {
    const f = computeFuel('run', 70);
    expect(f.dailyCarbGByDayType.easy).toEqual(dailyCarbGrams('easy', 70));
    expect(f.dailyCarbGByDayType.high).toEqual(dailyCarbGrams('high', 70));
    expect(f.dailyCarbGByDayType.peak).toEqual(dailyCarbGrams('peak', 70));
  });
  it('sets a positive per-sport in-session carb rate + a sane protein range', () => {
    const f = computeFuel('cycling', 70);
    expect(f.longSessionCarbGPerHour).toBeGreaterThan(0);
    expect(f.proteinG.min).toBe(Math.round(70 * 1.6));
    expect(f.proteinG.max).toBe(Math.round(70 * 2.2));
  });
  it('routes each sport to its own in-session carb rate (swim differs from the running default)', () => {
    const swim = computeFuel('swim', 70).longSessionCarbGPerHour;
    const run = computeFuel('run', 70).longSessionCarbGPerHour;
    expect(swim).toBeGreaterThan(0);
    expect(swim).not.toBe(run); // swim dispatch is distinct; a dropped branch would collapse it to the run default
  });
  it('gives ultra its own in-session carb rate, higher when gut-trained', () => {
    const untrained = computeFuel('ultra', 70, false).longSessionCarbGPerHour;
    const trained = computeFuel('ultra', 70, true).longSessionCarbGPerHour;
    expect(untrained).toBe(75);  // midpoint {60,90}
    expect(trained).toBe(90);    // midpoint {60,120}
  });
  it('ignores gutTrained for non-ultra sports (regression)', () => {
    expect(computeFuel('run', 70, true).longSessionCarbGPerHour).toBe(computeFuel('run', 70).longSessionCarbGPerHour);
  });
  it('gives a lifter powerlifting carbs (4-7 g/kg) + no in-session rate', () => {
    const f = computeFuel('lift', 90);
    expect(f.longSessionCarbGPerHour).toBe(0);
    expect(f.dailyCarbGByDayType.easy.min).toBe(Math.round(4 * 90)); // low end of 4-7 g/kg
    expect(f.dailyCarbGByDayType.peak.max).toBe(Math.round(7 * 90)); // high end
    expect(f.proteinG.min).toBe(Math.round(90 * 1.6));
  });
  it('leaves non-lift fuel unchanged (regression)', () => {
    expect(computeFuel('run', 70).longSessionCarbGPerHour).toBe(75); // marathon default
  });
});
