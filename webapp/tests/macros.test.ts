import { describe, it, expect } from 'vitest';
import { macrosFor, sumIngredientMacros, perServing, scale, targetsProgress, round1 } from '../src/lib/macros';

describe('macros', () => {
  const oats = { quantityG: 320, per100g: { calories: 380, proteinG: 13.2, carbsG: 66, fatG: 6.9 } };
  const milk = { quantityG: 480, per100g: { calories: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3 } };

  it('macrosFor scales per-100g values by quantity', () => {
    expect(macrosFor(oats)).toEqual({ calories: 1216, proteinG: 42.2, carbsG: 211.2, fatG: 22.1 });
  });
  it('macrosFor treats null macro fields as 0', () => {
    expect(macrosFor({ quantityG: 200, per100g: { calories: 57, proteinG: null, carbsG: 14.5, fatG: null } }))
      .toEqual({ calories: 114, proteinG: 0, carbsG: 29, fatG: 0 });
  });
  it('sumIngredientMacros totals across ingredients', () => {
    const t = sumIngredientMacros([oats, milk]);
    expect(t.calories).toBe(1509); // 1216 + 293
    expect(t.proteinG).toBe(57.6); // 42.2 + 15.4
  });
  it('sumIngredientMacros of [] is zero', () => {
    expect(sumIngredientMacros([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
  it('perServing divides and rounds', () => {
    expect(perServing({ calories: 1745, proteinG: 58.1, carbsG: 296.1, fatG: 39.2 }, 4))
      .toEqual({ calories: 436, proteinG: 14.5, carbsG: 74, fatG: 9.8 });
  });
  it('perServing throws on servings <= 0', () => {
    expect(() => perServing({ calories: 1, proteinG: 0, carbsG: 0, fatG: 0 }, 0)).toThrow(RangeError);
  });
  it('scale multiplies (logging 2 servings)', () => {
    expect(scale({ calories: 436, proteinG: 14.5, carbsG: 74, fatG: 9.8 }, 2))
      .toEqual({ calories: 872, proteinG: 29, carbsG: 148, fatG: 19.6 });
  });
  it('targetsProgress computes capped percentages and handles null targets', () => {
    const p = targetsProgress(
      { calories: 2183, proteinG: 142, carbsG: 226, fatG: 58 },
      { calories: 2600, proteinG: 180, carbsG: 310, fatG: 75 },
    );
    expect(p.protein).toEqual({ logged: 142, target: 180, pct: 79 });
    expect(p.calories.pct).toBe(84);
    const none = targetsProgress({ calories: 500, proteinG: 10, carbsG: 10, fatG: 10 }, null);
    expect(none.protein).toEqual({ logged: 10, target: null, pct: 0 });
  });
  it('targetsProgress caps pct at 100', () => {
    const p = targetsProgress({ calories: 3000, proteinG: 0, carbsG: 0, fatG: 0 }, { calories: 2600 });
    expect(p.calories.pct).toBe(100);
  });
  it('round1 rounds to 0.1', () => {
    expect(round1(14.549)).toBe(14.5);
    expect(round1(9.75)).toBe(9.8);
  });
});
