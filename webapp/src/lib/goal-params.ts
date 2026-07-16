// Read + write-merge helpers for user_goals.goal_params — a JSONB blob owned by the mobile
// app. Readers mirror the bounds in OSPREY-app/src/services/coaching/{crossfit-params.ts,
// strength-params.ts, hyrox-params.ts} `to*Params`. mergeGoalParams is the write-safety layer:
// the webapp only ever edits one field at a time, so it must preserve every sibling key (and
// every sibling lift inside oneRepMaxKg) the mobile app owns. Keep bounds in sync.
import { HYROX_DIVISIONS, type HyroxDivision } from './hyrox-loads';

export const validKg = (n: number): boolean => Number.isFinite(n) && n > 0 && n <= 600;
export const validFranSec = (n: number): boolean => Number.isFinite(n) && n > 0 && n <= 3600;

const posKg = (v: unknown): number | null => (typeof v === 'number' && validKg(v) ? Math.round(v) : null);

export interface LiftGoalParams {
  oneRepMaxKg: { squat: number | null; bench: number | null; deadlift: number | null };
}

// Mirrors strength-params.ts toStrengthParams (oneRepMaxKg only — the webapp card doesn't
// edit goalThirdKg, so we don't read/round-trip it here).
export function parseLiftParams(raw: unknown): LiftGoalParams {
  const p = (raw ?? {}) as { oneRepMaxKg?: { squat?: unknown; bench?: unknown; deadlift?: unknown } };
  const m = p.oneRepMaxKg ?? {};
  return { oneRepMaxKg: { squat: posKg(m.squat), bench: posKg(m.bench), deadlift: posKg(m.deadlift) } };
}

export interface CrossfitGoalParams {
  oneRepMaxKg: { backSquat: number | null; deadlift: number | null; press: number | null };
  competing: boolean;
  franSec: number | null;
}

// Mirrors crossfit-params.ts toCrossfitParams, minus its null-for-absent-blob branch: the
// webapp is always editing an existing user_goals row, so an absent/empty blob just reads as
// "no maxes recorded yet, not competing" rather than "sport doesn't apply".
export function parseCrossfitParams(raw: unknown): CrossfitGoalParams {
  const p = (raw ?? {}) as {
    oneRepMaxKg?: { backSquat?: unknown; deadlift?: unknown; press?: unknown };
    competing?: unknown;
    franSec?: unknown;
  };
  const m = p.oneRepMaxKg ?? {};
  const franSec = typeof p.franSec === 'number' && validFranSec(p.franSec) ? Math.round(p.franSec) : null;
  return {
    oneRepMaxKg: { backSquat: posKg(m.backSquat), deadlift: posKg(m.deadlift), press: posKg(m.press) },
    competing: p.competing === true,
    franSec,
  };
}

export interface HyroxGoalParams {
  division: HyroxDivision | null;
  targetTimeMinutes: number | null;
}

// Mirrors hyrox-params.ts toHyroxParams, but reads an invalid/missing division as "unset"
// rather than returning null for the whole object — the card always has a row to show/edit.
export function parseHyroxParams(raw: unknown): HyroxGoalParams {
  const p = (raw ?? {}) as { division?: string; targetTimeMinutes?: unknown };
  const division = (HYROX_DIVISIONS as readonly string[]).includes(p.division ?? '') ? (p.division as HyroxDivision) : null;
  const targetTimeMinutes =
    typeof p.targetTimeMinutes === 'number' && p.targetTimeMinutes > 0 && p.targetTimeMinutes <= 300
      ? Math.round(p.targetTimeMinutes)
      : null;
  return { division, targetTimeMinutes };
}

// Merge one edited field into the stored JSONB, preserving every sibling key (and every
// sibling lift inside oneRepMaxKg) the mobile app owns. E.g. a crossfit athlete editing
// backSquat must never wipe their deadlift, press, competing, or franSec.
export function mergeGoalParams(raw: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const current = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current, ...patch };
  if (patch.oneRepMaxKg && typeof patch.oneRepMaxKg === 'object') {
    next.oneRepMaxKg = { ...((current.oneRepMaxKg as object) ?? {}), ...(patch.oneRepMaxKg as object) };
  }
  return next;
}
