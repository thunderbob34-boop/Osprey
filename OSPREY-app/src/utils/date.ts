/**
 * Local calendar date as `YYYY-MM-DD` — NOT UTC.
 *
 * Using `new Date().toISOString().slice(0, 10)` for "today" shifts the day for
 * every user whose local clock and UTC fall on different calendar days (e.g.
 * early morning east of UTC, or late evening west of it). This helper reads the
 * local calendar components instead, so "today" always matches the user's clock.
 *
 * Use this anywhere a day-granular value is compared against `session_date`,
 * streaks, or any user-facing "today".
 */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
