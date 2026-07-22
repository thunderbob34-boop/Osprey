import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveForceRebuild, buildPreferencesGoalsUpsert, resolveRaceWeeksPlanned } from './regenerate.ts';

Deno.test('resolveForceRebuild: bare force:true alone now rebuilds (the fix)', () => {
  assertEquals(resolveForceRebuild({ force: true }), true);
});

Deno.test('resolveForceRebuild: force absent does not rebuild', () => {
  assertEquals(resolveForceRebuild({}), false);
});

Deno.test('resolveForceRebuild: force:false does not rebuild', () => {
  assertEquals(resolveForceRebuild({ force: false }), false);
});

Deno.test('resolveForceRebuild: truthy non-boolean force does not rebuild (strict === true)', () => {
  assertEquals(resolveForceRebuild({ force: 'yes' }), false);
});

Deno.test('buildPreferencesGoalsUpsert: omits target_race/target_date/total_weeks_planned entirely', () => {
  const upsert = buildPreferencesGoalsUpsert('hybrid', 3, 2, 'beginner', null);
  assertEquals('target_race' in upsert, false);
  assertEquals('target_date' in upsert, false);
  assertEquals('total_weeks_planned' in upsert, false);
});

Deno.test('buildPreferencesGoalsUpsert: carries through the fields it does own', () => {
  const upsert = buildPreferencesGoalsUpsert('run', 4, 1, 'advanced', { foo: 'bar' });
  assertEquals(upsert.primary_goal, 'run');
  assertEquals(upsert.weekly_run_days, 4);
  assertEquals(upsert.weekly_lift_days, 1);
  assertEquals(upsert.fitness_level, 'advanced');
  assertEquals(upsert.goal_params, { foo: 'bar' });
});

Deno.test('resolveRaceWeeksPlanned: same race (same raceDate) preserves the existing stored value', () => {
  const result = resolveRaceWeeksPlanned(
    { raceDate: '2026-11-14', weeksOut: 5 }, // freshly computed weeksOut would be 5...
    '2026-11-14', // ...but this IS the same race already stored...
    17, // ...so the original 17-week plan's counter is preserved, not reset to 5.
  );
  assertEquals(result, 17);
});

Deno.test('resolveRaceWeeksPlanned: a genuinely new/different race computes fresh weeksOut', () => {
  const result = resolveRaceWeeksPlanned(
    { raceDate: '2027-03-01', weeksOut: 20 },
    '2026-11-14', // different stored race
    17,
  );
  assertEquals(result, 20);
});

Deno.test('resolveRaceWeeksPlanned: no existing stored race falls back to freshly computed weeksOut', () => {
  const result = resolveRaceWeeksPlanned(
    { raceDate: '2026-11-14', weeksOut: 17 },
    null,
    null,
  );
  assertEquals(result, 17);
});

Deno.test('resolveRaceWeeksPlanned: new race with weeksOut undefined falls back to null (not NaN)', () => {
  const result = resolveRaceWeeksPlanned(
    { raceDate: '2027-01-01', weeksOut: undefined },
    '2026-11-14', // different race, so isSameRace is false
    17,
  );
  assertEquals(result, null);
});
