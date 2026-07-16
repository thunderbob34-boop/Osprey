import { describe, it, expect } from 'vitest';
import { parseCrossfitParams, mergeGoalParams, validKg, validFranSec } from '../src/lib/goal-params';

describe('goal-params', () => {
  it('parseCrossfitParams keeps valid, drops out-of-range', () => {
    const p = parseCrossfitParams({ oneRepMaxKg: { backSquat: 140, deadlift: 999, press: null }, competing: true, franSec: 252 });
    expect(p).toEqual({ oneRepMaxKg: { backSquat: 140, deadlift: null, press: null }, competing: true, franSec: 252 });
  });
  it('mergeGoalParams preserves sibling keys the mobile app owns', () => {
    const current = { oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 70 }, competing: true, franSec: 252 };
    const merged = mergeGoalParams(current, { oneRepMaxKg: { backSquat: 145 } });
    expect(merged).toEqual({ oneRepMaxKg: { backSquat: 145, deadlift: 180, press: 70 }, competing: true, franSec: 252 });
  });
  it('validators enforce bounds', () => {
    expect(validKg(140)).toBe(true); expect(validKg(0)).toBe(false); expect(validKg(601)).toBe(false);
    expect(validFranSec(252)).toBe(true); expect(validFranSec(3601)).toBe(false);
  });
});
