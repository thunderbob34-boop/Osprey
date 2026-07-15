interface DayLike { dayOffset: number; session_type: string; planned_distance_km: number | null; planned_minutes: number | null }
const runLen = (d: DayLike) => d.planned_distance_km ?? d.planned_minutes ?? 0;

// Ultra's signature session is back-to-back long runs (docs/coaching/ultra.md §3). Day
// placement is otherwise LLM-driven with no enforcement, so put the two longest runs on
// consecutive days (Sat+Sun preferred). Deterministic, idempotent, ultra-only.
export function enforceBackToBackLongRuns<T extends DayLike>(days: T[], sport: string): T[] {
  if (sport !== 'ultra') return days;
  const runs = days.filter((d) => d.session_type === 'run').sort((a, b) => runLen(b) - runLen(a));
  if (runs.length < 2) return days;
  const [longA, longB] = runs; // longA = longest
  if (Math.abs(longA.dayOffset - longB.dayOffset) === 1) return days; // already back-to-back

  // Swap the long runs onto Saturday(5)+Sunday(6); longest → Sunday.
  const offsets = days.map((d) => d.dayOffset);
  const idxOf = (d: T) => days.indexOf(d);
  const place = (long: T, target: number) => {
    const li = idxOf(long);
    if (offsets[li] === target) return;
    const occ = offsets.indexOf(target); // day currently at target
    offsets[occ] = offsets[li];
    offsets[li] = target;
  };
  place(longA, 6);
  place(longB, 5);
  return days.map((d, i) => ({ ...d, dayOffset: offsets[i] }));
}
