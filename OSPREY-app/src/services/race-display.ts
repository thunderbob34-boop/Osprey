import { formatDistanceKm, type UnitSystem } from '@/services/units';

/**
 * The four standard race distances, in km. Relocated from app/races.tsx's
 * local DISTANCE_PRESETS (same values, same purpose: the distance-picker
 * chips when adding a race) so this service can be the single shared
 * source of truth instead of a screen-local constant.
 */
export const RACE_DISTANCE_LADDER: { label: string; km: number }[] = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half', km: 21.0975 },
  { label: 'Full', km: 42.195 },
];

const RACE_DISTANCE_DISPLAY_LABEL: Record<string, string> = {
  '5K': '5K',
  '10K': '10K',
  Half: 'Half Marathon',
  Full: 'Marathon',
};

const DISTANCE_MATCH_TOLERANCE_KM = 0.15;

/** A recognizable label ("Half Marathon") for a standard race distance, or a unit-aware raw reading otherwise. */
export function formatRaceDistance(km: number, units: UnitSystem): string {
  const match = RACE_DISTANCE_LADDER.find((rung) => Math.abs(rung.km - km) < DISTANCE_MATCH_TOLERANCE_KM);
  return match ? RACE_DISTANCE_DISPLAY_LABEL[match.label] : formatDistanceKm(km, units);
}

/**
 * A plain-language read of how much time is left before a race. Mirrors
 * the wording OSPREY's webapp (webapp/src/lib/race-runway.ts) shows for
 * the identical concept, so the coaching voice reads the same on both
 * surfaces — not a formal port, since it's presentational copy rather
 * than domain logic, but keep the wording matched if either surface's
 * copy changes.
 */
export function raceRunwayLabel(weeksOut: number): string {
  if (weeksOut <= 1) return "Race week — trust the work you've put in.";
  if (weeksOut <= 4) return 'Peak block window — sharpen up with race-specific work.';
  if (weeksOut <= 11) return 'Time for a focused build — base phase should be behind you.';
  if (weeksOut <= 20) return 'Full build fits, with room for a base block first.';
  return 'Plenty of runway — no need to rush into hard training yet.';
}
