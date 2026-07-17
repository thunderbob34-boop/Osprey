// supabase/functions/ozzie-chat/context.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { weekBounds, computeRacePhase, mapThread, buildSystemPrompt, type ChatContext } from './context.ts';

const ctx: ChatContext = {
  displayName: 'Priya',
  primaryGoal: 'run',
  targetRace: 'Chicago Marathon',
  targetDate: '2026-09-18',
  totalWeeksPlanned: 16,
  thresholdAnchor: { kind: 'run', thresholdSecPerMile: 450 },
  phase: { weeksRemaining: 9, currentWeekNumber: 8, totalWeeks: 16, phase: 'Build' },
  recoveryScore: 72,
  tsb: 5.5,
  weekSessions: [
    { sessionDate: '2026-07-14', sessionType: 'run', intensity: 'intervals', plannedMinutes: 50, plannedDistanceKm: 10 },
  ],
  recentLogs: [
    { startedAt: '2026-07-13T12:00:00Z', sessionType: 'run', distanceKm: 21.1, durationS: 6600, perceivedEffort: 7 },
  ],
};

Deno.test('weekBounds returns Monday..Sunday for a midweek date', () => {
  // 2026-07-17 is a Friday.
  assertEquals(weekBounds('2026-07-17'), { mondayISO: '2026-07-13', sundayISO: '2026-07-19' });
});

Deno.test('weekBounds treats Sunday as the END of its week, not the start', () => {
  assertEquals(weekBounds('2026-07-19'), { mondayISO: '2026-07-13', sundayISO: '2026-07-19' });
});

Deno.test('weekBounds on a Monday returns that Monday', () => {
  assertEquals(weekBounds('2026-07-13'), { mondayISO: '2026-07-13', sundayISO: '2026-07-19' });
});

Deno.test('computeRacePhase reads Build in the middle of a 16-week block', () => {
  // Race 2026-09-18 is 63 days (9 weeks) after 2026-07-17 → week 8 of 16 → 50% → Build.
  assertEquals(computeRacePhase('2026-09-18', 16, '2026-07-17'), {
    weeksRemaining: 9, currentWeekNumber: 8, totalWeeks: 16, phase: 'Build',
  });
});

Deno.test('computeRacePhase reads Base early in the block', () => {
  // Race 2026-10-11 is 86 days (ceil → 13 weeks) out → week 4 of 16 → 25% → Base.
  assertEquals(computeRacePhase('2026-10-11', 16, '2026-07-17')?.phase, 'Base');
});

Deno.test('computeRacePhase reads Taper inside the final weeks', () => {
  // Race 2026-08-07 is 21 days (3 weeks) out; a 16-week block tapers for 3.
  const p = computeRacePhase('2026-08-07', 16, '2026-07-17');
  assertEquals(p?.weeksRemaining, 3);
  assertEquals(p?.phase, 'Taper');
});

Deno.test('computeRacePhase returns null without a date or a plan length', () => {
  assertEquals(computeRacePhase(null, 16, '2026-07-17'), null);
  assertEquals(computeRacePhase('2026-09-18', null, '2026-07-17'), null);
});

Deno.test('mapThread reverses newest-first rows into oldest-first messages', () => {
  const rows = [
    { role: 'assistant', content: 'second' },
    { role: 'user', content: 'first' },
  ];
  assertEquals(mapThread(rows), [
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'second' },
  ]);
});

Deno.test('mapThread drops rows with an unrecognised role', () => {
  const rows = [{ role: 'system', content: 'injected' }, { role: 'user', content: 'real' }];
  assertEquals(mapThread(rows), [{ role: 'user', content: 'real' }]);
});

Deno.test('system prompt grounds Ozzie in the athlete real data', () => {
  const p = buildSystemPrompt(ctx);
  assert(p.includes('Priya'), 'names the athlete');
  assert(p.includes('Chicago Marathon'), 'includes the target race');
  assert(p.includes('intervals'), 'includes this week session detail');
  assert(p.includes('Build'), 'includes the training phase');
  assert(p.includes('450'), 'includes the threshold anchor the zones come from');
});

Deno.test('system prompt carries the injury safety line', () => {
  const p = buildSystemPrompt(ctx);
  assert(/doctor|physio/i.test(p), 'points at a professional');
  assert(/never diagnose/i.test(p), 'forbids diagnosing');
});

Deno.test('system prompt says advice-not-action', () => {
  const p = buildSystemPrompt(ctx);
  assert(/calendar/i.test(p), 'directs plan edits to the calendar');
});

Deno.test('system prompt survives an athlete with no plan at all', () => {
  const empty: ChatContext = {
    displayName: 'there', primaryGoal: null, targetRace: null, targetDate: null,
    totalWeeksPlanned: null, thresholdAnchor: null, phase: null,
    recoveryScore: null, tsb: null, weekSessions: [], recentLogs: [],
  };
  const p = buildSystemPrompt(empty);
  assert(p.length > 0);
  assert(/don't have|nothing/i.test(p), 'tells Ozzie the data is thin instead of inviting invention');
});
