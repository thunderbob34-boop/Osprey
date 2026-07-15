import { ParseResult } from './baseline';

export type UltraRaceDistance = '50k' | '50mi' | '100k' | '100mi';

export interface UltraGoalParams {
  raceDistance: UltraRaceDistance;
  vertGainM: number | null; // total race vert; null = flat/unknown
  gutTrained: boolean;       // practiced high-carb feeding?
}

export const ULTRA_DISTANCE_FACTOR: Record<UltraRaceDistance, number> = {
  '50k': 1.0, '50mi': 1.15, '100k': 1.3, '100mi': 1.5, // docs/coaching/ultra.md §7 (tunable)
};

const DISTANCES: UltraRaceDistance[] = ['50k', '50mi', '100k', '100mi'];
const isDistance = (v: unknown): v is UltraRaceDistance => DISTANCES.includes(v as UltraRaceDistance);

// Stored JSONB (or null) → safe params. A paramless ultra runs a base 50k build.
export function toUltraParams(raw: unknown): UltraGoalParams {
  const p = (raw ?? {}) as Partial<UltraGoalParams>;
  return {
    raceDistance: isDistance(p.raceDistance) ? p.raceDistance : '50k',
    vertGainM: typeof p.vertGainM === 'number' && p.vertGainM >= 0 ? p.vertGainM : null,
    gutTrained: p.gutTrained === true,
  };
}

// Validate the collection-form inputs (vert optional; distance required).
export function parseUltraParams(input: { raceDistance: string; vertGainM: string; gutTrained: boolean }): ParseResult<UltraGoalParams> {
  if (!isDistance(input.raceDistance)) return { ok: false, error: 'Pick your race distance.' };
  const vertRaw = input.vertGainM.trim();
  let vertGainM: number | null = null;
  if (vertRaw !== '') {
    const v = Number(vertRaw);
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'Vert must be a positive number of metres (or leave it blank).' };
    vertGainM = Math.round(v);
  }
  return { ok: true, value: { raceDistance: input.raceDistance, vertGainM, gutTrained: input.gutTrained } };
}
