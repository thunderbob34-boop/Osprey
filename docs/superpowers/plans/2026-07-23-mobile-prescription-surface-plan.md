# Mobile Prescription Surface ("Your Numbers") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the athlete a real, always-current view of everything `computeEnvelope` already computes — working loads, Prilepin ranges, RPE/RIR, attempt plans, Hyrox splits and station weights, CrossFit loads and Fran tier, and daily fuel targets — none of which renders anywhere on mobile today.

**Architecture:** Generalize `useDisplayZones` (a thin wrapper around `resolveZones` with a hardcoded `phase: 'Base'`) into `useDisplayEnvelope`, which calls the full `computeEnvelope` and returns every field additively — `zones`/`hrZones`/`confidence` stay byte-identical, with `strength`/`hyrox`/`crossfit`/`fuel`/`phase`/`weekNumber`/`totalWeeks`/`targetWeeklyLoad` added alongside. One hook, one shared query cache, serving both the 7 existing consumers (unchanged behavior) and a new screen, `app/your-numbers.tsx`.

**Tech Stack:** React Native / Expo, TanStack Query, Jest + `@testing-library/react-native` (existing conventions — no cross-repo parity port needed; this consumes mobile's own already-tested `computeEnvelope`).

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-07-23-mobile-prescription-surface-design.md`, as corrected during plan-writing — see the spec's Component 1 section for the full correction note.)

- **`zones`/`hrZones`/`confidence` in the hook's return value must stay byte-identical to today's `resolveZones`-only computation** for every existing input — this is an additive change, not a behavioral one, for the 7 existing consumers (`ZonesCard.tsx`, `DailySummary.tsx`, `pace-format.ts`, `training-baseline.tsx`, `plan-preview.tsx`, `workout.tsx`, `run.tsx`) plus `useThresholdAnchor.ts`, which shares the hook's query-cache key without calling the hook itself.
- **The hook itself must not encode sport-specific "don't show this" presentation logic.** Today's blanket `if (sport === 'lift') return null` inside `fetchDisplayZones` is a `ZonesCard`-specific decision leaking into a data hook used by 7 other call sites. Each consumer that needs to hide itself for a given sport does so explicitly at its own call site.
- **No change to `computeEnvelope`, `buildStrengthPrescription`, `buildHyroxPrescription`, `buildCrossfitPrescription`, `computeFuel`, or any of their calculator dependencies.** This plan is entirely about rendering already-correct data; the math is out of scope.
- **No change to webapp's `StrengthZones.tsx`** — a separate, working, narrower feature (editing maxes) this plan doesn't touch or need to reconcile with.
- **No Free/Plus gating anywhere on the new screen or its entry point** — session-numbers data is free for every account.
- **No edge-function or migration changes.** Everything this plan needs (`computeEnvelope` and its full dependency graph, `target_date`/`total_weeks_planned`/`goal_params` on `user_goals`) already exists and is already deployed.

**Plan-writing correction (verified against actual current behavior, not the spec's original claim):** only `lift` currently shows no `ZonesCard` at all. `blueprintSport('hyrox')` maps to `'run'`, so hyrox athletes see real run-pace zones today. `blueprintSport('crossfit')` matches no branch, so crossfit falls into the same HR-bpm-fallback bucket as weight_loss/general_fitness/cycling-without-FTP — it already shows a card. Task 3 below guards on `display.sport === 'lift'` specifically, not a broader "lift/crossfit/hyrox" assumption.

---

## Task 1: `useDisplayEnvelope` hook (new file, additive)

Creates the generalized hook as a brand-new file. The old `src/hooks/useDisplayZones.ts` is left completely untouched by this task — every existing consumer keeps importing it and keeps compiling — so this task's deliverable is self-contained and testable on its own before anything else in the app changes.

**Files:**
- Create: `OSPREY-app/src/hooks/useDisplayEnvelope.ts`
- Test: `OSPREY-app/src/hooks/__tests__/useDisplayEnvelope.test.ts`

**Interfaces:**
- Consumes: `computeEnvelope`, `resolveZones`, `CoachingEnvelope`, `ZonesConfidence` from `@/services/coaching/envelope`; `computeRacePhase`, `RaceGoal` from `@/services/plan`; `resolveGoalInputs` from `@/services/coaching/build-envelope`; `toSelfReportAnchor`, `ThresholdAnchorMap` from `@/services/coaching/baseline`; `selectBestRunEffort`, `selectBestRowingSplit` from `@/services/coaching/anchor`.
- Produces: `export interface DisplayEnvelope extends CoachingEnvelope { confidence: ZonesConfidence }`; `export interface DisplayEnvelopeRawInputs { ... }`; `export function buildDisplayEnvelope(raw: DisplayEnvelopeRawInputs, now?: Date): DisplayEnvelope` (pure — Tasks 3, 4, 5 do not call this directly, but its existence is what makes Task 1 testable without mocking Supabase); `export function useDisplayEnvelope(): DisplayEnvelope | null` (this is what Tasks 2–5 consume).

**Plan-writing note:** the `user_goals` select below adds `goal_params` in addition to the `target_date`/`total_weeks_planned` the spec's prose explicitly names. This isn't optional: `strengthParams`/`hyroxParams`/`crossfitParams` can only come from `goal_params` (via `resolveGoalInputs`, the same function `build-envelope.ts`'s `invokeGeneratePlan` already uses), and without them `buildStrengthPrescription`/`buildHyroxPrescription`/`buildCrossfitPrescription` return `null` even for an athlete who has entered real maxes — silently breaking Task 5's Strength/Hyrox/CrossFit sections for every real user. The spec's own stated goal ("a real, always-current view of everything `computeEnvelope` already computes") requires this; its prose just didn't spell out the column.

- [ ] **Step 1: Write the failing tests**

Create `OSPREY-app/src/hooks/__tests__/useDisplayEnvelope.test.ts`:

```ts
jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { buildDisplayEnvelope, type DisplayEnvelopeRawInputs } from '@/hooks/useDisplayEnvelope';

const BASE_RAW: DisplayEnvelopeRawInputs = {
  primaryGoal: 'run',
  fitnessLevel: 'beginner',
  targetDate: null,
  totalWeeksPlanned: null,
  thresholdAnchor: null,
  goalParams: null,
  bodyWeightKg: null,
  bestRunMiles: null,
  bestRunTimeS: null,
  rowingSplitSecPer500: null,
  maxHR: null,
};

describe('buildDisplayEnvelope — phase computation', () => {
  it('falls back to Base/week 1/8 total weeks when no race target is set', () => {
    const env = buildDisplayEnvelope(BASE_RAW);
    expect(env.phase).toBe('Base');
    expect(env.weekNumber).toBe(1);
    expect(env.totalWeeks).toBe(8);
  });

  it('falls back to the same default when totalWeeksPlanned is missing but targetDate is set', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, targetDate: '2026-12-01', totalWeeksPlanned: null });
    expect(env.phase).toBe('Base');
    expect(env.weekNumber).toBe(1);
    expect(env.totalWeeks).toBe(8);
  });

  it('falls back to the same default when targetDate is missing but totalWeeksPlanned is set', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, targetDate: null, totalWeeksPlanned: 12 });
    expect(env.phase).toBe('Base');
    expect(env.weekNumber).toBe(1);
    expect(env.totalWeeks).toBe(8);
  });

  it('computes a real phase from a real race target, via an injected now', () => {
    const now = new Date(2026, 0, 1); // Thu 2026-01-01 local midnight
    const env = buildDisplayEnvelope(
      { ...BASE_RAW, targetDate: '2026-01-08', totalWeeksPlanned: 8 }, // 1 week out of an 8-week plan
      now,
    );
    expect(env.phase).toBe('Taper');
    expect(env.weekNumber).toBe(8);
    expect(env.totalWeeks).toBe(8);
  });
});

describe('buildDisplayEnvelope — wiring (sport, anchors, effort data reach the envelope)', () => {
  it('defaults an unset goal to run', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: null });
    expect(env.sport).toBe('run');
    expect(env.zones).not.toBeNull();
  });

  it('threads a self-reported run anchor into real run zones', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      thresholdAnchor: { run: { thresholdSecPerMile: 480, source: 'self_report' } },
    });
    expect(env.zones).toMatchObject({ kind: 'run', thresholdSecPerMile: 480 });
    expect(env.confidence).toBe('measured');
  });

  it('passes a rowing split through to a rowing envelope', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'rowing', rowingSplitSecPer500: 118 });
    expect(env.zones).toMatchObject({ kind: 'rowing', splitSecPer500: 118 });
  });

  it('threads observed maxHR into hrZones', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, maxHR: 185 });
    expect(env.hrZones).toMatchObject({ maxHR: 185, source: 'observed' });
  });

  it('defaults body weight to 70kg when body_metrics has no row', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      primaryGoal: 'lift',
      bodyWeightKg: null,
      goalParams: { oneRepMaxKg: { squat: 100, bench: 0, deadlift: 0 } },
    });
    expect(env.strength?.fatG).toEqual({ min: Math.round(70 * 0.8), max: Math.round(70 * 1.5) });
  });
});

describe('buildDisplayEnvelope — lift now produces a full envelope (the point of this hook)', () => {
  it('computes zones=null (no pace blueprint) but a real strength/fuel block', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      primaryGoal: 'lift',
      goalParams: { oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 } },
    });
    expect(env.zones).toBeNull(); // lift has no pace/power blueprint — matches today's card behavior
    expect(env.strength).not.toBeNull();
    expect(env.strength?.workingPercent1RM).toBe(80); // STRENGTH_PHASE_PERCENT.Base
    expect(env.fuel.longSessionCarbGPerHour).toBe(0); // no endurance in-session fueling
  });

  it('leaves strength null for a paramless lifter (onboarding "estimate for me")', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'lift', goalParams: null });
    expect(env.strength).toBeNull();
  });
});

describe('buildDisplayEnvelope — hyrox/crossfit goal_params threading', () => {
  it('populates hyrox from goal_params when the goal is hyrox', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'hyrox', goalParams: { division: 'open_men' } });
    expect(env.hyrox?.division).toBe('open_men');
    expect(env.hyrox?.stationWeights.sledPushKg).toBe(152);
  });

  it('leaves hyrox null without a division', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'hyrox', goalParams: null });
    expect(env.hyrox).toBeNull();
  });

  it('populates crossfit from goal_params when the goal is crossfit', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      primaryGoal: 'crossfit',
      goalParams: { oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, franSec: 200 },
    });
    expect(env.crossfit).not.toBeNull();
    expect(env.crossfit?.benchmark.franTier).toBe('intermediate'); // 200s: beats the 300s bound, not the 180s one
  });

  it('leaves crossfit null without goal_params', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'crossfit', goalParams: null });
    expect(env.crossfit).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/hooks/__tests__/useDisplayEnvelope.test.ts`
Expected: FAIL — `Cannot find module '@/hooks/useDisplayEnvelope'` (the file doesn't exist yet).

- [ ] **Step 3: Write the hook**

Create `OSPREY-app/src/hooks/useDisplayEnvelope.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { computeEnvelope, resolveZones, type CoachingEnvelope, type ZonesConfidence } from '@/services/coaching/envelope';
import { computeRacePhase, type RaceGoal } from '@/services/plan';
import { resolveGoalInputs } from '@/services/coaching/build-envelope';
import { toSelfReportAnchor, type ThresholdAnchorMap } from '@/services/coaching/baseline';
import { selectBestRunEffort, selectBestRowingSplit } from '@/services/coaching/anchor';

const MILES_PER_KM = 0.621371;
const RECENT_WINDOW_MS = 56 * 24 * 60 * 60 * 1000;

export interface DisplayEnvelope extends CoachingEnvelope {
  confidence: ZonesConfidence;
}

export interface DisplayEnvelopeRawInputs {
  primaryGoal: string | null | undefined;
  fitnessLevel: string | null | undefined;
  targetDate: string | null | undefined;
  totalWeeksPlanned: number | null | undefined;
  thresholdAnchor: ThresholdAnchorMap | null | undefined;
  goalParams: unknown;
  bodyWeightKg: number | null | undefined;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  rowingSplitSecPer500: number | null;
  maxHR: number | null;
}

// Pure: raw DB-shaped inputs -> a full DisplayEnvelope. Mirrors build-envelope.ts's
// envelopeFromInputs (same "pure core, thin I/O shell" split), so this is directly
// unit-testable without mocking Supabase's query chain — `now` is injectable for
// the same reason that file's is (deterministic phase math under test).
export function buildDisplayEnvelope(raw: DisplayEnvelopeRawInputs, now: Date = new Date()): DisplayEnvelope {
  const { sport, ultraParams, strengthParams, hyroxParams, crossfitParams } = resolveGoalInputs(
    undefined,
    raw.primaryGoal,
    raw.goalParams,
  );

  const raceGoal: RaceGoal | null =
    raw.targetDate && raw.totalWeeksPlanned
      ? { targetRace: null, targetDate: raw.targetDate, totalWeeksPlanned: raw.totalWeeksPlanned }
      : null;
  const phaseInfo = raceGoal ? computeRacePhase(raceGoal, now) : null;

  const input = {
    sport,
    phase: phaseInfo?.phase ?? ('Base' as const),
    weekNumber: phaseInfo?.currentWeekNumber ?? 1,
    totalWeeks: phaseInfo?.totalWeeks ?? 8,
    baselineLoad: 200,
    prevWeekLoad: null,
    fitnessLevel: raw.fitnessLevel ?? 'beginner',
    bodyWeightKg: raw.bodyWeightKg ?? 70,
    bestRunMiles: raw.bestRunMiles,
    bestRunTimeS: raw.bestRunTimeS,
    rowingSplitSecPer500: raw.rowingSplitSecPer500,
    selfReportAnchor: toSelfReportAnchor(raw.thresholdAnchor ?? null),
    maxHR: raw.maxHR,
    ultraParams,
    strengthParams,
    hyroxParams,
    crossfitParams,
    weeksRemaining: phaseInfo?.weeksRemaining ?? null,
  };

  const { zonesConfidence } = resolveZones(input);
  const envelope = computeEnvelope(input);
  const confidence: ZonesConfidence =
    envelope.zones ? zonesConfidence : envelope.hrZones.source === 'estimated' ? 'estimated' : 'measured';
  return { ...envelope, confidence };
}

async function fetchDisplayEnvelope(userId: string): Promise<DisplayEnvelope | null> {
  const [goalsRes, weightRes, runsRes, rowsRes, maxHrRes] = await Promise.all([
    supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned, threshold_anchor, goal_params').eq('user_id', userId).maybeSingle(),
    supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
    supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'rowing').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
    supabase.from('workout_logs').select('max_heart_rate').eq('user_id', userId).is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).not('max_heart_rate', 'is', null).order('max_heart_rate', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const g = goalsRes.data;

  const bestEffort = selectBestRunEffort(
    (runsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceMiles: (r.total_distance_km as number) * MILES_PER_KM, timeS: r.total_duration_s as number })),
  );
  const rowingSplit = selectBestRowingSplit(
    (rowsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceKm: r.total_distance_km as number, timeS: r.total_duration_s as number })),
  );

  return buildDisplayEnvelope({
    primaryGoal: g?.primary_goal,
    fitnessLevel: g?.fitness_level,
    targetDate: g?.target_date,
    totalWeeksPlanned: g?.total_weeks_planned,
    thresholdAnchor: g?.threshold_anchor as ThresholdAnchorMap | null,
    goalParams: g?.goal_params,
    bodyWeightKg: weightRes.data?.weight_kg as number | null,
    bestRunMiles: bestEffort?.distanceMiles ?? null,
    bestRunTimeS: bestEffort?.timeS ?? null,
    rowingSplitSecPer500: rowingSplit,
    maxHR: (maxHrRes.data?.max_heart_rate as number | null) ?? null,
  });
}

export function useDisplayEnvelope(): DisplayEnvelope | null {
  const userId = useAuthStore((s) => s.user?.id);

  const { data } = useQuery({
    queryKey: ['display-envelope', userId],
    queryFn: () => fetchDisplayEnvelope(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  return data ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/hooks/__tests__/useDisplayEnvelope.test.ts`
Expected: PASS, 15 tests. (Plan-writing undercounted this block-by-block: "wiring" has 5 cases not 4, "hyrox/crossfit threading" has 4 not 3 — 4+5+2+4=15. Trust the actual count from the run, not this number, if they ever diverge again.)

- [ ] **Step 5: Run the full suite to confirm nothing else broke**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest`
Expected: PASS, 43 test suites (42 existing + this one), 397 tests (382 existing + 15 new).

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/hooks/useDisplayEnvelope.ts OSPREY-app/src/hooks/__tests__/useDisplayEnvelope.test.ts
git commit -m "feat(mobile): add useDisplayEnvelope hook (additive, old hook untouched)"
```

---

## Task 2: Migrate the 6 mechanical consumers + the cache-key-only site

Rename every reference from `useDisplayZones`/`DisplayZones`/the `'display-zones'` query key to `useDisplayEnvelope`/`DisplayEnvelope`/`'display-envelope'`, across every file EXCEPT `ZonesCard.tsx` (Task 3 — it needs new guard logic, not just a rename). Every file here is verified (by direct read this session) to touch only `.zones`/`.hrZones` through safe optional chaining or a loading gate that doesn't depend on lift-specific null semantics — none of them need any logic change, only the rename.

**Files:**
- Modify: `OSPREY-app/src/screens/DailySummary.tsx:21,107`
- Modify: `OSPREY-app/app/plan-preview.tsx:21,280`
- Modify: `OSPREY-app/app/(tabs)/workout.tsx:13,92`
- Modify: `OSPREY-app/app/workout/run.tsx:21,89`
- Modify: `OSPREY-app/app/training-baseline.tsx:13,53,85`
- Modify: `OSPREY-app/src/hooks/useThresholdAnchor.ts:41-47`

**Interfaces:**
- Consumes: `useDisplayEnvelope`, `type DisplayEnvelope` from Task 1's `@/hooks/useDisplayEnvelope`.
- Produces: nothing new — every file's public behavior is unchanged; this task only proves the byte-identity constraint holds via the existing test suite.

- [ ] **Step 1: `DailySummary.tsx`**

Current (line 21): `import { useDisplayZones } from '@/hooks/useDisplayZones';`
New: `import { useDisplayEnvelope } from '@/hooks/useDisplayEnvelope';`

Current (line 107): `const displayZones = useDisplayZones();`
New: `const displayZones = useDisplayEnvelope();`

Line 108 (`sessionPaceBand(session.intensity, displayZones?.zones ?? null, units)`) is unchanged — `DisplayEnvelope` still has `.zones`.

- [ ] **Step 2: `plan-preview.tsx`**

Current (line 21): `import { useDisplayZones } from '@/hooks/useDisplayZones';`
New: `import { useDisplayEnvelope } from '@/hooks/useDisplayEnvelope';`

Current (line 280): `const displayZones = useDisplayZones();`
New: `const displayZones = useDisplayEnvelope();`

Line 530 (`formatZonePace(session, displayZones?.zones ?? null, units)`) is unchanged.

- [ ] **Step 3: `(tabs)/workout.tsx`**

Current (line 13): `import { useDisplayZones } from '@/hooks/useDisplayZones';`
New: `import { useDisplayEnvelope } from '@/hooks/useDisplayEnvelope';`

Current (line 92): `const displayZones = useDisplayZones();`
New: `const displayZones = useDisplayEnvelope();`

Line 101 (`sessionPaceBand(planned?.intensity, displayZones?.zones ?? null, units)`) is unchanged.

- [ ] **Step 4: `workout/run.tsx`**

Current (line 21): `import { useDisplayZones } from '@/hooks/useDisplayZones';`
New: `import { useDisplayEnvelope } from '@/hooks/useDisplayEnvelope';`

Current (line 89): `const displayZones = useDisplayZones();`
New: `const displayZones = useDisplayEnvelope();`

Line 381 (`<SessionTargetStrip target={sessionTarget} zones={displayZones?.zones ?? null} />`) is unchanged.

- [ ] **Step 5: `training-baseline.tsx`**

Current (line 13): `import { useDisplayZones } from '@/hooks/useDisplayZones';`
New: `import { useDisplayEnvelope } from '@/hooks/useDisplayEnvelope';`

Current (line 53): `const display = useDisplayZones();`
New: `const display = useDisplayEnvelope();`

Current (line 85): `queryClient.invalidateQueries({ queryKey: ['display-zones', userId] });`
New: `queryClient.invalidateQueries({ queryKey: ['display-envelope', userId] });`

Lines 107 (`!display` loading gate) and 146 (`display!.hrZones`) are unchanged — both fields still exist.

- [ ] **Step 6: `useThresholdAnchor.ts`**

Current (lines 41-47):
```ts
    // A saved/cleared anchor invalidates its own cache AND the derived display-zones
    // cache (Task 2's key) — every other open/next-visited screen (Home, run screen,
    // plan-preview) reflects the correction immediately, no restart needed.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['threshold-anchor', userId] }),
        queryClient.invalidateQueries({ queryKey: ['display-zones', userId] }),
      ]),
```
New:
```ts
    // A saved/cleared anchor invalidates its own cache AND the derived
    // display-envelope cache — every other open/next-visited screen (Home,
    // run screen, plan-preview) reflects the correction immediately, no
    // restart needed.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['threshold-anchor', userId] }),
        queryClient.invalidateQueries({ queryKey: ['display-envelope', userId] }),
      ]),
```

This file has no import of the hook itself (it only shares the query-cache key by string) — found by grepping the whole app for the literal `'display-zones'` string, not by searching for hook usage. Without this change, saving or clearing a baseline anchor would stop invalidating the envelope cache, leaving stale zones/prescriptions displayed until the 5-minute `staleTime` naturally expires.

- [ ] **Step 7: Run the full suite**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest`
Expected: PASS, 43 test suites, 397 tests — in particular `src/screens/__tests__/DailySummary.test.tsx` and `app/__tests__/plan-preview.test.tsx` (the only two of these six files with dedicated test coverage) stay green with zero test-file changes, proving the rename didn't alter behavior.

- [ ] **Step 8: Typecheck**

Run: `cd OSPREY-app && npx tsc --noEmit`
Expected: no errors. (`useDisplayZones.ts` still exists — untouched — so `ZonesCard.tsx`, the one remaining consumer, still compiles against it until Task 3.)

- [ ] **Step 9: Commit**

```bash
git add OSPREY-app/src/screens/DailySummary.tsx OSPREY-app/app/plan-preview.tsx "OSPREY-app/app/(tabs)/workout.tsx" OSPREY-app/app/workout/run.tsx OSPREY-app/app/training-baseline.tsx OSPREY-app/src/hooks/useThresholdAnchor.ts
git commit -m "refactor(mobile): migrate 6 mechanical consumers to useDisplayEnvelope"
```

---

## Task 3: Migrate `ZonesCard.tsx` (new guard) + delete the old hook file

The one file that needs real logic, not just a rename: it's the sole current consumer relying on the old hook's implicit "null for lift" behavior. Per the Global Constraints correction above, the actual required guard is narrower and simpler than the original spec assumed.

**Files:**
- Modify: `OSPREY-app/src/components/ZonesCard.tsx`
- Modify: `OSPREY-app/src/services/pace-format.ts:4` (stale comment reference)
- Delete: `OSPREY-app/src/hooks/useDisplayZones.ts`
- Test: `OSPREY-app/src/components/__tests__/ZonesCard.test.tsx`

**Interfaces:**
- Consumes: `useDisplayEnvelope`, `type DisplayEnvelope` from `@/hooks/useDisplayEnvelope` (Task 1).
- Produces: nothing new for other files — `ZonesCard`'s exported component signature is unchanged (`export function ZonesCard(): JSX.Element | null`).

- [ ] **Step 1: Write the failing tests**

Create `OSPREY-app/src/components/__tests__/ZonesCard.test.tsx`:

```tsx
jest.mock('@/hooks/useDisplayEnvelope', () => ({ useDisplayEnvelope: jest.fn() }));
jest.mock('@/hooks/useTrainingGoal', () => ({ useTrainingGoal: jest.fn() }));
jest.mock('@/hooks/useUnitPreference', () => ({ useUnitPreference: () => ({ units: 'imperial' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { renderWithProviders as render, screen } from '@/test-utils/render';
import { ZonesCard } from '@/components/ZonesCard';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';

const mockDisplay = useDisplayEnvelope as jest.Mock;
const mockGoal = useTrainingGoal as jest.Mock;

const HR_ZONES = {
  maxHR: 190,
  source: 'estimated' as const,
  // UltraHRZones' real field names (src/services/calculators/ultra.ts) — only
  // z2Endurance/z4Threshold are actually read by rowsForZones' HR-fallback
  // branch, but all 5 must be present and correctly named for this object to
  // type-check as HrZoneInfo.
  bands: {
    maxHR: 190,
    z1Recovery: { min: null, max: 133 },
    z2Endurance: { min: 133, max: 152 },
    z3SteadyMarathon: { min: 152, max: 162 },
    z4Threshold: { min: 162, max: 171 },
    z5Vo2Hills: { min: 171, max: null },
  },
};

function envelope(overrides: Partial<DisplayEnvelope>): DisplayEnvelope {
  return {
    sport: 'run',
    phase: 'Base',
    weekNumber: 1,
    totalWeeks: 8,
    targetWeeklyLoad: 200,
    hardSessionShareMax: 0.2,
    zones: null,
    hrZones: HR_ZONES,
    fuel: {
      dailyCarbGByDayType: { easy: { min: 0, max: 0 }, moderate: { min: 0, max: 0 }, high: { min: 0, max: 0 }, peak: { min: 0, max: 0 } },
      proteinG: { min: 0, max: 0 },
      longSessionCarbGPerHour: 0,
    },
    strength: null,
    hyrox: null,
    crossfit: null,
    confidence: 'estimated',
    ...overrides,
  };
}

beforeEach(() => {
  mockGoal.mockReturnValue({ data: { primaryGoal: 'run' } });
});

describe('ZonesCard — sport coverage (representative case per distinct rendering path)', () => {
  it('shows real run pace zones for a run goal', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'run',
      zones: { kind: 'run', thresholdSecPerMile: 480, bands: { easy: { min: 570, max: 630 } } } as never,
      confidence: 'measured',
    }));
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('Threshold')).toBeTruthy();
  });

  it('shows real run pace zones for hyrox (blueprintSport maps hyrox -> run, unchanged from today)', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'hyrox',
      zones: { kind: 'run', thresholdSecPerMile: 480, bands: { easy: { min: 570, max: 630 } } } as never,
    }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'hyrox' } });
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
  });

  it('shows the HR-bpm fallback card for crossfit (no pace/power blueprint, unchanged from today)', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'crossfit', zones: null }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'crossfit' } });
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
    expect(screen.getByText('Easy')).toBeTruthy(); // the HR-fallback row label
  });

  it('shows the HR-bpm fallback card for weight_loss', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'weight_loss', zones: null }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'weight_loss' } });
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
  });

  it('shows real watts zones for cycling with a self-reported FTP', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'cycling',
      zones: { kind: 'cycling', ftpWatts: 220, bands: { z2Endurance: { min: 100, max: 140 }, z4Threshold: { min: 190, max: 220 } } } as never,
      confidence: 'measured',
    }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'cycling' } });
    render(<ZonesCard />);
    expect(screen.getByText('Endurance')).toBeTruthy();
  });

  it('shows the compact per-discipline card for triathlon', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'triathlon',
      zones: {
        kind: 'triathlon',
        run: { kind: 'run', thresholdSecPerMile: 480, bands: {} as never },
        swim: { kind: 'swim', cssSecPer100: 90, bands: {} as never },
        bike: null,
      } as never,
    }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'triathlon' } });
    render(<ZonesCard />);
    expect(screen.getByText('Run')).toBeTruthy();
    expect(screen.getByText('Swim')).toBeTruthy();
  });

  it('renders nothing for a lift goal — the one sport whose card presence changes', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'lift', zones: null }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    render(<ZonesCard />);
    expect(screen.queryByText('YOUR ZONES')).toBeNull();
  });

  it('renders nothing while the hook is still loading', () => {
    mockDisplay.mockReturnValue(null);
    render(<ZonesCard />);
    expect(screen.queryByText('YOUR ZONES')).toBeNull();
  });
});
```

(swim/rowing/ultra/hybrid/general_fitness are not separately enumerated — each follows the exact same code path as one of the cases above: swim/rowing are more instances of "real zones render," ultra/hybrid are more instances of "blueprintSport maps to run," general_fitness is another instance of the HR-fallback bucket. The 8 cases above cover every *distinct* rendering path the component has.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/components/__tests__/ZonesCard.test.tsx`
Expected: FAIL — `Cannot find module '@/hooks/useDisplayEnvelope'` is already resolved by Task 1, so the actual failure here is the mocked module shape not matching `ZonesCard.tsx`'s still-current `useDisplayZones` import (the mock targets a hook `ZonesCard.tsx` doesn't call yet), OR most of the sport-coverage assertions fail because the guard doesn't exist yet. Confirm at least one red test before proceeding.

- [ ] **Step 3: Update `ZonesCard.tsx`**

Current:
```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';
import { useDisplayZones } from '@/hooks/useDisplayZones';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { rowsForZones } from '@/services/coaching/zone-rows';
import { blueprintSport } from '@/services/coaching/zones';
import type { PrimaryGoalEnum } from '@/services/coaching/goal-map';

/** Compact "Your zones" card for the plan-preview — renders nothing while the
 * hook is loading, for a `lift` goal, or on any read error (useDisplayZones
 * returns null in all three cases; there's no way to tell them apart here,
 * which is fine — "no card" is the correct display for all three). */
export function ZonesCard(): JSX.Element | null {
  const display = useDisplayZones();
  const { data: goal } = useTrainingGoal();
  const { units } = useUnitPreference();
  const router = useRouter();

  if (!display) return null;
  const rows = rowsForZones(display.zones, display.hrZones, units);
  if (rows.length === 0) return null;
  const isEstimated = display.confidence === 'estimated';
```

New:
```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';
import { useDisplayEnvelope } from '@/hooks/useDisplayEnvelope';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { rowsForZones } from '@/services/coaching/zone-rows';
import { blueprintSport } from '@/services/coaching/zones';
import type { PrimaryGoalEnum } from '@/services/coaching/goal-map';

/** Compact "Your zones" card for the plan-preview — renders nothing while the
 * hook is loading, on any read error, or for a `lift` goal (the only sport
 * with no pace/power blueprint AND no HR-fallback use case — every other
 * sport shows either real zones or the HR-bpm fallback card). Guards on
 * `display.sport` rather than a separate useTrainingGoal() read so there's
 * no race between the two hooks' load times. */
export function ZonesCard(): JSX.Element | null {
  const display = useDisplayEnvelope();
  const { data: goal } = useTrainingGoal();
  const { units } = useUnitPreference();
  const router = useRouter();

  if (!display || display.sport === 'lift') return null;
  const rows = rowsForZones(display.zones, display.hrZones, units);
  if (rows.length === 0) return null;
  const isEstimated = display.confidence === 'estimated';
```

Everything below this point in the file (the `primaryGoal`/`canSetBaseline` computation, the JSX, the styles) is unchanged — it doesn't reference `useDisplayZones` and doesn't need to change.

- [ ] **Step 4: Update the stale comment in `pace-format.ts`**

Current (line 4): `// Canonical mile↔km ratio (matches useDisplayZones.ts / services/units.ts).`
New: `// Canonical mile↔km ratio (matches useDisplayEnvelope.ts / services/units.ts).`

- [ ] **Step 5: Delete the old hook file**

```bash
git rm OSPREY-app/src/hooks/useDisplayZones.ts
```

(Safe now — Task 2 already migrated every other consumer; `ZonesCard.tsx`, just updated in Step 3, was the last one.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/components/__tests__/ZonesCard.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 7: Run the full suite + typecheck**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest && npx tsc --noEmit`
Expected: PASS, 44 test suites, 405 tests (397 after Task 2 + 8 new). No typecheck errors — confirms nothing else still imports the deleted `useDisplayZones.ts`.

- [ ] **Step 8: Commit**

```bash
git add OSPREY-app/src/components/ZonesCard.tsx OSPREY-app/src/components/__tests__/ZonesCard.test.tsx OSPREY-app/src/services/pace-format.ts
git rm OSPREY-app/src/hooks/useDisplayZones.ts
git commit -m "refactor(mobile): move the lift guard from the hook to ZonesCard, delete old hook"
```

---

## Task 4: `app/your-numbers.tsx` — scaffold, training context, fuel

Builds the new screen with the two sections that apply to every sport identically (no per-sport branching yet — that's Task 5). This is a complete, correct, independently shippable deliverable: an athlete of any sport who opens this screen today (after this task) sees their real phase/week/load and real fuel targets.

**Files:**
- Create: `OSPREY-app/app/your-numbers.tsx`
- Test: `OSPREY-app/app/__tests__/your-numbers.test.tsx`

**Interfaces:**
- Consumes: `useDisplayEnvelope` (Task 1); `intRange` from `@/services/pace-format`; `EnduranceDayType` from `@/services/calculators/shared`.
- Produces: `export default function YourNumbersScreen()`. Task 5 extends this same file, adding a `section` variable and 3 new sub-components after the `<FuelSection>` render Task 4 establishes.

- [ ] **Step 1: Write the failing tests**

Create `OSPREY-app/app/__tests__/your-numbers.test.tsx`:

```tsx
jest.mock('@/hooks/useDisplayEnvelope', () => ({ useDisplayEnvelope: jest.fn() }));
jest.mock('@/hooks/useTrainingGoal', () => ({ useTrainingGoal: jest.fn(() => ({ data: { primaryGoal: 'run' } })) }));
jest.mock('@/hooks/useUnitPreference', () => ({ useUnitPreference: () => ({ units: 'imperial' }) }));

import { renderWithProviders as render, screen } from '@/test-utils/render';
import YourNumbersScreen from '@/../app/your-numbers';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';

const mockDisplay = useDisplayEnvelope as jest.Mock;

function envelope(overrides: Partial<DisplayEnvelope>): DisplayEnvelope {
  return {
    sport: 'run',
    phase: 'Build',
    weekNumber: 4,
    totalWeeks: 12,
    targetWeeklyLoad: 320,
    hardSessionShareMax: 0.2,
    zones: null,
    hrZones: { maxHR: 190, source: 'estimated', bands: {} as never },
    fuel: {
      dailyCarbGByDayType: {
        easy: { min: 210, max: 350 },
        moderate: { min: 350, max: 490 },
        high: { min: 560, max: 700 },
        peak: { min: 700, max: 840 },
      },
      proteinG: { min: 112, max: 154 },
      longSessionCarbGPerHour: 60,
    },
    strength: null,
    hyrox: null,
    crossfit: null,
    confidence: 'measured',
    ...overrides,
  };
}

describe('YourNumbersScreen — training context + fuel (every sport)', () => {
  it('renders a loading state when the envelope has not resolved yet', () => {
    mockDisplay.mockReturnValue(null);
    render(<YourNumbersScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('shows phase, week, and target load', () => {
    mockDisplay.mockReturnValue(envelope({}));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Build')).toBeTruthy();
    expect(screen.getByText('4 of 12')).toBeTruthy();
    expect(screen.getByText('320')).toBeTruthy();
  });

  it('shows fuel targets by day type and protein', () => {
    mockDisplay.mockReturnValue(envelope({}));
    render(<YourNumbersScreen />);
    expect(screen.getByText('210–350 g carbs')).toBeTruthy();
    expect(screen.getByText('700–840 g carbs')).toBeTruthy();
    expect(screen.getByText('112–154 g')).toBeTruthy();
  });

  it('shows the in-session carb rate when the sport has one', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'run' }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('60 g/hr')).toBeTruthy();
  });

  it('hides the in-session carb row when the sport has none (lift)', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'lift', fuel: { ...envelope({}).fuel, longSessionCarbGPerHour: 0 } }));
    render(<YourNumbersScreen />);
    expect(screen.queryByText(/g\/hr/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest app/__tests__/your-numbers.test.tsx`
Expected: FAIL — `Cannot find module '@/../app/your-numbers'` (the file doesn't exist yet).

- [ ] **Step 3: Write the screen**

Create `OSPREY-app/app/your-numbers.tsx`:

```tsx
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import { Card } from '@/components/ui';
import ScreenHeader from '@/components/ScreenHeader';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';
import { intRange } from '@/services/pace-format';
import type { FuelPlan } from '@/services/coaching/fuel';
import type { EnduranceDayType } from '@/services/calculators/shared';

const DAY_TYPE_LABEL: Record<EnduranceDayType, string> = {
  easy: 'Easy days',
  moderate: 'Moderate days',
  high: 'High-volume days',
  peak: 'Peak / race week',
};

const DAY_TYPES: EnduranceDayType[] = ['easy', 'moderate', 'high', 'peak'];

const IN_SESSION_LABEL: Record<string, string> = {
  run: 'on long runs',
  hybrid: 'on long runs',
  ultra: 'on long runs',
  cycling: 'on long rides',
  swim: 'on meet day',
  triathlon: 'on race day',
  hyrox: 'on race day',
  crossfit: 'on long metcons',
};

export default function YourNumbersScreen() {
  const display = useDisplayEnvelope();

  if (!display) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Your Numbers" />
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Your Numbers" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TrainingContextSection envelope={display} />
        <FuelSection fuel={display.fuel} sport={display.sport} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TrainingContextSection({ envelope }: { envelope: DisplayEnvelope }) {
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>TRAINING CONTEXT</Text>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Phase</Text>
        <Text style={styles.contextValue}>{envelope.phase}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Week</Text>
        <Text style={styles.contextValue}>{envelope.weekNumber} of {envelope.totalWeeks}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Target weekly load</Text>
        <Text style={styles.contextValue}>{envelope.targetWeeklyLoad}</Text>
      </View>
    </Card>
  );
}

function FuelSection({ fuel, sport }: { fuel: FuelPlan; sport: string }) {
  const inSessionLabel = IN_SESSION_LABEL[sport] ?? 'in long sessions';
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>FUEL</Text>
      {DAY_TYPES.map((dt) => (
        <View key={dt} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{DAY_TYPE_LABEL[dt]}</Text>
          <Text style={styles.contextValue}>{intRange(fuel.dailyCarbGByDayType[dt], 'g carbs')}</Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Protein</Text>
        <Text style={styles.contextValue}>{intRange(fuel.proteinG, 'g')}</Text>
      </View>
      {fuel.longSessionCarbGPerHour > 0 ? (
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>In-session, {inSessionLabel}</Text>
          <Text style={styles.contextValue}>{fuel.longSessionCarbGPerHour} g/hr</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { padding: 16, gap: 16 },
  cardGap: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.accent,
    letterSpacing: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextLabel: { fontSize: 13, fontWeight: '600', color: Theme.textSoft, flex: 1 },
  contextValue: { fontSize: 14, fontWeight: '800', color: Theme.text },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest app/__tests__/your-numbers.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest && npx tsc --noEmit`
Expected: PASS, 45 test suites, 410 tests (405 after Task 3 + 5 new). No typecheck errors.

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/app/your-numbers.tsx OSPREY-app/app/__tests__/your-numbers.test.tsx
git commit -m "feat(mobile): add Your Numbers screen — training context + fuel sections"
```

---

## Task 5: Sport-specific prescription section (Strength / Hyrox / CrossFit)

Extends `your-numbers.tsx` with the one part of the spec that's genuinely new to the app: the actual per-sport prescription detail. Introduces a small, pure, independently-testable selector function (mirroring `zone-rows.ts`'s pattern) rather than inlining the branching logic in the screen.

**Files:**
- Create: `OSPREY-app/src/services/coaching/prescription-section.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/prescription-section.test.ts`
- Modify: `OSPREY-app/app/your-numbers.tsx`
- Modify: `OSPREY-app/app/__tests__/your-numbers.test.tsx`

**Interfaces:**
- Consumes: `PrimaryGoalEnum` from `@/services/coaching/goal-map`; `StrengthPrescription` from `@/services/coaching/strength`; `HyroxPrescription` from `@/services/coaching/hyrox`; `HyroxDivision`, `HyroxStationWeights` from `@/services/calculators/hyrox`; `CrossfitPrescription` from `@/services/coaching/crossfit`; `BenchmarkTier` from `@/services/calculators/crossfit`; `Range` from `@/services/calculators/types`; `formatWeightKg` from `@/services/units`; `kgToLb` from `@/services/body-metrics`; `useTrainingGoal` from `@/hooks/useTrainingGoal`; `useUnitPreference` from `@/hooks/useUnitPreference`.
- Produces: `export type PrescriptionSection = 'strength' | 'hyrox' | 'crossfit' | null`; `export function prescriptionSectionForSport(primaryGoal: string | null): PrescriptionSection`.

- [ ] **Step 1: Write the failing test for the pure selector**

Create `OSPREY-app/src/services/coaching/__tests__/prescription-section.test.ts`:

```ts
import { prescriptionSectionForSport } from '@/services/coaching/prescription-section';

describe('prescriptionSectionForSport', () => {
  it('maps lift to strength', () => {
    expect(prescriptionSectionForSport('lift')).toBe('strength');
  });
  it('maps hyrox to hyrox', () => {
    expect(prescriptionSectionForSport('hyrox')).toBe('hyrox');
  });
  it('maps crossfit to crossfit', () => {
    expect(prescriptionSectionForSport('crossfit')).toBe('crossfit');
  });
  it.each([
    'run', 'swim', 'rowing', 'cycling', 'triathlon', 'ultra', 'hybrid', 'weight_loss', 'general_fitness',
  ])('maps %s to null (endurance-only — no sport-specific section)', (sport) => {
    expect(prescriptionSectionForSport(sport)).toBeNull();
  });
  it('maps an unset goal to null', () => {
    expect(prescriptionSectionForSport(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/prescription-section.test.ts`
Expected: FAIL — `Cannot find module '@/services/coaching/prescription-section'`.

- [ ] **Step 3: Write the selector**

Create `OSPREY-app/src/services/coaching/prescription-section.ts`:

```ts
export type PrescriptionSection = 'strength' | 'hyrox' | 'crossfit' | null;

/** Which of the 3 sport-specific prescription sections (if any) your-numbers.tsx
 *  shows. Every other sport is endurance-only — already well-served by ZonesCard's
 *  pace/HR zones, so this screen doesn't duplicate a fuller breakdown for them. */
export function prescriptionSectionForSport(primaryGoal: string | null): PrescriptionSection {
  if (primaryGoal === 'lift') return 'strength';
  if (primaryGoal === 'hyrox') return 'hyrox';
  if (primaryGoal === 'crossfit') return 'crossfit';
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/prescription-section.test.ts`
Expected: PASS, 13 tests (3 individual + 9-sport `it.each` + 1 unset-goal case).

- [ ] **Step 5: Write the failing tests for the 3 new sections**

Append to `OSPREY-app/app/__tests__/your-numbers.test.tsx` (after the existing `jest.mock` calls at the top, change the `useTrainingGoal` mock to a plain `jest.fn()` so individual tests can control it — replace the existing mock line with `jest.mock('@/hooks/useTrainingGoal', () => ({ useTrainingGoal: jest.fn() }));` and add `const mockGoal = useTrainingGoal as jest.Mock;` plus the import `import { useTrainingGoal } from '@/hooks/useTrainingGoal';` near the top; add `beforeEach(() => { mockGoal.mockReturnValue({ data: { primaryGoal: 'run' } }); });` so the existing Task 4 tests keep passing unchanged):

```tsx
describe('YourNumbersScreen — Strength section', () => {
  it('shows an empty state for a paramless lifter', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'lift', strength: null }));
    render(<YourNumbersScreen />);
    expect(screen.getByText(/enter your squat, bench, and deadlift 1RMs/)).toBeTruthy();
  });

  it('shows working loads, zone, Prilepin, and fat target for a real lifter', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'lift',
      strength: {
        oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 },
        workingPercent1RM: 80,
        zone: { name: 'Strength-Volume', percent1RM: [75, 85], reps: [3, 6], rpe: [7, 8], rir: [2, 3] },
        prilepin: { repsPerSet: [2, 4], totalReps: [10, 20] },
        fatG: { min: 56, max: 105 },
        attempts: null,
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Strength-Volume · 80% 1RM')).toBeTruthy();
    // Working load = round(140 * 80 / 100) = 112kg. Imperial units, so the
    // screen shows formatWeightKg(112, 'imperial') = `${kgToLb(112)} lbs`.
    // kgToLb(112) = round(112 * 2.2046226218 * 10) / 10 = 246.9.
    expect(screen.getByText('246.9 lbs')).toBeTruthy();
  });
});
```

```tsx
describe('YourNumbersScreen — Hyrox section', () => {
  it('shows an empty state without a division', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'hyrox' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'hyrox', hyrox: null }));
    render(<YourNumbersScreen />);
    expect(screen.getByText(/pick your division/)).toBeTruthy();
  });

  it('shows division, station weights, and compromised pace', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'hyrox' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'hyrox',
      hyrox: {
        division: 'open_men',
        compromisedRunSplitSecPerKm: { min: 295, max: 310 },
        stationWeights: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
        sodiumMgPerHour: { min: 500, max: 1000 },
        caffeineMg: { min: 210, max: 420 },
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Open Men')).toBeTruthy();
    expect(screen.getByText('Sled push')).toBeTruthy();
    expect(screen.getByText(/4:55.*5:10\/km/)).toBeTruthy();
  });
});

describe('YourNumbersScreen — CrossFit section', () => {
  it('shows an empty state without goal params', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'crossfit' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'crossfit', crossfit: null }));
    render(<YourNumbersScreen />);
    expect(screen.getByText(/enter your CrossFit numbers/)).toBeTruthy();
  });

  it('shows strength loads, energy systems, and Fran tier', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'crossfit' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'crossfit',
      crossfit: {
        strengthLoadsKg: { backSquat: 109, deadlift: 140, press: 47 },
        workingPercent1RM: 78,
        zoneName: 'Hypertrophy',
        energySystems: [
          { system: 'Phosphagen / alactic', minDurationSec: 0, maxDurationSec: 15, workToRest: '1:5-1:10', purpose: 'Power, speed' },
        ],
        benchmark: { name: 'Fran', timeDomain: 'short', athleteFranSec: 200, franTier: 'intermediate' },
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Phosphagen / alactic')).toBeTruthy();
    expect(screen.getByText('Fran')).toBeTruthy();
    expect(screen.getByText('Intermediate')).toBeTruthy();
  });
});

describe('YourNumbersScreen — endurance sports show no sport-specific section', () => {
  it('renders no Strength/Hyrox/CrossFit heading for a run goal', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'run' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'run' }));
    render(<YourNumbersScreen />);
    expect(screen.queryByText('STRENGTH')).toBeNull();
    expect(screen.queryByText('HYROX')).toBeNull();
    expect(screen.queryByText('CROSSFIT')).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest app/__tests__/your-numbers.test.tsx`
Expected: FAIL — the new sections don't exist yet (`getByText` throws "Unable to find an element").

- [ ] **Step 7: Extend `your-numbers.tsx`**

Add these imports alongside the existing ones at the top of `OSPREY-app/app/your-numbers.tsx`:

```tsx
import { useTrainingGoal } from '@/hooks/useTrainingGoal';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatWeightKg, type UnitSystem } from '@/services/units';
import { kgToLb } from '@/services/body-metrics';
import { formatMinSec, type Range } from '@/services/calculators/types';
import { prescriptionSectionForSport } from '@/services/coaching/prescription-section';
import type { PrimaryGoalEnum } from '@/services/coaching/goal-map';
import type { StrengthPrescription } from '@/services/coaching/strength';
import type { HyroxPrescription } from '@/services/coaching/hyrox';
import type { HyroxDivision, HyroxStationWeights } from '@/services/calculators/hyrox';
import type { CrossfitPrescription } from '@/services/coaching/crossfit';
import type { BenchmarkTier } from '@/services/calculators/crossfit';
```

Replace the `YourNumbersScreen` function body with:

```tsx
export default function YourNumbersScreen() {
  const display = useDisplayEnvelope();
  const { data: goal } = useTrainingGoal();
  const { units } = useUnitPreference();

  if (!display) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Your Numbers" />
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  const primaryGoal = (goal?.primaryGoal ?? null) as PrimaryGoalEnum | null;
  const section = prescriptionSectionForSport(primaryGoal);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Your Numbers" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TrainingContextSection envelope={display} />
        {section === 'strength' ? <StrengthSection strength={display.strength} units={units} /> : null}
        {section === 'hyrox' ? <HyroxSection hyrox={display.hyrox} units={units} /> : null}
        {section === 'crossfit' ? <CrossfitSection crossfit={display.crossfit} units={units} /> : null}
        <FuelSection fuel={display.fuel} sport={display.sport} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

Add these new functions after `FuelSection` (before the `styles` constant):

```tsx
/** kg range -> one unit-aware string ("185–195 kg" / "408–430 lbs"), sharing
 *  one unit suffix rather than repeating it per bound. Mirrors formatWeightKg's
 *  own per-unit-system rounding (kgToLb already rounds to 1 decimal). */
function weightRange(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  if (units === 'metric') return `${Math.round(range.min * 10) / 10}–${Math.round(range.max * 10) / 10} kg`;
  return `${kgToLb(range.min)}–${kgToLb(range.max)} lbs`;
}

function secRange(range: Range, suffix: string): string {
  if (range.min == null || range.max == null) return '—';
  return `${formatMinSec(range.min)}–${formatMinSec(range.max)}${suffix}`;
}

const STRENGTH_LIFTS: { key: 'squat' | 'bench' | 'deadlift'; label: string }[] = [
  { key: 'squat', label: 'Squat' },
  { key: 'bench', label: 'Bench' },
  { key: 'deadlift', label: 'Deadlift' },
];

function StrengthSection({ strength, units }: { strength: StrengthPrescription | null; units: UnitSystem }) {
  if (!strength) {
    return (
      <Card style={styles.cardGap}>
        <Text style={styles.sectionLabel}>STRENGTH</Text>
        <Text style={styles.hint}>Not set — enter your squat, bench, and deadlift 1RMs in Preferences to see your working loads and zones.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>STRENGTH</Text>
      <Text style={styles.hint}>{strength.zone.name} · {strength.workingPercent1RM}% 1RM</Text>
      {STRENGTH_LIFTS.map(({ key, label }) => (
        <View key={key} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{label}</Text>
          <Text style={styles.contextValue}>
            {strength.oneRepMaxKg[key] > 0
              ? formatWeightKg(Math.round((strength.oneRepMaxKg[key] * strength.workingPercent1RM) / 100), units)
              : 'Not set'}
          </Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Reps</Text>
        <Text style={styles.contextValue}>{strength.zone.reps[0]}–{strength.zone.reps[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>RPE</Text>
        <Text style={styles.contextValue}>{strength.zone.rpe[0]}–{strength.zone.rpe[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>RIR</Text>
        <Text style={styles.contextValue}>{strength.zone.rir[0]}–{strength.zone.rir[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Prilepin reps/set</Text>
        <Text style={styles.contextValue}>{strength.prilepin.repsPerSet[0]}–{strength.prilepin.repsPerSet[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Prilepin total reps</Text>
        <Text style={styles.contextValue}>{strength.prilepin.totalReps[0]}–{strength.prilepin.totalReps[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Daily fat target</Text>
        <Text style={styles.contextValue}>{intRange(strength.fatG, 'g')}</Text>
      </View>
      {strength.attempts ? (
        <>
          <Text style={styles.subLabel}>ATTEMPT PLAN</Text>
          {STRENGTH_LIFTS.map(({ key, label }) => {
            const plan = strength.attempts![key];
            return (
              <View key={key} style={styles.attemptBlock}>
                <Text style={styles.contextLabel}>{label}</Text>
                <Text style={styles.hint}>
                  Opener {weightRange(plan.opener, units)} · Second {weightRange(plan.second, units)} · Third {weightRange(plan.third, units)}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}
    </Card>
  );
}

const HYROX_DIVISION_LABEL: Record<HyroxDivision, string> = {
  open_men: 'Open Men',
  open_women: 'Open Women',
  pro_men: 'Pro Men',
  pro_women: 'Pro Women',
  doubles_men: 'Doubles Men',
  doubles_women: 'Doubles Women',
  doubles_mixed: 'Doubles Mixed',
};

const HYROX_STATION_LABEL: Record<keyof HyroxStationWeights, string> = {
  sledPushKg: 'Sled push',
  sledPullKg: 'Sled pull',
  farmersCarryPerHandKg: 'Farmers carry (per hand)',
  sandbagLungesKg: 'Sandbag lunges',
  wallBallKg: 'Wall ball',
};

function HyroxSection({ hyrox, units }: { hyrox: HyroxPrescription | null; units: UnitSystem }) {
  if (!hyrox) {
    return (
      <Card style={styles.cardGap}>
        <Text style={styles.sectionLabel}>HYROX</Text>
        <Text style={styles.hint}>Not set — pick your division in Preferences to see your station weights and compromised run pace.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>HYROX</Text>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Division</Text>
        <Text style={styles.contextValue}>{HYROX_DIVISION_LABEL[hyrox.division]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Compromised run pace</Text>
        <Text style={styles.contextValue}>{secRange(hyrox.compromisedRunSplitSecPerKm, '/km')}</Text>
      </View>
      <Text style={styles.subLabel}>STATION WEIGHTS</Text>
      {(Object.keys(hyrox.stationWeights) as (keyof HyroxStationWeights)[]).map((key) => (
        <View key={key} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{HYROX_STATION_LABEL[key]}</Text>
          <Text style={styles.contextValue}>{formatWeightKg(hyrox.stationWeights[key], units)}</Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Sodium</Text>
        <Text style={styles.contextValue}>{intRange(hyrox.sodiumMgPerHour, 'mg/hr')}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Caffeine</Text>
        <Text style={styles.contextValue}>{intRange(hyrox.caffeineMg, 'mg')}</Text>
      </View>
    </Card>
  );
}

const CROSSFIT_LIFTS: { key: 'backSquat' | 'deadlift' | 'press'; label: string }[] = [
  { key: 'backSquat', label: 'Back squat' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'press', label: 'Press' },
];

const CROSSFIT_TIER_LABEL: Record<BenchmarkTier, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite',
};

function CrossfitSection({ crossfit, units }: { crossfit: CrossfitPrescription | null; units: UnitSystem }) {
  if (!crossfit) {
    return (
      <Card style={styles.cardGap}>
        <Text style={styles.sectionLabel}>CROSSFIT</Text>
        <Text style={styles.hint}>Not set — enter your CrossFit numbers in Preferences to see your working loads and benchmark tier.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>CROSSFIT</Text>
      <Text style={styles.hint}>{crossfit.zoneName} · {crossfit.workingPercent1RM}% 1RM</Text>
      {CROSSFIT_LIFTS.map(({ key, label }) => (
        <View key={key} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{label}</Text>
          <Text style={styles.contextValue}>
            {crossfit.strengthLoadsKg[key] > 0 ? formatWeightKg(crossfit.strengthLoadsKg[key], units) : 'Not set'}
          </Text>
        </View>
      ))}
      <Text style={styles.subLabel}>ENERGY SYSTEMS</Text>
      {crossfit.energySystems.map((z) => (
        <View key={z.system} style={styles.energyRow}>
          <Text style={styles.contextLabel}>{z.system}</Text>
          <Text style={styles.hint}>{z.minDurationSec}–{z.maxDurationSec ?? '∞'}s · {z.workToRest} · {z.purpose}</Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Benchmark</Text>
        <Text style={styles.contextValue}>{crossfit.benchmark.name}</Text>
      </View>
      {crossfit.benchmark.franTier ? (
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>Fran tier</Text>
          <Text style={styles.contextValue}>{CROSSFIT_TIER_LABEL[crossfit.benchmark.franTier]}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>Not set — enter your Fran time in Preferences to see your benchmark tier.</Text>
      )}
    </Card>
  );
}
```

Add these new style entries inside the existing `StyleSheet.create({...})` call (alongside `contextValue`):

```tsx
  subLabel: { fontSize: 11, fontWeight: '700', color: Theme.textMut, letterSpacing: 1, marginTop: 6 },
  hint: { fontSize: 12, color: Theme.textMut, lineHeight: 16 },
  attemptBlock: { gap: 2 },
  energyRow: { gap: 2 },
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest app/__tests__/your-numbers.test.tsx`
Expected: PASS, 12 tests (5 from Task 4 + 7 new).

- [ ] **Step 9: Run the full suite + typecheck**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest && npx tsc --noEmit`
Expected: PASS, 46 test suites, 430 tests (410 after Task 4 + 13 new selector tests + 7 new screen tests — recount exactly from the actual run; this plan has already had two count-arithmetic slips caught only after the fact, so treat every "Expected" count in this document as a sanity check to verify against the real run, not a number to trust blindly). No typecheck errors.

- [ ] **Step 10: Commit**

```bash
git add OSPREY-app/src/services/coaching/prescription-section.ts OSPREY-app/src/services/coaching/__tests__/prescription-section.test.ts OSPREY-app/app/your-numbers.tsx OSPREY-app/app/__tests__/your-numbers.test.tsx
git commit -m "feat(mobile): add Strength/Hyrox/CrossFit prescription sections to Your Numbers"
```

---

## Task 6: Entry point — Settings row

**Files:**
- Modify: `OSPREY-app/app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: nothing new (uses the existing `router` already in scope in this file).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add the row**

In `OSPREY-app/app/(tabs)/settings.tsx`, insert immediately after the "Training Preferences" `TouchableOpacity` closes (after the current line 564, `</TouchableOpacity>`) and before the existing `{blueprintSport(goal?.primaryGoal ?? '') != null || ...` conditional block (current line 566) — unlike that block and the Hyrox-quiz block below it, this row has no sport gate:

```tsx
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.planRow}
            onPress={() => router.push('/your-numbers')}
            accessibilityRole="button"
            accessibilityLabel="Your numbers"
          >
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>Your Numbers</Text>
              <Text style={styles.planRowSub}>Working loads, fuel targets, and your full prescription</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
```

- [ ] **Step 2: Run the full suite + typecheck**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest && npx tsc --noEmit`
Expected: PASS, same 46 test suites, 430 tests (settings.tsx has no dedicated test file, so this is a compile-only check). No typecheck errors.

- [ ] **Step 3: Commit**

```bash
git add "OSPREY-app/app/(tabs)/settings.tsx"
git commit -m "feat(mobile): add always-visible Your Numbers entry point to Settings"
```

---

## Task 7: Live verification

Controller-executed directly (not dispatched to a subagent), consistent with how deploy/live-verification checkpoints have been handled for every prior plan this session — no production deploy is needed here (no edge-function or migration changes), but real-account confirmation still matters more than a passing test suite alone.

**Files:** none (verification only).

- [ ] **Step 1: Full regression check**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest && npx tsc --noEmit && npm run lint`
Expected: all three pass clean. (`npm run lint` only covers `src/`, matching `package.json`'s existing script — a pre-existing repo characteristic, not something to widen as part of this plan.)

- [ ] **Step 2: Visual verification on the real account**

Using the iOS Simulator (or the project's existing web-preview path, whichever is actually available in this environment at execution time — the acceptance criteria below are tool-agnostic):
1. Launch the app signed in as the real account (`run` goal — the user's actual training profile).
2. Navigate Settings → "Your Numbers." Confirm: the row is visible without any sport gate; the screen shows a real phase/week/target-load matching what the Home dashboard and plan-preview already show for the same account; the fuel section shows non-zero, sane carb/protein ranges and a non-zero in-session rate (run has one).
3. Confirm no Strength/Hyrox/CrossFit section renders for this run-goal account (per Task 5's "endurance sports show no sport-specific section" test, now confirmed live too).
4. Navigate to Home and to plan-preview. Confirm the "Your Zones" card renders exactly as it did before this plan (same pace values, same "Estimated" tag state) — this is the byte-identity constraint's real-world proof, not just the test suite's.

- [ ] **Step 3: Visual verification of the 3 sport-specific sections**

The real account's own sport won't exercise Strength/Hyrox/CrossFit, so verify these via a temporary, never-committed local substitution rather than skipping them:
1. Temporarily edit `useTrainingGoal`'s query result (or add a local `.overrideForDev` return early in `OSPREY-app/src/hooks/useTrainingGoal.ts`, whichever is less invasive) to force `primaryGoal: 'lift'` and a `goal_params` fixture with real 1RMs (e.g. `{ oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 } }`) written directly into a temporary test read-path.
2. Reload, screenshot "Your Numbers," confirm the Strength section matches Task 5's rendering design (working loads, zone, Prilepin, RPE/RIR, fat target).
3. Repeat for `hyrox` (with a division set) and `crossfit` (with 1RMs + a Fran time set).
4. **Revert the temporary substitution completely** — confirm via `git status` / `git diff` that no trace of it remains staged or unstaged before moving on.

- [ ] **Step 4: Report results**

Summarize to the user: regression suite status, real-account screenshot confirmation (training context + fuel + unchanged ZonesCard), and the 3 sport-specific section screenshots. Flag anything that didn't match expectations rather than silently proceeding.

---

## Post-plan

Per this session's established queue (Plan A → Plan B → **Phase 4** → Phase 3), Phase 3 (component-grammar consistency pass) is next — but it has a known, unresolved blocker from earlier in this session: the Workout tab redesign is stuck on a design decision (drop per-sport teal/gold hues → neutral cards + amber accent; the effort-ramp color choice itself is still open) that only the user can make. Surface and resolve this before brainstorming Phase 3, rather than skipping or silently assuming an answer.
