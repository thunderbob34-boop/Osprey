/** Local calendar date as YYYY-MM-DD (NOT UTC — avoids the day-shift bug that
 * hits every user east of UTC when `toISOString()` is used for "today"). */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
