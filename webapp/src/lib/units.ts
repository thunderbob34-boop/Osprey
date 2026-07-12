export type UnitSystem = 'imperial' | 'metric';

const LB_PER_KG = 2.2046226218; // mirrors OSPREY-app/src/services/body-metrics.ts

export function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 100) / 100;
}

export function formatWeightKg(kg: number, units: UnitSystem): string {
  return units === 'metric' ? `${Math.round(kg * 10) / 10} kg` : `${kgToLb(kg)} lbs`;
}

/** Parse user-typed weight in their display units; returns kg for storage, or null if invalid. */
export function parseWeightInput(text: string, units: UnitSystem): number | null {
  const n = Number(text.trim());
  if (!text.trim() || !Number.isFinite(n) || n <= 0) return null;
  return units === 'imperial' ? lbToKg(n) : Math.round(n * 100) / 100;
}
