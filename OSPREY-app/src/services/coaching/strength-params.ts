import { ParseResult } from './baseline';
import type { UltraGoalParams } from './ultra-params';

export type PowerliftingLift = 'squat' | 'bench' | 'deadlift';
type LiftMaxes = { squat: number | null; bench: number | null; deadlift: number | null };

export interface StrengthGoalParams {
  oneRepMaxKg: LiftMaxes;
  goalThirdKg?: LiftMaxes; // meet target 3rd attempt; defaults to the 1RM when unset
}

// A sport-specific goal_params blob is one of these. `goal_params` is a generic JSONB
// column (ultra added it); its shape depends on the athlete's primary_goal.
export type GoalParams = UltraGoalParams | StrengthGoalParams;

const posKg = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 600 ? Math.round(v) : null);
const maxes = (o: unknown): LiftMaxes => {
  const m = (o ?? {}) as Partial<LiftMaxes>;
  return { squat: posKg(m.squat), bench: posKg(m.bench), deadlift: posKg(m.deadlift) };
};

// Stored JSONB (or null) → safe params.
export function toStrengthParams(raw: unknown): StrengthGoalParams {
  const p = (raw ?? {}) as Partial<StrengthGoalParams>;
  return { oneRepMaxKg: maxes(p.oneRepMaxKg), goalThirdKg: maxes(p.goalThirdKg) };
}

// Validate the collection-form inputs. At least one 1RM is required; each field is optional-but-plausible.
export function parseStrengthParams(input: {
  squat: string; bench: string; deadlift: string; goalSquat: string; goalBench: string; goalDeadlift: string;
}): ParseResult<StrengthGoalParams> {
  const one = (s: string, label: string): { ok: true; v: number | null } | { ok: false; error: string } => {
    const t = s.trim();
    if (t === '') return { ok: true, v: null };
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > 600) return { ok: false, error: `Enter a valid ${label} in kg (or leave it blank).` };
    return { ok: true, v: Math.round(n) };
  };
  const fields: [string, string][] = [
    [input.squat, 'squat'], [input.bench, 'bench'], [input.deadlift, 'deadlift'],
    [input.goalSquat, 'goal squat'], [input.goalBench, 'goal bench'], [input.goalDeadlift, 'goal deadlift'],
  ];
  const parsed = fields.map(([s, label]) => one(s, label));
  const bad = parsed.find((r) => !r.ok);
  if (bad && !bad.ok) return { ok: false, error: bad.error };
  const [sq, be, dl, gsq, gbe, gdl] = parsed.map((r) => (r.ok ? r.v : null));
  if (sq == null && be == null && dl == null) return { ok: false, error: 'Enter at least one 1RM (squat, bench, or deadlift).' };
  return { ok: true, value: { oneRepMaxKg: { squat: sq, bench: be, deadlift: dl }, goalThirdKg: { squat: gsq, bench: gbe, deadlift: gdl } } };
}
