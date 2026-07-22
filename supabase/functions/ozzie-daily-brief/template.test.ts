import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { templateBrief } from './template.ts';
import type { BriefContext } from './types.ts';

function ctx(overrides: Partial<BriefContext> = {}): BriefContext {
  return {
    displayName: 'Sam',
    experienceTier: 'intermediate',
    units: 'imperial',
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

// The Weather Coach card owns the forecast. The brief used to prepend
// "Sky check: <full multi-day forecast>", which duplicated that card and blew
// past the brief's own 2-3-sentence rule — so weather is no longer surfaced
// here at all, and the next-priority note (trend) is free to show.
Deno.test('weather is never surfaced in the brief — the Weather Coach card owns it', () => {
  const b = templateBrief(
    ctx({ recentWorkoutCount7d: 5, workoutCountPrior7d: 3 }),
    'train', 'heat spike Thursday', null,
  );
  assert(!b.insight_text.includes('heat spike Thursday'), 'brief must not repeat the forecast');
  assert(!b.insight_text.includes('Sky check'), 'the Sky check dump is gone');
  assert(b.insight_text.includes('up from 3'), 'the trend note now shows instead');
});

Deno.test('session distance speaks the athlete\'s own units', () => {
  const session = {
    sessionType: 'run', intensity: 'threshold',
    plannedMinutes: 40, plannedDistanceKm: 7, description: 'Threshold Run',
  };
  // 7 km -> 4.3 mi. An imperial athlete must never read "7 km" next to a
  // UI chip that says "4.3 mi" for the same session.
  const imperial = templateBrief(ctx({ units: 'imperial', todaySession: session }), 'train', null, null);
  assert(imperial.insight_text.includes('4.3 mi'), imperial.insight_text);
  assert(!imperial.insight_text.includes('km'), 'imperial brief must not mention km');

  const metric = templateBrief(ctx({ units: 'metric', todaySession: session }), 'train', null, null);
  assert(metric.insight_text.includes('7 km'), metric.insight_text);
});

Deno.test('a memory surfaces when nothing higher-priority is available', () => {
  const b = templateBrief(
    ctx({ recentMemories: [{ summary: 'PR bench 100kg', occurredOn: '2026-06-01' }] }),
    'train', null, null,
  );
  assert(b.insight_text.includes('PR bench 100kg'));
});
