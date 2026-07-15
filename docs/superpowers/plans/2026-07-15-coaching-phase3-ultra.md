# Coaching-Engine Phase 3 (Ultra) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make **ultra** a first-class coaching goal — selectable, reusing run + HR zones, with race-distance/vert/gut inputs, a progressive taper, distance-scaled volume, heavier fueling, structural back-to-back long runs, and an ultra coaching voice.

**Architecture:** Mostly threads dormant calculators (`calculators/ultra.ts`) and copies the cycling goal-add pattern. `blueprintSport('ultra')='run'` reuses the run pace pipeline; a new `goal_params` JSONB carries the three inputs; ultra-specific behavior (taper / volume / fuel / back-to-back) is **gated on `sport === 'ultra'`** so non-ultra plans stay byte-identical. One genuinely-new piece: a deterministic `enforceBackToBackLongRuns` step in the edge fn (day placement is otherwise LLM-driven).

**Tech Stack:** TypeScript; app Jest (`TZ=Asia/Kolkata jest`, run from `OSPREY-app/`); edge Deno (`deno test`/`deno check`, std assert `https://deno.land/std@0.224.0/assert/mod.ts`). React Native (Expo) for the two collection screens.

## Global Constraints

- **Non-ultra plans MUST stay byte-identical.** Every ultra behavior is gated on `sport === 'ultra'` (or `goal === 'ultra'`). `validate.ts` is **untouched**.
- **Two additive migrations**, committed-but-undeployed, applied via **MCP `apply_migration`** (not `db push` — history drift) before/with the atomic app+edge redeploy: `ADD VALUE IF NOT EXISTS 'ultra'` + `ADD COLUMN IF NOT EXISTS goal_params JSONB`.
- **Ultra math is the source of truth in `docs/coaching/ultra.md`.** Distance factors: `50k ×1.0, 50mi ×1.15, 100k ×1.3, 100mi ×1.5`. Taper (§8): `ultraTaperWeeklyVolumes` = `[0.75, 0.75, 0.70] × baseline` across the final 3 weeks, race week gets the ×0.70. Fuel (§6): `ultraRaceCarbGPerHour` = 60-90 (untrained) / 60-120 (trained).
- **Race date degrades gracefully:** no `target_date` → phase stays `Base`, taper off (today's behavior).
- **The run `easy` pace-clamp is left as-is** (prompt-driven slow long runs).
- **⚠️ GIT HYGIENE:** each task `git add`s ONLY its own files (never `-A`/`.`; `git status` before committing — untracked audit/worktree files stay out).
- **Run the FULL suite before committing** (app `npm test`; edge `deno test supabase/functions/ozzie-generate-plan/`), not just the touched file.

---

## File Structure

- `supabase/migrations/20260715000002_ultra_primary_goal.sql` (new) — enum value.
- `supabase/migrations/20260715000003_goal_params.sql` (new) — `user_goals.goal_params` column.
- `OSPREY-app/src/services/coaching/ultra-params.ts` (new) — `UltraGoalParams` type, `ULTRA_DISTANCE_FACTOR`, `toUltraParams`, `parseUltraParams`.
- Modified app: `types/onboarding.ts`, `types/preferences.ts`, `services/onboarding.ts`, `services/coaching/zones.ts`, `services/coaching/envelope.ts`, `services/coaching/fuel.ts`, `services/coaching/build-envelope.ts`, `app/(onboarding)/goals.tsx`, `app/(onboarding)/baseline.tsx`, `app/preferences.tsx`, `store/onboardingStore.ts`.
- `supabase/functions/ozzie-generate-plan/backtoback.ts` (new) — `enforceBackToBackLongRuns`.
- Modified edge: `goals.ts`, `index.ts`.

---

### Task 1: Goal plumbing — `ultra` selectable + `blueprintSport('ultra')='run'`

**Files:**
- Create: `supabase/migrations/20260715000002_ultra_primary_goal.sql`
- Modify: `OSPREY-app/src/types/onboarding.ts`, `OSPREY-app/src/types/preferences.ts`, `OSPREY-app/src/services/onboarding.ts`, `OSPREY-app/src/services/coaching/zones.ts`, `OSPREY-app/app/(onboarding)/goals.tsx`, `OSPREY-app/app/preferences.tsx`, `supabase/functions/ozzie-generate-plan/goals.ts`, `supabase/functions/ozzie-generate-plan/index.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/zones.test.ts`, `supabase/functions/ozzie-generate-plan/goals.test.ts`

**Interfaces:**
- Produces: `'ultra'` is a valid `PrimaryGoal`/`TrainingGoal`; `blueprintSport('ultra') === 'run'`; `anchorKeyForGoal('ultra') === 'run'` (cascades free); `ENDURANCE_PRIMARY['ultra'] === 'run'`. Later tasks assume `sport === 'ultra'` reaches `computeEnvelope` with run zones.

- [ ] **Step 1: Failing test** — add to `zones.test.ts` (Jest) and `goals.test.ts` (Deno):

`zones.test.ts`:
```typescript
it('routes ultra to the run blueprint (reuses run pace zones)', () => {
  expect(blueprintSport('ultra')).toBe('run');
});
```
`goals.test.ts` (Deno):
```typescript
Deno.test('ultra routes its primary days to run days', () => {
  const d = routeDisciplineDays('ultra', 4, 1, false, false);
  assertEquals(d.weeklyRunDays, 4);
  assertEquals(d.weeklySwimDays, 0);
  assertEquals(d.weeklyBikeDays, 0);
});
```

- [ ] **Step 2: Run — expect FAIL** (`blueprintSport('ultra')` returns `null`; `ENDURANCE_PRIMARY['ultra']` is undefined → falls to `'run'` via `?? 'run'`, so the Deno test may already pass — that's fine, it's a regression guard; the Jest test fails).

Run: `npm test -- src/services/coaching/__tests__/zones.test.ts` and `deno test supabase/functions/ozzie-generate-plan/goals.test.ts`

- [ ] **Step 3: Implement.**

Migration `20260715000002_ultra_primary_goal.sql`:
```sql
-- Phase 3 (ultra): add the ultra primary goal. Additive + idempotent.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'ultra';
```
`types/onboarding.ts` — add `| 'ultra'` to the `PrimaryGoal` union (after `'cycling'`).
`types/preferences.ts` — add `| 'ultra'` to the `TrainingGoal` union (after `'cycling'`).
`services/onboarding.ts` `ONBOARDING_GOAL_TO_PREFERENCES` — add `ultra: 'ultra',`.
`services/coaching/zones.ts` `blueprintSport` — change line 23 to include ultra:
```typescript
  if (primaryGoal === 'run' || primaryGoal === 'hybrid' || primaryGoal === 'hyrox' || primaryGoal === 'ultra') return 'run';
```
`goals.ts` `ENDURANCE_PRIMARY` — add `ultra: 'run',`.
`index.ts` `PRIMARY_GOAL_MAP` — add `ultra: 'ultra',`.
`app/(onboarding)/goals.tsx` `GOALS` — add after the `run` entry:
```tsx
  { id: 'ultra', icon: '⛰️', title: 'Go ultra', desc: '50k to 100 miles — trail & mountain' },
```
`app/preferences.tsx` `GOAL_OPTIONS` — add after `run_performance`:
```tsx
  { value: 'ultra', label: '⛰️ Ultra' },
```

- [ ] **Step 4: Run — expect PASS** (both new tests; `zones.test.ts` full file; `goals.test.ts` full file), then `npm run typecheck` (exhaustive `Record<PrimaryGoal, …>` maps compile) + full app suite.

- [ ] **Step 5: Commit** — `git add` the 8 files + migration + 2 test files ; `git commit -m "feat(coaching): ultra selectable goal — reuse run zones (phase3-ultra)"`

---

### Task 2: `goal_params` — the three ultra inputs (storage + parse + threading)

**Files:**
- Create: `supabase/migrations/20260715000003_goal_params.sql`, `OSPREY-app/src/services/coaching/ultra-params.ts`
- Modify: `OSPREY-app/src/services/coaching/envelope.ts` (`EnvelopeInput`), `OSPREY-app/src/services/coaching/build-envelope.ts`, `OSPREY-app/src/services/onboarding.ts` (persist), `supabase/functions/ozzie-generate-plan/index.ts` (plan-builder upsert)
- Test: `OSPREY-app/src/services/coaching/__tests__/ultra-params.test.ts` (new)

**Interfaces:**
- Produces: `UltraGoalParams { raceDistance: '50k'|'50mi'|'100k'|'100mi'; vertGainM: number|null; gutTrained: boolean }`; `ULTRA_DISTANCE_FACTOR`; `toUltraParams(raw): UltraGoalParams` (null-safe defaults → `50k`/null/false); `parseUltraParams(...)`. `EnvelopeInput.ultraParams?: UltraGoalParams | null` (null for non-ultra). Tasks 3/4/6 consume `input.ultraParams`.

- [ ] **Step 1: Failing test** — `ultra-params.test.ts`:
```typescript
import { toUltraParams, parseUltraParams, ULTRA_DISTANCE_FACTOR } from '@/services/coaching/ultra-params';

describe('toUltraParams', () => {
  it('defaults a null/empty blob to a base 50k plan', () => {
    expect(toUltraParams(null)).toEqual({ raceDistance: '50k', vertGainM: null, gutTrained: false });
  });
  it('passes through valid stored params', () => {
    expect(toUltraParams({ raceDistance: '100mi', vertGainM: 6000, gutTrained: true }))
      .toEqual({ raceDistance: '100mi', vertGainM: 6000, gutTrained: true });
  });
  it('coerces an unknown distance to 50k and a bad vert to null', () => {
    expect(toUltraParams({ raceDistance: 'marathon', vertGainM: -5, gutTrained: 'yes' }))
      .toEqual({ raceDistance: '50k', vertGainM: null, gutTrained: false });
  });
});
describe('ULTRA_DISTANCE_FACTOR', () => {
  it('scales volume up with distance', () => {
    expect(ULTRA_DISTANCE_FACTOR['50k']).toBe(1.0);
    expect(ULTRA_DISTANCE_FACTOR['100mi']).toBeGreaterThan(ULTRA_DISTANCE_FACTOR['50k']);
  });
});
describe('parseUltraParams', () => {
  it('accepts a valid form and rejects a blank distance', () => {
    expect(parseUltraParams({ raceDistance: '50mi', vertGainM: '1500', gutTrained: true }).ok).toBe(true);
    expect(parseUltraParams({ raceDistance: '', vertGainM: '', gutTrained: false }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `npm test -- src/services/coaching/__tests__/ultra-params.test.ts`

- [ ] **Step 3: Implement `ultra-params.ts`:**
```typescript
import { ParseResult } from './baseline';

export type UltraRaceDistance = '50k' | '50mi' | '100k' | '100mi';

export interface UltraGoalParams {
  raceDistance: UltraRaceDistance;
  vertGainM: number | null; // total race vert; null = flat/unknown
  gutTrained: boolean;       // practiced high-carb feeding?
}

export const ULTRA_DISTANCE_FACTOR: Record<UltraRaceDistance, number> = {
  '50k': 1.0, '50mi': 1.15, '100k': 1.3, '100mi': 1.5, // docs/coaching/ultra.md §7 (tunable)
};

const DISTANCES: UltraRaceDistance[] = ['50k', '50mi', '100k', '100mi'];
const isDistance = (v: unknown): v is UltraRaceDistance => DISTANCES.includes(v as UltraRaceDistance);

// Stored JSONB (or null) → safe params. A paramless ultra runs a base 50k build.
export function toUltraParams(raw: unknown): UltraGoalParams {
  const p = (raw ?? {}) as Partial<UltraGoalParams>;
  return {
    raceDistance: isDistance(p.raceDistance) ? p.raceDistance : '50k',
    vertGainM: typeof p.vertGainM === 'number' && p.vertGainM >= 0 ? p.vertGainM : null,
    gutTrained: p.gutTrained === true,
  };
}

// Validate the collection-form inputs (vert optional; distance required).
export function parseUltraParams(input: { raceDistance: string; vertGainM: string; gutTrained: boolean }): ParseResult<UltraGoalParams> {
  if (!isDistance(input.raceDistance)) return { ok: false, error: 'Pick your race distance.' };
  const vertRaw = input.vertGainM.trim();
  let vertGainM: number | null = null;
  if (vertRaw !== '') {
    const v = Number(vertRaw);
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'Vert must be a positive number of metres (or leave it blank).' };
    vertGainM = Math.round(v);
  }
  return { ok: true, value: { raceDistance: input.raceDistance, vertGainM, gutTrained: input.gutTrained } };
}
```
> `ParseResult` in `baseline.ts` is currently `{ ok: true; value: number } | { ok: false; error: string }`. Generalize it to `ParseResult<T = number>` (change the definition to `export type ParseResult<T = number> = { ok: true; value: T } | { ok: false; error: string };`) — this is backward-compatible with every existing `parse*` caller (they use the default `number`). Include `baseline.ts` in this task's commit.

`envelope.ts` — add to `EnvelopeInput` (after `maxHR`): `ultraParams?: import('./ultra-params').UltraGoalParams | null;`
`build-envelope.ts` — (a) add `ultraParams: UltraGoalParams | null;` to `EnvelopeInputs`; (b) in `envelopeFromInputs`, pass `ultraParams: i.ultraParams` into `computeEnvelope({...})`; (c) add `goal_params` to the `user_goals` select at line 62; (d) in the `inputs = {…}` object (line 90-102), add:
```typescript
      ultraParams: g?.primary_goal === 'ultra' ? toUltraParams(g?.goal_params) : null,
```
and in the default `inputs` (line 54-58) add `ultraParams: null,`. Import `toUltraParams` + `UltraGoalParams` from `./ultra-params`.

`services/onboarding.ts` — the `user_goals` insert (line 56-63) gains `goal_params: draft.goalParams ?? null,` (add `goalParams?: UltraGoalParams | null` to the `OnboardingDraft` type + the store; Task 7 populates it).
`index.ts` plan-builder upsert (line 529-542) — add `goal_params: (prefs.ultraParams as unknown) ?? null,` to the upserted object (Task 7 sends `prefs.ultraParams`).

- [ ] **Step 4: Run — expect PASS** (`ultra-params.test.ts`) + `npm run typecheck` + full app suite. Edge: `deno check supabase/functions/ozzie-generate-plan/index.ts` shows only the ~26 pre-existing `@supabase` errors.

- [ ] **Step 5: Commit** — `git add` migration + `ultra-params.ts` + `ultra-params.test.ts` + `baseline.ts` + `envelope.ts` + `build-envelope.ts` + `onboarding.ts` + `index.ts` ; `git commit -m "feat(coaching): goal_params — ultra distance/vert/gut inputs plumbing (phase3-ultra)"`

---

### Task 3: Progressive taper + distance-scaled volume

**Files:**
- Modify: `OSPREY-app/src/services/coaching/envelope.ts`, `OSPREY-app/src/services/coaching/build-envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts`

**Interfaces:**
- Consumes: `input.ultraParams` (Task 2), `input.weeksRemaining` (added here). Uses `ultraTaperWeeklyVolumes` + `ULTRA_DISTANCE_FACTOR`.
- Produces: for `sport === 'ultra'`, `targetWeeklyLoad` scaled by distance, and in the Taper phase overridden by the progressive 3-week volumes. Non-ultra `targetWeeklyLoad` unchanged.

- [ ] **Step 1: Failing test** — `envelope.test.ts`:
```typescript
it('scales ultra baseline volume up with race distance', () => {
  const base = computeEnvelope({ ...ultraInput(), phase: 'Build', ultraParams: { raceDistance: '50k', vertGainM: null, gutTrained: false } });
  const long = computeEnvelope({ ...ultraInput(), phase: 'Build', ultraParams: { raceDistance: '100mi', vertGainM: null, gutTrained: false } });
  expect(long.targetWeeklyLoad).toBeGreaterThan(base.targetWeeklyLoad);
});
it('applies the progressive ultra taper (race week is the deepest cut)', () => {
  const threeOut = computeEnvelope({ ...ultraInput(), phase: 'Taper', weeksRemaining: 3, prevWeekLoad: 400 });
  const raceWeek = computeEnvelope({ ...ultraInput(), phase: 'Taper', weeksRemaining: 1, prevWeekLoad: 400 });
  expect(raceWeek.targetWeeklyLoad).toBeLessThan(threeOut.targetWeeklyLoad); // 0.70 < 0.75 of baseline
});
it('leaves a non-ultra taper on the flat cut (regression)', () => {
  const run = computeEnvelope({ ...ultraInput(), sport: 'run', phase: 'Taper', weeksRemaining: 1, prevWeekLoad: 400 });
  expect(run.targetWeeklyLoad).toBe(Math.round(400 * 0.55)); // applyVolumeCut(prev, 0.45)
});
```
> Add an `ultraInput()` helper to the test file returning a valid `EnvelopeInput` with `sport: 'ultra'`, `baselineLoad: 400`, `bodyWeightKg: 70`, `fitnessLevel: 'intermediate'`, run-anchor fields set, `ultraParams: { raceDistance: '50k', vertGainM: null, gutTrained: false }`.

- [ ] **Step 2: Run — expect FAIL** (`weeksRemaining` unknown; no ultra scaling/taper).

- [ ] **Step 3: Implement.** In `envelope.ts`:

Add to `EnvelopeInput`: `weeksRemaining?: number | null;`
Add imports: `import { ultraTaperWeeklyVolumes } from '@/services/calculators/ultra';` and `import { ULTRA_DISTANCE_FACTOR } from './ultra-params';`
Replace the `targetWeeklyLoad` call block (lines 47-52) with an ultra-aware `load`:
```typescript
  const isUltra = input.sport === 'ultra';
  const distanceFactor = isUltra ? (ULTRA_DISTANCE_FACTOR[input.ultraParams?.raceDistance ?? '50k'] ?? 1) : 1;
  const scaledBaseline = Math.round(input.baselineLoad * distanceFactor);

  let load: number;
  if (isUltra && input.phase === 'Taper') {
    // Progressive 25/25/30 taper (docs/coaching/ultra.md §8): 3-out ×0.75, 2-out ×0.75, race week ×0.70.
    const taperIdx = Math.min(2, Math.max(0, 3 - (input.weeksRemaining ?? 3)));
    load = Math.round(ultraTaperWeeklyVolumes(scaledBaseline)[taperIdx]);
  } else {
    load = targetWeeklyLoad({
      baselineLoad: scaledBaseline,
      phase: input.phase,
      weekNumber: input.weekNumber,
      prevWeekLoad: input.prevWeekLoad,
    });
  }
```
(`targetWeeklyLoad` in `periodization.ts` is **unchanged** — the ultra branch lives here. For non-ultra, `distanceFactor` is `1` so `scaledBaseline === input.baselineLoad` and `load` is byte-identical.)

In `build-envelope.ts` `envelopeFromInputs`, thread `weeksRemaining`:
```typescript
    weeksRemaining: phaseInfo?.weeksRemaining ?? null,
```
into the `computeEnvelope({...})` call. (`computeRacePhase` already returns `weeksRemaining` — confirm the field name in `@/services/plan`; if it differs, adapt.)

- [ ] **Step 4: Run — expect PASS** (the 3 new tests + full `envelope.test.ts`, incl. the regression that non-ultra load is byte-identical) + `npm run typecheck` + full suite.

- [ ] **Step 5: Commit** — `git add envelope.ts build-envelope.ts envelope.test.ts` ; `git commit -m "feat(coaching): ultra progressive taper + distance-scaled volume (phase3-ultra)"`

---

### Task 4: Ultra fuel

**Files:**
- Modify: `OSPREY-app/src/services/coaching/fuel.ts`, `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/fuel.test.ts`

**Interfaces:**
- Consumes: `gutTrained` (from `input.ultraParams`).
- Produces: `computeFuel(sport, bodyWeightKg, gutTrained?)`; ultra in-session rate = midpoint of `ultraRaceCarbGPerHour(gutTrained)` (75 untrained / 90 trained). Non-ultra sports unaffected (default `gutTrained` unused).

- [ ] **Step 1: Failing test** — add to `fuel.test.ts`:
```typescript
it('gives ultra its own in-session carb rate, higher when gut-trained', () => {
  const untrained = computeFuel('ultra', 70, false).longSessionCarbGPerHour;
  const trained = computeFuel('ultra', 70, true).longSessionCarbGPerHour;
  expect(untrained).toBe(75);  // midpoint {60,90}
  expect(trained).toBe(90);    // midpoint {60,120}
});
it('ignores gutTrained for non-ultra sports (regression)', () => {
  expect(computeFuel('run', 70, true).longSessionCarbGPerHour).toBe(computeFuel('run', 70).longSessionCarbGPerHour);
});
```

- [ ] **Step 2: Run — expect FAIL** (`computeFuel` takes 2 args; ultra falls to the run default 75 for both).

- [ ] **Step 3: Implement `fuel.ts`:**
```typescript
import { ultraRaceCarbGPerHour } from '@/services/calculators/ultra';
// ...
function inSessionCarbGPerHour(sport: string, gutTrained: boolean): number {
  if (sport === 'ultra') return Math.round(midpoint(ultraRaceCarbGPerHour(gutTrained)) ?? 60);
  if (sport === 'cycling') return Math.round(midpoint(cyclingInRideCarbGPerHour('long_or_hard')) ?? 60);
  if (sport === 'swim') return Math.round(midpoint(swimMeetDayCarbGPerHour(true)) ?? 60);
  return Math.round(midpoint(runningRaceFuelGPerHour('marathon')) ?? 60); // run/hybrid/hyrox/rowing/triathlon/default
}

export function computeFuel(sport: string, bodyWeightKg: number, gutTrained = false): FuelPlan {
  const carb = (dt: EnduranceDayType) => dailyCarbGrams(dt, bodyWeightKg);
  return {
    dailyCarbGByDayType: { easy: carb('easy'), moderate: carb('moderate'), high: carb('high'), peak: carb('peak') },
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.2) },
    longSessionCarbGPerHour: inSessionCarbGPerHour(sport, gutTrained),
  };
}
```
`envelope.ts` — change the fuel call (line 112) to pass gut-trained:
```typescript
    fuel: computeFuel(input.sport, input.bodyWeightKg, input.ultraParams?.gutTrained ?? false),
```

- [ ] **Step 4: Run — expect PASS** (new tests + full `fuel.test.ts`; the existing swim-branch test still passes — swim still distinct) + `npm run typecheck` + full suite.

- [ ] **Step 5: Commit** — `git add fuel.ts envelope.ts fuel.test.ts` ; `git commit -m "feat(coaching): ultra in-session fuel by gut-training (phase3-ultra)"`

---

### Task 5: Structural back-to-back long runs (edge)

**Files:**
- Create: `supabase/functions/ozzie-generate-plan/backtoback.ts`, `supabase/functions/ozzie-generate-plan/backtoback.test.ts`
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` (wire after `validateAndClamp`)

**Interfaces:**
- Produces: `enforceBackToBackLongRuns(days, sport)` — for ultra, the two longest run sessions end on consecutive `dayOffset`s (Sat+Sun preferred); non-ultra untouched; 7 days preserved; idempotent.

- [ ] **Step 1: Failing test** — `backtoback.test.ts` (Deno):
```typescript
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceBackToBackLongRuns } from './backtoback.ts';

const run = (dayOffset: number, km: number) => ({ dayOffset, session_type: 'run', planned_distance_km: km, planned_minutes: km * 6 });
const rest = (dayOffset: number) => ({ dayOffset, session_type: 'rest', planned_distance_km: null, planned_minutes: null });

Deno.test('ultra: places the two longest runs on consecutive weekend days', () => {
  const days = [run(0, 8), run(2, 30), rest(5), run(6, 20), rest(1), rest(3), rest(4)];
  const out = enforceBackToBackLongRuns(days as never, 'ultra');
  const offsets = out.map((d) => d.dayOffset).sort((a, b) => a - b);
  assertEquals(offsets, [0, 1, 2, 3, 4, 5, 6]); // 7 distinct days preserved
  const longs = out.filter((d) => d.session_type === 'run' && (d.planned_distance_km ?? 0) >= 20).map((d) => d.dayOffset).sort();
  assertEquals(longs, [5, 6]); // the 30 and 20 km runs are now Sat+Sun
});
Deno.test('ultra: leaves already-consecutive long runs untouched (idempotent)', () => {
  const days = [run(5, 30), run(6, 20), rest(0), rest(1), rest(2), rest(3), rest(4)];
  const out = enforceBackToBackLongRuns(days as never, 'ultra');
  assertEquals(out, days);
});
Deno.test('non-ultra: untouched', () => {
  const days = [run(0, 8), run(2, 30), run(6, 20), rest(1), rest(3), rest(4), rest(5)];
  assertEquals(enforceBackToBackLongRuns(days as never, 'run'), days);
});
Deno.test('fewer than two runs: no-op', () => {
  const days = [run(2, 30), rest(0), rest(1), rest(3), rest(4), rest(5), rest(6)];
  assertEquals(enforceBackToBackLongRuns(days as never, 'ultra'), days);
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `deno test supabase/functions/ozzie-generate-plan/backtoback.test.ts`

- [ ] **Step 3: Implement `backtoback.ts`:**
```typescript
interface DayLike { dayOffset: number; session_type: string; planned_distance_km: number | null; planned_minutes: number | null }
const runLen = (d: DayLike) => d.planned_distance_km ?? d.planned_minutes ?? 0;

// Ultra's signature session is back-to-back long runs (docs/coaching/ultra.md §3). Day
// placement is otherwise LLM-driven with no enforcement, so put the two longest runs on
// consecutive days (Sat+Sun preferred). Deterministic, idempotent, ultra-only.
export function enforceBackToBackLongRuns<T extends DayLike>(days: T[], sport: string): T[] {
  if (sport !== 'ultra') return days;
  const runs = days.filter((d) => d.session_type === 'run').sort((a, b) => runLen(b) - runLen(a));
  if (runs.length < 2) return days;
  const [longA, longB] = runs; // longA = longest
  if (Math.abs(longA.dayOffset - longB.dayOffset) === 1) return days; // already back-to-back

  // Swap the long runs onto Saturday(5)+Sunday(6); longest → Sunday.
  const offsets = days.map((d) => d.dayOffset);
  const idxOf = (d: T) => days.indexOf(d);
  const place = (long: T, target: number) => {
    const li = idxOf(long);
    if (offsets[li] === target) return;
    const occ = offsets.indexOf(target); // day currently at target
    offsets[occ] = offsets[li];
    offsets[li] = target;
  };
  place(longA, 6);
  place(longB, 5);
  return days.map((d, i) => ({ ...d, dayOffset: offsets[i] }));
}
```

- [ ] **Step 4: Wire it in `index.ts`** — after `validateAndClamp` (the `finalDays` assignment at line 728), before building `sessionRows`:
```typescript
    const finalDays = enforceBackToBackLongRuns(clamped.days as never, goals.primaryGoal) as typeof clamped.days;
```
(replace the existing `const finalDays = clamped.days;`). Add `import { enforceBackToBackLongRuns } from './backtoback.ts';` at the top. `goals.primaryGoal` is `'ultra'` only for ultra plans, so every other plan is a pass-through.

- [ ] **Step 5: Run — expect PASS**: `deno test supabase/functions/ozzie-generate-plan/` (all, incl. the 4 new + existing clamp/polarization byte-identical) + `deno check supabase/functions/ozzie-generate-plan/index.ts` (26 pre-existing errors, none referencing backtoback).

- [ ] **Step 6: Commit** — `git add backtoback.ts backtoback.test.ts index.ts` ; `git commit -m "feat(edge): enforce ultra back-to-back long runs (phase3-ultra)"`

---

### Task 6: Ultra coaching voice (prompt)

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` (`PLAN_SYSTEM_PROMPT`)

**Interfaces:** Integration — verified by `deno test` + `deno check`.

- [ ] **Step 1: Add the ultra block** to `PLAN_SYSTEM_PROMPT` (after the triathlon guidance paragraph at line 27), mirroring that block's goal-conditioned style:
```
Ultra / ultramarathon guidance: When the goal is ultra, coach for the mountains and long hours, not road-marathon pace. Run by EFFORT and heart rate, not pace — terrain scrambles pace; keep ~80% of running easy (Zone 1-2, conversational). The engine is the long run and the BACK-TO-BACK: place the two longest runs on consecutive days (a big Saturday + big Sunday) to train tired legs — progress time-on-feet, not pace. Program power-hiking on steep climbs and deliberate downhill/descent work (eccentric quad conditioning). Fuel heavily: 60-120 g/hr of carbs on long efforts and drink to thirst (do NOT overdrink). Include eccentric/downhill strength twice a week. Build volume ≤10%/week with a recovery week every 3-4 weeks. If no target race date is set, the plan runs a general base build — encourage the athlete in ozzie_notes to set a race date so the taper can be scheduled.
```

- [ ] **Step 2: Verify** — `deno test supabase/functions/ozzie-generate-plan/` (all green — no test asserts the prompt text; this is additive) + `deno check supabase/functions/ozzie-generate-plan/index.ts` (26 pre-existing errors only).

- [ ] **Step 3: Commit** — `git add index.ts` ; `git commit -m "feat(edge): ultra coaching guidance in the plan prompt (phase3-ultra)"`

---

### Task 7: Collection UI (onboarding baseline + plan-builder)

**Files:**
- Modify: `OSPREY-app/app/(onboarding)/baseline.tsx`, `OSPREY-app/store/onboardingStore.ts`, `OSPREY-app/src/services/onboarding.ts` (OnboardingDraft), `OSPREY-app/app/preferences.tsx`
- Test: `OSPREY-app/src/services/coaching/__tests__/ultra-params.test.ts` (the `parseUltraParams` coverage from Task 2 already backs the validation; this task is UI wiring on top of it)

**Interfaces:**
- Consumes: `parseUltraParams`, `UltraGoalParams` (Task 2), the `goal_params` persistence paths (Task 2).
- Produces: onboarding + plan-builder capture the three ultra inputs and persist them to `user_goals.goal_params`.

> This is UI wiring on top of Task 2's tested `parseUltraParams`. Screens aren't unit-tested in this repo; verify with `npm run typecheck` and the browser preview (per the harness preview workflow). Each step still shows the exact code.

- [ ] **Step 1: Onboarding store** — add to `store/onboardingStore.ts` a `goalParams: UltraGoalParams | null` field (default `null`) + `setGoalParams(p: UltraGoalParams)` action (mirror `setThresholdAnchor`). Add `goalParams?: UltraGoalParams | null` to `OnboardingDraft` (`services/onboarding.ts`) — the insert wired in Task 2 reads `draft.goalParams`.

- [ ] **Step 2: Onboarding baseline UI** — in `app/(onboarding)/baseline.tsx`, when `primaryGoal === 'ultra'` render an ultra-params section (distance chips + optional vert + a gut-trained toggle) ABOVE the run-anchor form, and on `onContinue` validate with `parseUltraParams` and `setGoalParams` before pushing HEALTH:
```tsx
// state
const [ultraDistance, setUltraDistance] = useState<UltraRaceDistance>('50k');
const [ultraVert, setUltraVert] = useState('');
const [gutTrained, setGutTrained] = useState(false);
// in onContinue(), before setThresholdAnchor: if primaryGoal === 'ultra', validate + store
if (primaryGoal === 'ultra') {
  const u = parseUltraParams({ raceDistance: ultraDistance, vertGainM: ultraVert, gutTrained });
  if (!u.ok) return setError(u.error);
  setGoalParams(u.value);
}
```
Render a chip row for `['50k','50mi','100k','100mi']`, a numeric vert `TextInput` (placeholder "e.g. 2000", optional), and a gut-trained toggle chip — reuse the screen's existing `styles.field`/`styles.input` + the chip pattern. Import `parseUltraParams`, `UltraRaceDistance` from `@/services/coaching/ultra-params`.

- [ ] **Step 3: Plan-builder UI** — in `app/preferences.tsx`, add `const isUltra = primaryGoal === 'ultra';`, ultra state (`ultraDistance`/`ultraVert`/`gutTrained` seeded from `saved.ultraParams`), and — when `isUltra` — a "RACE DISTANCE" chip row (mirroring the triathlon block at lines 227-252) + vert input + gut-trained toggle. In `handleGenerate`, build `const ultraParams = isUltra ? parseUltraParams({ raceDistance: ultraDistance, vertGainM: ultraVert, gutTrained }) : null;` — if `isUltra && !ultraParams.ok`, `Alert.alert` and return; else include `...(isUltra ? { ultraParams: ultraParams.value } : {})` in the `preferences` object. **Persist before generating** so the client-built envelope sees it: when `isUltra`, `await supabase.from('user_goals').update({ goal_params: ultraParams.value }).eq('user_id', userId);` before `invokeGeneratePlan` (build-envelope reads `goal_params` from the DB).

- [ ] **Step 4: Verify** — `npm run typecheck` clean; full app suite green (`ultra-params.test.ts` still passing); load the onboarding + plan-builder screens in the browser preview, select Ultra, confirm the fields render and a generated ultra plan persists `goal_params` (spot-check via a network/DB read).

- [ ] **Step 5: Commit** — `git add` baseline.tsx + onboardingStore.ts + onboarding.ts + preferences.tsx ; `git commit -m "feat(app): collect ultra race distance/vert/gut on onboarding + plan-builder (phase3-ultra)"`

---

## Post-implementation

- **DEPLOY-CHECKLIST.md** — add a Phase 3 (ultra) bullet to §2: two additive migrations (`ADD VALUE 'ultra'` + `goal_params` column) + app+edge redeploy, atomic (same coupling as cycling); the fn upserts `'ultra'`, so apply the enum migration first/with the redeploy.
- **Memory** — update `osprey-coaching-engine.md`: Phase 3 started; ultra shipped (first Phase 3 slice).
- App + edge deploy together; `goal_params` nullable → backward-compatible; non-ultra plans byte-identical; `validate.ts` untouched.

## Self-Review

**Spec coverage** (against `2026-07-15-coaching-engine-phase3-ultra-design.md`):
- §3 Goal plumbing (migration, types, maps, pickers, `blueprintSport`) → Task 1. ✅
- §4 New inputs + storage + threading (`goal_params`, `UltraGoalParams`, persistence) → Task 2 (+ collection UI Task 7). ✅
- §5 Zones reuse run + HR; `validate.ts` untouched → Task 1 (`blueprintSport`), no validator task. ✅
- §6 Progressive taper + distance-scaled volume → Task 3. ✅
- §7 Ultra fuel → Task 4. ✅
- §8 Structural back-to-back long runs → Task 5. ✅
- §9 Ultra prompt block → Task 6. ✅
- §10 Deploy coupling + non-ultra byte-identical → Global Constraints + Post-implementation; regression tests in Tasks 3/4/5. ✅
- §11 Testing (TDD app + edge; regression) → each task's tests. ✅

**Placeholder scan:** none — every code step shows the code. The two prose `>` notes are explicit reconciliations (`ParseResult<T>` generalization; `computeRacePhase.weeksRemaining` field-name confirmation).

**Type consistency:** `UltraGoalParams` / `UltraRaceDistance` / `ULTRA_DISTANCE_FACTOR` / `toUltraParams` / `parseUltraParams` (Task 2) are used identically in Tasks 3 (`ULTRA_DISTANCE_FACTOR`, `input.ultraParams`), 4 (`input.ultraParams?.gutTrained`), and 7 (`parseUltraParams`). `computeFuel`'s new 3rd param (Task 4) matches the `envelope.ts` call site. `enforceBackToBackLongRuns(days, sport)` (Task 5) is wired with `goals.primaryGoal`. `EnvelopeInput` gains `ultraParams` (Task 2) + `weeksRemaining` (Task 3) — both optional, so intermediate tasks compile.
