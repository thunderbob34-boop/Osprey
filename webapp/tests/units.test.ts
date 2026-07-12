import { describe, it, expect } from 'vitest';
import { kgToLb, lbToKg, formatWeightKg, parseWeightInput } from '../src/lib/units';

describe('units', () => {
  it('kgToLb matches app rounding (1 decimal)', () => {
    expect(kgToLb(100)).toBe(220.5);
    expect(kgToLb(83.9)).toBe(185);
  });
  it('lbToKg matches app rounding (2 decimals)', () => {
    expect(lbToKg(185)).toBe(83.91);
    expect(lbToKg(225)).toBe(102.06);
  });
  it('round-trips within rounding tolerance', () => {
    expect(Math.abs(kgToLb(lbToKg(185)) - 185)).toBeLessThanOrEqual(0.1);
  });
  it('formats per unit system', () => {
    expect(formatWeightKg(83.91, 'imperial')).toBe('185 lbs');
    expect(formatWeightKg(83.91, 'metric')).toBe('83.9 kg');
  });
  it('parseWeightInput converts imperial text to kg', () => {
    expect(parseWeightInput('185', 'imperial')).toBe(83.91);
    expect(parseWeightInput('100', 'metric')).toBe(100);
    expect(parseWeightInput('abc', 'imperial')).toBeNull();
    expect(parseWeightInput('-5', 'metric')).toBeNull();
    expect(parseWeightInput('', 'imperial')).toBeNull();
  });
});
