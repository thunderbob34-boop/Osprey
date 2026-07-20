/**
 * The plan generates one week of sessions at a time (see usePlanSync in
 * features/home/queries.ts); days past the furthest already-generated
 * session are an expected gap, not an invitation to hand-add something the
 * plan hasn't reached yet. Falls back to "nothing generated yet" when the
 * view has no sessions at all.
 */
export function isBeyondGeneratedHorizon(dateISO: string, sessionDates: string[]): boolean {
  if (sessionDates.length === 0) return true;
  const latest = sessionDates.reduce((max, d) => (d > max ? d : max));
  return dateISO > latest;
}
