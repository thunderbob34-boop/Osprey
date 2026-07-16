import { ParseResult } from './baseline';
import type { HyroxDivision } from '@/services/calculators/hyrox';

export type { HyroxDivision };

export interface HyroxGoalParams {
  division: HyroxDivision;
  targetTimeMinutes: number | null; // optional race-time goal; null = unset
}

const DIVISIONS: HyroxDivision[] = ['open_men', 'open_women', 'pro_men', 'pro_women'];
const isDivision = (v: unknown): v is HyroxDivision => DIVISIONS.includes(v as HyroxDivision);
const posMin = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 300 ? Math.round(v) : null);

// Stored JSONB (or null) → safe params, or null when no valid division (a paramless hyrox
// athlete degrades to a generic run+strength plan, like the paramless-lift follow-up).
export function toHyroxParams(raw: unknown): HyroxGoalParams | null {
  const p = (raw ?? {}) as Partial<HyroxGoalParams>;
  if (!isDivision(p.division)) return null;
  return { division: p.division, targetTimeMinutes: posMin(p.targetTimeMinutes) };
}

// Validate the collection-form inputs (division required; target time optional).
export function parseHyroxParams(input: { division: string; targetTimeMinutes: string }): ParseResult<HyroxGoalParams> {
  if (!isDivision(input.division)) return { ok: false, error: 'Pick your division.' };
  const t = input.targetTimeMinutes.trim();
  let targetTimeMinutes: number | null = null;
  if (t !== '') {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > 300) return { ok: false, error: 'Target time must be minutes (or leave it blank).' };
    targetTimeMinutes = Math.round(n);
  }
  return { ok: true, value: { division: input.division, targetTimeMinutes } };
}
