import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { routeDisciplineDays } from './goals.ts';

Deno.test('run primary keeps run days — bit-for-bit legacy behavior', () => {
  const r = routeDisciplineDays('run', 3, 2, false, false);
  assertEquals(r.weeklyRunDays, 3);
  assertEquals(r.weeklyLiftDays, 2);
  assertEquals(r.weeklySwimDays, 0);
  assertEquals(r.weeklyBikeDays, 0);
  assertEquals(r.weeklyRowDays, 0);
});

Deno.test('hybrid primary routes to run', () => {
  assertEquals(routeDisciplineDays('hybrid', 4, 2, false, false).weeklyRunDays, 4);
});

Deno.test('swim primary routes the primary days to swim, zero run/row', () => {
  const r = routeDisciplineDays('swim', 4, 1, false, false);
  assertEquals(r.weeklySwimDays, 4);
  assertEquals(r.weeklyRunDays, 0);
  assertEquals(r.weeklyRowDays, 0);
  assertEquals(r.weeklyLiftDays, 1);
});

Deno.test('rowing primary routes the primary days to rowing, zero run', () => {
  const r = routeDisciplineDays('rowing', 4, 1, false, false);
  assertEquals(r.weeklyRowDays, 4);
  assertEquals(r.weeklyRunDays, 0);
  assertEquals(r.weeklySwimDays, 0);
});

Deno.test('hyrox primary routes to run (run + strength)', () => {
  assertEquals(routeDisciplineDays('hyrox', 3, 2, false, false).weeklyRunDays, 3);
});

Deno.test('cross-training toggles add one day each without stealing primary swim days', () => {
  const runner = routeDisciplineDays('run', 3, 2, true, true);
  assertEquals(runner.weeklySwimDays, 1);
  assertEquals(runner.weeklyBikeDays, 1);
  // A swimmer with includeSwim keeps their full primary swim count, not 1.
  const swimmer = routeDisciplineDays('swim', 4, 1, true, false);
  assertEquals(swimmer.weeklySwimDays, 4);
});

Deno.test('unknown / non-endurance goal falls back to run primary', () => {
  assertEquals(routeDisciplineDays('weight_loss', 3, 2, false, false).weeklyRunDays, 3);
});
