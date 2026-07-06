/**
 * `new Date().toISOString().slice(0, 10)` gives the UTC calendar date, not the
 * device's local calendar date — for any evening workout/log in a UTC-negative
 * timezone (or early morning in a UTC-positive one), that silently shifts
 * "today" to the wrong day. Use this wherever "today"/"this day" means the
 * user's own local calendar day (streaks, daily targets, hydration, etc).
 */
export function localDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
