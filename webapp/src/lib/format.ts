import type { UnitSystem } from './units';
import type { MealType } from './schemas';

export const SESSION_TYPE_LABEL: Record<string, string> = {
  run: 'Run', lift: 'Lift', cross: 'Cross-train', rest: 'Rest', race: 'Race',
  swim: 'Swim', bike: 'Bike', rowing: 'Row', hyrox: 'Hyrox',
};

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

export const INTENSITY_LABEL: Record<string, string> = {
  easy: 'Easy', moderate: 'Moderate', threshold: 'Threshold', interval: 'Interval', race: 'Race', rest: 'Rest',
};

export const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned', completed: 'Completed', skipped: 'Skipped', partial: 'Partial',
};

export function formatMinutes(min: number | null): string | null {
  if (min == null) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatSeconds(s: number | null): string | null {
  if (s == null) return null;
  return formatMinutes(Math.round(s / 60));
}

export function formatDistanceKm(km: number | null, units: UnitSystem): string | null {
  if (km == null) return null;
  return units === 'imperial' ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`;
}

export function formatWeekday(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

export function formatDayNum(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function isSameLocalDate(dateStr: string, d: Date): boolean {
  const a = new Date(`${dateStr}T00:00:00`);
  return a.getFullYear() === d.getFullYear() && a.getMonth() === d.getMonth() && a.getDate() === d.getDate();
}
