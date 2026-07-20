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
