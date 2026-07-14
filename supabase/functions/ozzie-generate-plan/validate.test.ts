// supabase/functions/ozzie-generate-plan/validate.test.ts
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateAndClamp } from './validate.ts';

const envelope = {
  sport: 'run', phase: 'Build', weekNumber: 5, totalWeeks: 16,
  targetWeeklyLoad: 300, hardSessionShareMax: 0.2,
  runZones: { thresholdSecPerMile: 450, easy: { min: 510, max: 570 }, marathonPace: { min: 465, max: 480 }, tenKPace: { min: 435, max: 445 }, fiveKPace: { min: 420, max: 430 }, intervalPace: { min: 430, max: 440 } },
  fuel: { dailyCarbG: { min: 350, max: 490 }, proteinG: { min: 112, max: 154 }, longSessionCarbGPerHour: 75 },
};

Deno.test('clamps an easy run that is implied too fast into the easy band', () => {
  // 10 km in 40 min => 240 s/km => ~386 s/mi, way faster than easy (510-570).
  const day = { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 10 };
  const { days, changed } = validateAndClamp([day], envelope as never);
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 0.621371); // s/mi
  assert(implied >= 510 && implied <= 571, `implied ${implied} not in easy band`);
  assert(changed.length > 0);
});

Deno.test('attaches fuel to non-rest sessions', () => {
  const day = { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 6 };
  const { days } = validateAndClamp([day], envelope as never);
  assertEquals((days[0] as Record<string, unknown>).fuel !== undefined, true);
});

Deno.test('demotes excess hard sessions to easy', () => {
  const hard = (o: number) => ({ dayOffset: o, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 8 });
  const { days } = validateAndClamp([hard(0), hard(1), hard(2), hard(3), hard(4)], envelope as never);
  const hardCount = days.filter((d) => d.intensity === 'interval' || d.intensity === 'threshold').length;
  assert(hardCount <= Math.ceil(5 * 0.2) + 0); // ≤ 1 of 5
});
