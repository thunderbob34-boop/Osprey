// The ONLY place macro arithmetic lives. Rounding: kcal → 1, grams → 0.1.

export interface Macros { calories: number; proteinG: number; carbsG: number; fatG: number }
export interface Per100g { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }
export interface IngredientInput { quantityG: number; per100g: Per100g }
export interface MacroProgress { logged: number; target: number | null; pct: number }

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function macrosFor(i: IngredientInput): Macros {
  const f = i.quantityG / 100;
  return {
    calories: Math.round((i.per100g.calories ?? 0) * f),
    proteinG: round1((i.per100g.proteinG ?? 0) * f),
    carbsG: round1((i.per100g.carbsG ?? 0) * f),
    fatG: round1((i.per100g.fatG ?? 0) * f),
  };
}

export function sumIngredientMacros(items: IngredientInput[]): Macros {
  return items.map(macrosFor).reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: round1(acc.proteinG + m.proteinG),
      carbsG: round1(acc.carbsG + m.carbsG),
      fatG: round1(acc.fatG + m.fatG),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function scale(m: Macros, factor: number): Macros {
  return {
    calories: Math.round(m.calories * factor),
    proteinG: round1(m.proteinG * factor),
    carbsG: round1(m.carbsG * factor),
    fatG: round1(m.fatG * factor),
  };
}

export function perServing(totals: Macros, servings: number): Macros {
  if (servings <= 0) throw new RangeError('servings must be > 0');
  return scale(totals, 1 / servings);
}

function progress(logged: number, target: number | null | undefined): MacroProgress {
  const t = target ?? null;
  return { logged, target: t, pct: t && t > 0 ? Math.min(100, Math.round((logged / t) * 100)) : 0 };
}

export function targetsProgress(logged: Macros, target: Partial<Macros> | null) {
  return {
    calories: progress(logged.calories, target?.calories),
    protein: progress(logged.proteinG, target?.proteinG),
    carbs: progress(logged.carbsG, target?.carbsG),
    fat: progress(logged.fatG, target?.fatG),
  };
}
