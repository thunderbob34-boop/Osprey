/**
 * The plan generates one week of sessions at a time (see usePlanSync in
 * features/home/queries.ts); days past the furthest already-generated
 * session are an expected gap, not an invitation to hand-add something the
 * plan hasn't reached yet. Split from isBeyondGeneratedHorizon so a caller
 * rendering many cells (e.g. a 42-cell month grid) can compute this once
 * per render instead of once per cell.
 */
export function latestGeneratedDate(sessionDates: string[]): string | null {
  return sessionDates.length === 0 ? null : sessionDates.reduce((max, d) => (d > max ? d : max));
}

/** Falls back to "nothing generated yet" when latestDate is null. */
export function isBeyondGeneratedHorizon(dateISO: string, latestDate: string | null): boolean {
  if (latestDate == null) return true;
  return dateISO > latestDate;
}
