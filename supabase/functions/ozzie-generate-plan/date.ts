// Timezone-aware date helpers for weekly plan generation. The edge runtime's
// clock is UTC, which can be a full calendar day ahead of a negative-offset
// user's actual local date in the evening — mirrors ozzie-daily-brief's
// zonedDateString helper for the same class of bug.

/** "YYYY-MM-DD" for the given instant, as a calendar date in timeZone. */
export function zonedDateString(timeZone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Monday of the week containing todayStr (a "YYYY-MM-DD" local calendar date).
// Anchored to UTC midnight of that calendar date so the day-of-week arithmetic
// doesn't depend on the edge runtime's own timezone.
export function mondayOfWeek(todayStr: string): Date {
  const d = new Date(`${todayStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
