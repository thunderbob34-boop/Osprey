import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { computeTarget, loadTierForSession, REFERENCE_BODYWEIGHT_KG } from './targets.ts';

Deno.test('computeTarget: protein scales with bodyweight, not a fixed goal bucket', () => {
  const light = computeTarget('hybrid', null, 0, 70);
  const heavy = computeTarget('hybrid', null, 0, 100);
  assertEquals(light.proteinG, Math.round(70 * 2.2));
  assertEquals(heavy.proteinG, Math.round(100 * 2.2));
});

Deno.test('computeTarget: carbs rise with today\'s load tier at a fixed bodyweight', () => {
  const rest = computeTarget('run', { sessionType: 'rest', plannedMinutes: null }, 0, 70);
  const moderate = computeTarget('run', { sessionType: 'run', plannedMinutes: 45 }, 0, 70);
  const long = computeTarget('run', { sessionType: 'run', plannedMinutes: 120 }, 0, 70);
  const race = computeTarget('run', { sessionType: 'race', plannedMinutes: 180 }, 0, 70);
  assertEquals(rest.carbsG < moderate.carbsG, true);
  assertEquals(moderate.carbsG < long.carbsG, true);
  assertEquals(long.carbsG < race.carbsG, true);
});

Deno.test('loadTierForSession: rest and no session both map to easy, race maps to peak', () => {
  assertEquals(loadTierForSession(null), 'easy');
  assertEquals(loadTierForSession({ sessionType: 'rest', plannedMinutes: null }), 'easy');
  assertEquals(loadTierForSession({ sessionType: 'race', plannedMinutes: 30 }), 'peak');
  assertEquals(loadTierForSession({ sessionType: 'run', plannedMinutes: 90 }), 'high');
  assertEquals(loadTierForSession({ sessionType: 'run', plannedMinutes: 30 }), 'moderate');
});

Deno.test('computeTarget: falls back to a reference bodyweight when none is on file', () => {
  const withNull = computeTarget('run', null, 0, null);
  const withReference = computeTarget('run', null, 0, REFERENCE_BODYWEIGHT_KG);
  assertEquals(withNull, withReference);
});

Deno.test('computeTarget: never returns negative fat even under a large negative weight-trend adjustment', () => {
  const target = computeTarget('run', { sessionType: 'rest', plannedMinutes: null }, -200, 40);
  assertEquals(target.fatG >= 0, true);
  assertEquals(target.calories >= 1600, true);
});
