import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceBackToBackLongRuns } from './backtoback.ts';

const run = (dayOffset: number, km: number) => ({ dayOffset, session_type: 'run', planned_distance_km: km, planned_minutes: km * 6 });
const rest = (dayOffset: number) => ({ dayOffset, session_type: 'rest', planned_distance_km: null, planned_minutes: null });

Deno.test('ultra: places the two longest runs on consecutive weekend days', () => {
  const days = [run(0, 8), run(2, 30), rest(5), run(6, 20), rest(1), rest(3), rest(4)];
  const out = enforceBackToBackLongRuns(days as never, 'ultra');
  const offsets = out.map((d) => d.dayOffset).sort((a, b) => a - b);
  assertEquals(offsets, [0, 1, 2, 3, 4, 5, 6]); // 7 distinct days preserved
  const longs = out.filter((d) => d.session_type === 'run' && (d.planned_distance_km ?? 0) >= 20).map((d) => d.dayOffset).sort();
  assertEquals(longs, [5, 6]); // the 30 and 20 km runs are now Sat+Sun
});
Deno.test('ultra: leaves already-consecutive long runs untouched (idempotent)', () => {
  const days = [run(5, 30), run(6, 20), rest(0), rest(1), rest(2), rest(3), rest(4)];
  const out = enforceBackToBackLongRuns(days as never, 'ultra');
  assertEquals(out, days);
});
Deno.test('non-ultra: untouched', () => {
  const days = [run(0, 8), run(2, 30), run(6, 20), rest(1), rest(3), rest(4), rest(5)];
  assertEquals(enforceBackToBackLongRuns(days as never, 'run'), days);
});
Deno.test('fewer than two runs: no-op', () => {
  const days = [run(2, 30), rest(0), rest(1), rest(3), rest(4), rest(5), rest(6)];
  assertEquals(enforceBackToBackLongRuns(days as never, 'ultra'), days);
});
