import { ParseResult } from './baseline';

type CrossfitMaxes = { backSquat: number | null; deadlift: number | null; press: number | null };

export interface CrossfitGoalParams {
  oneRepMaxKg: CrossfitMaxes;
  competing: boolean;      // Open/compete vs general fitness
  franSec: number | null;  // the athlete's Fran PR — seeds the benchmark read
}

const posKg = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 600 ? Math.round(v) : null);
const posSec = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 3600 ? Math.round(v) : null);
const maxes = (o: unknown): CrossfitMaxes => {
  const m = (o ?? {}) as Partial<CrossfitMaxes>;
  return { backSquat: posKg(m.backSquat), deadlift: posKg(m.deadlift), press: posKg(m.press) };
};

// Stored JSONB → safe params; null only when the blob is absent (onboarding skip → generic
// plan). A general-fitness crossfitter still has competing:false and is valid params.
export function toCrossfitParams(raw: unknown): CrossfitGoalParams | null {
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as Partial<CrossfitGoalParams>;
  return { oneRepMaxKg: maxes(p.oneRepMaxKg), competing: p.competing === true, franSec: posSec(p.franSec) };
}

// Validate collection-form inputs. Nothing is required (general fitness needs no 1RM/Fran).
export function parseCrossfitParams(input: {
  backSquat: string; deadlift: string; press: string; competing: boolean; fran: string;
}): ParseResult<CrossfitGoalParams> {
  const one = (s: string, label: string, max: number): { ok: true; v: number | null } | { ok: false; error: string } => {
    const t = s.trim();
    if (t === '') return { ok: true, v: null };
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > max) return { ok: false, error: `Enter a valid ${label} (or leave it blank).` };
    return { ok: true, v: Math.round(n) };
  };
  const bs = one(input.backSquat, 'back squat in kg', 600);
  const dl = one(input.deadlift, 'deadlift in kg', 600);
  const pr = one(input.press, 'press in kg', 600);
  const fr = one(input.fran, 'Fran time in seconds', 3600);
  const bad = [bs, dl, pr, fr].find((r) => !r.ok);
  if (bad && !bad.ok) return { ok: false, error: bad.error };
  return {
    ok: true,
    value: {
      oneRepMaxKg: { backSquat: bs.ok ? bs.v : null, deadlift: dl.ok ? dl.v : null, press: pr.ok ? pr.v : null },
      competing: input.competing,
      franSec: fr.ok ? fr.v : null,
    },
  };
}
