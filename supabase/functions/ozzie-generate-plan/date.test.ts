import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { zonedDateString, mondayOfWeek, toDateString } from './date.ts';

Deno.test('zonedDateString: negative-offset evening stays on the prior UTC day', () => {
  // 2026-07-15 23:30 in America/Los_Angeles is 2026-07-16 06:30 UTC — the
  // exact window where a naive `new Date().toISOString()` in the edge
  // runtime would already report the next calendar day.
  const instant = new Date('2026-07-16T06:30:00Z');
  assertEquals(zonedDateString('America/Los_Angeles', instant), '2026-07-15');
  assertEquals(zonedDateString('UTC', instant), '2026-07-16');
});

Deno.test('mondayOfWeek: mid-week date resolves to that week\'s Monday', () => {
  // 2026-07-16 is a Thursday.
  assertEquals(toDateString(mondayOfWeek('2026-07-16')), '2026-07-13');
});

Deno.test('mondayOfWeek: Sunday resolves to the Monday six days prior, not the next one', () => {
  // 2026-07-19 is a Sunday.
  assertEquals(toDateString(mondayOfWeek('2026-07-19')), '2026-07-13');
});

Deno.test('mondayOfWeek: Monday resolves to itself', () => {
  assertEquals(toDateString(mondayOfWeek('2026-07-13')), '2026-07-13');
});
