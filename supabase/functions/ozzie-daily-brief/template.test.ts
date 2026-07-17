import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { templateBrief } from './template.ts';
import type { BriefContext } from './types.ts';

function ctx(overrides: Partial<BriefContext> = {}): BriefContext {
  return {
    displayName: 'Sam',
    experienceTier: 'intermediate',
    recovery: null,
    load: null,
    todaySession: null,
    recentWorkoutCount7d: 0,
    workoutCountPrior7d: 0,
    primaryGoal: 'run',
    workoutTimeConsistency: null,
    foodLogCount14d: 5,
    recentMemories: [],
    ...overrides,
  };
}

Deno.test('habit tip fires only when the workout hour is consistent AND food logging is sparse', () => {
  const on = templateBrief(
    ctx({ workoutTimeConsistency: { hour: 7, count: 4 }, foodLogCount14d: 1 }),
    'train', null, null,
  );
  assert(on.habit_tip !== null && on.habit_tip.includes('7am'), 'should suggest logging around the training hour');

  // enough food logs → no tip
  assertEquals(
    templateBrief(ctx({ workoutTimeConsistency: { hour: 7, count: 4 }, foodLogCount14d: 5 }), 'train', null, null).habit_tip,
    null,
  );
  // too few consistent sessions → no tip
  assertEquals(
    templateBrief(ctx({ workoutTimeConsistency: { hour: 7, count: 2 }, foodLogCount14d: 1 }), 'train', null, null).habit_tip,
    null,
  );
});

Deno.test('rest recommendation frames rest as planned, not a miss', () => {
  const b = templateBrief(
    ctx({ recovery: { score: 40, recommendation: 'rest', hrvMs: null, sleepHours: null } }),
    'rest', null, null,
  );
  assert(b.insight_text.startsWith('Rest day'));
  assert(b.insight_text.includes('not a miss'));
});

Deno.test('the why grounds in recovery when present, TSB otherwise, and admits when neither', () => {
  assert(
    templateBrief(ctx({ recovery: { score: 82, recommendation: 'go', hrvMs: 60, sleepHours: 7 } }), 'train', null, null)
      .why_reasoning.includes('82/100'),
  );
  assert(
    templateBrief(ctx({ load: { atl: 40, ctl: 50, tsb: -12 } }), 'rest', null, null).why_reasoning.includes('TSB'),
  );
  assert(templateBrief(ctx(), 'train', null, null).why_reasoning.includes('No recovery or load data'));
});

Deno.test('weather note wins over the weekly-trend note', () => {
  const b = templateBrief(
    ctx({ recentWorkoutCount7d: 5, workoutCountPrior7d: 3 }),
    'train', 'heat spike Thursday', null,
  );
  assert(b.insight_text.includes('heat spike Thursday'));
  assert(!b.insight_text.includes('up from 3'), 'trend note should be suppressed when weather is present');
});

Deno.test('a memory surfaces when nothing higher-priority is available', () => {
  const b = templateBrief(
    ctx({ recentMemories: [{ summary: 'PR bench 100kg', occurredOn: '2026-06-01' }] }),
    'train', null, null,
  );
  assert(b.insight_text.includes('PR bench 100kg'));
});
