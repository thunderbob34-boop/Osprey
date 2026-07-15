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

Deno.test('cycling primary routes the primary days to bike, zero run', () => {
  const r = routeDisciplineDays('cycling', 5, 2, false, false);
  assertEquals(r.weeklyBikeDays, 5);
  assertEquals(r.weeklyRunDays, 0);
  assertEquals(r.weeklySwimDays, 0);
  assertEquals(r.weeklyRowDays, 0);
  assertEquals(r.weeklyLiftDays, 2);
});

Deno.test('run/hybrid bike days unchanged by the cycling case (regression)', () => {
  // run primary, no includeBike → bike days still 0
  assertEquals(routeDisciplineDays('run', 3, 2, false, false).weeklyBikeDays, 0);
  // run primary WITH includeBike → still exactly 1 cross-training bike day
  assertEquals(routeDisciplineDays('run', 3, 2, false, true).weeklyBikeDays, 1);
  assertEquals(routeDisciplineDays('run', 3, 2, false, true).weeklyRunDays, 3);
});

Deno.test('ultra routes its primary days to run days', () => {
  const d = routeDisciplineDays('ultra', 4, 1, false, false);
  assertEquals(d.weeklyRunDays, 4);
  assertEquals(d.weeklySwimDays, 0);
  assertEquals(d.weeklyBikeDays, 0);
});

Deno.test('lift routes the bulk of days to lifting (not running)', () => {
  const d = routeDisciplineDays('lift', 3, 2, false, false); // 5-day builder → primaryDays 3, liftDays 2
  assertEquals(d.weeklyLiftDays, 3);          // the bulk is lifting
  assertEquals(d.weeklyRunDays, 2);           // min(2, liftDays) easy-cardio conditioning
  assertEquals(d.weeklySwimDays, 0);
});

Deno.test('non-lift routing is unchanged (regression)', () => {
  assertEquals(routeDisciplineDays('run', 3, 2, false, false).weeklyRunDays, 3);
  assertEquals(routeDisciplineDays('cycling', 4, 1, false, false).weeklyBikeDays, 4);
});
