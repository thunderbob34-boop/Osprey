# Coaching-Engine Phase 3 Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two pre-diagnosed coaching-engine defects — a plan-builder goal *switcher's* first generation building the envelope for the previous sport, and a paramless powerlifter getting 0 kg comp lifts.

**Architecture:** Fix #1 introduces a client mirror of the edge's goal map (`goal-map.ts`) and extracts the buggy goal-resolution in `invokeGeneratePlan` into a pure `resolveGoalInputs(postedGoal, dbGoal, goalParams)` that prefers the just-picked goal over the stale DB read. Fix #2 Part A makes `buildStrengthPrescription` return `null` when no 1RMs exist (→ the plan falls back to the general strength prompt); Part B hardens the edge (guardrail + prompt) so a *partial*-provide lifter's blank lifts are never described as, or clamped to, 0 kg — which requires extracting the inline `strengthGuidance` into the testable `guidance.ts` module (mirroring `hrGuidance`).

**Tech Stack:** TypeScript. App = React Native / Expo, Jest. Edge = Supabase Edge Function (Deno).

## Global Constraints

*(Copied verbatim from the spec — every task's requirements implicitly include these.)*

- **Non-lift and single-sport plans MUST stay byte-identical.** Every existing `validate.ts` polarization / pace-clamp / fuel-attach test and every non-switching envelope test must remain green, unchanged.
- **NO database migration.** No enum, column, or schema change.
- **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test` (Jest). The `TZ` is mandatory — date-phase math is timezone-sensitive.
- **Edge tests:** `deno test supabase/functions/ozzie-generate-plan/` (Deno).
- **Mirror, don't share.** No shared package between app (TS/Jest) and edge (Deno); pure logic duplicated across the boundary is pinned by a unit test on each side.
- **TDD.** Failing test reproducing the defect → minimal fix → green.

Branch: `spec/coaching-phase3-followups` (spec already committed as `ade1fbf`).

---

## File Structure

**Fix #1 (app-only):**
- `OSPREY-app/src/services/coaching/goal-map.ts` — **new.** Client mirror of the edge's `PRIMARY_GOAL_MAP`: `PrimaryGoalEnum`, `TRAINING_GOAL_TO_PRIMARY_GOAL`, `primaryGoalFromTrainingGoal`. One responsibility: translate a plan-builder `TrainingGoal` to the DB `primary_goal_enum`.
- `OSPREY-app/src/services/coaching/build-envelope.ts` — add pure `resolveGoalInputs`; wire `invokeGeneratePlan` to prefer the posted goal.

**Fix #2 Part A (app-only):**
- `OSPREY-app/src/services/coaching/strength.ts` — `buildStrengthPrescription` returns `null` when all three maxes are 0.

**Fix #2 Part B (edge):**
- `supabase/functions/ozzie-generate-plan/validate.ts` — step (d) guardrail skips a comp lift whose `orm ≤ 0`.
- `supabase/functions/ozzie-generate-plan/guidance.ts` — **gains** an exported, tested `strengthGuidance` (extracted from `index.ts`), which omits 0-orm lifts from its load lines.
- `supabase/functions/ozzie-generate-plan/index.ts` — import and call `strengthGuidance` instead of the inline const.

Task order: 1 → 2 (Fix #1), then 3, 4, 5 (Fix #2). Task 2 depends on Task 1. Tasks 3/4/5 are mutually independent.

---

### Task 1: Client goal map (`goal-map.ts`)

**Files:**
- Create: `OSPREY-app/src/services/coaching/goal-map.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/goal-map.test.ts`

**Interfaces:**
- Consumes: `TrainingGoal` from `@/types/preferences`; `ONBOARDING_GOAL_TO_PREFERENCES` + `PrimaryGoal` (from `@/services/onboarding` / `@/types/onboarding`) in the test only.
- Produces: `type PrimaryGoalEnum`; `const TRAINING_GOAL_TO_PRIMARY_GOAL: Record<TrainingGoal, PrimaryGoalEnum>`; `function primaryGoalFromTrainingGoal(g: TrainingGoal): PrimaryGoalEnum`. Task 2 consumes `primaryGoalFromTrainingGoal`.

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/services/coaching/__tests__/goal-map.test.ts`:

```ts
// onboarding.ts (imported for the inverse check) pulls in build-envelope → supabase;
// mock it so the module graph resolves under Jest (matches build-envelope.test.ts).
jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { ONBOARDING_GOAL_TO_PREFERENCES } from '@/services/onboarding';
import type { PrimaryGoal } from '@/types/onboarding';
import { TRAINING_GOAL_TO_PRIMARY_GOAL, primaryGoalFromTrainingGoal } from '@/services/coaching/goal-map';

describe('goal-map', () => {
  it('is the exact inverse of ONBOARDING_GOAL_TO_PREFERENCES over every PrimaryGoal', () => {
    (Object.keys(ONBOARDING_GOAL_TO_PREFERENCES) as PrimaryGoal[]).forEach((p) => {
      expect(primaryGoalFromTrainingGoal(ONBOARDING_GOAL_TO_PREFERENCES[p])).toBe(p);
    });
  });

  it('maps every plan-builder TrainingGoal (incl. triathlon) to a primary_goal_enum', () => {
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.strength).toBe('lift');
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.run_performance).toBe('run');
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.general).toBe('general_fitness');
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.triathlon).toBe('triathlon'); // plan-builder only — no onboarding inverse
    expect(Object.keys(TRAINING_GOAL_TO_PRIMARY_GOAL)).toHaveLength(11);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/goal-map.test.ts`
Expected: FAIL — cannot find module `@/services/coaching/goal-map`.

- [ ] **Step 3: Write minimal implementation**

Create `OSPREY-app/src/services/coaching/goal-map.ts`:

```ts
import type { TrainingGoal } from '@/types/preferences';

// The DB `primary_goal_enum` value space. Superset of the onboarding PrimaryGoal TS union
// (@/types/onboarding) — note it additionally includes 'triathlon'.
export type PrimaryGoalEnum =
  | 'run'
  | 'lift'
  | 'hybrid'
  | 'weight_loss'
  | 'general_fitness'
  | 'triathlon'
  | 'swim'
  | 'rowing'
  | 'hyrox'
  | 'cycling'
  | 'ultra';

// Client mirror of ozzie-generate-plan/index.ts PRIMARY_GOAL_MAP. Translates a plan-builder
// TrainingGoal to the DB primary_goal_enum that the envelope build gates on. Keep in sync
// with that map and the *_primary_goal migrations.
export const TRAINING_GOAL_TO_PRIMARY_GOAL: Record<TrainingGoal, PrimaryGoalEnum> = {
  hybrid: 'hybrid',
  run_performance: 'run',
  strength: 'lift',
  weight_loss: 'weight_loss',
  general: 'general_fitness',
  triathlon: 'triathlon',
  swim: 'swim',
  rowing: 'rowing',
  hyrox: 'hyrox',
  cycling: 'cycling',
  ultra: 'ultra',
};

export function primaryGoalFromTrainingGoal(g: TrainingGoal): PrimaryGoalEnum {
  return TRAINING_GOAL_TO_PRIMARY_GOAL[g];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/goal-map.test.ts`
Expected: PASS (2 tests). If the inverse test fails, `TRAINING_GOAL_TO_PRIMARY_GOAL` and `ONBOARDING_GOAL_TO_PREFERENCES` have drifted — fix the map, not the test.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/goal-map.ts OSPREY-app/src/services/coaching/__tests__/goal-map.test.ts
git commit -m "feat(coaching): client goal-map mirror (TrainingGoal → primary_goal_enum) (phase3-followups)"
```

---

### Task 2: Prefer the posted goal in `invokeGeneratePlan`

**Files:**
- Modify: `OSPREY-app/src/services/coaching/build-envelope.ts` (add `resolveGoalInputs`; rewrite the `inputs` assembly in `invokeGeneratePlan`, ~lines 103–117)
- Test: `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts` (add a `resolveGoalInputs` describe block)

**Interfaces:**
- Consumes: `primaryGoalFromTrainingGoal` (Task 1); existing `toUltraParams`/`UltraGoalParams`, `toStrengthParams`/`StrengthGoalParams`; `TrainingGoal`/`UserPreferences` from `@/types/preferences`.
- Produces: `export function resolveGoalInputs(postedGoal: TrainingGoal | undefined, dbGoal: string | null | undefined, goalParams: unknown): { sport: string; ultraParams: UltraGoalParams | null; strengthParams: StrengthGoalParams | null }`.

- [ ] **Step 1: Write the failing test**

Add to `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts` (extend the existing import on line 4 to `import { envelopeFromInputs, resolveGoalInputs } from '@/services/coaching/build-envelope';`), then append:

```ts
describe('resolveGoalInputs (goal switch: the posted goal wins over the stale DB read)', () => {
  it('switches hybrid → lift and populates strengthParams from goal_params', () => {
    const r = resolveGoalInputs('strength', 'hybrid', { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 } });
    expect(r.sport).toBe('lift');
    expect(r.strengthParams?.oneRepMaxKg).toEqual({ squat: 200, bench: 140, deadlift: 240 });
    expect(r.ultraParams).toBeNull();
  });

  it('switches run → ultra and populates ultraParams from goal_params', () => {
    const r = resolveGoalInputs('ultra', 'run', { raceDistance: '100k', vertGainM: 3000, gutTrained: true });
    expect(r.sport).toBe('ultra');
    expect(r.ultraParams).not.toBeNull();
    expect(r.strengthParams).toBeNull();
  });

  it.each(['triathlon', 'swim', 'rowing'] as const)('switches an endurance goal to %s', (goal) => {
    expect(resolveGoalInputs(goal, 'hybrid', null).sport).toBe(goal);
  });

  it('falls back to the DB goal when no preferences are posted (background regen / race-event)', () => {
    expect(resolveGoalInputs(undefined, 'rowing', null).sport).toBe('rowing');
    expect(resolveGoalInputs(undefined, null, null).sport).toBe('run'); // ultimate default
    // A lift envelope is NOT built off a stale-but-irrelevant DB read when nothing switched:
    expect(resolveGoalInputs(undefined, 'lift', { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 } }).strengthParams).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/build-envelope.test.ts`
Expected: FAIL — `resolveGoalInputs` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

In `OSPREY-app/src/services/coaching/build-envelope.ts`:

(a) Add the import near the existing imports (top of file):

```ts
import { primaryGoalFromTrainingGoal } from './goal-map';
import type { TrainingGoal, UserPreferences } from '@/types/preferences';
```

(b) Add the pure helper (place it just above `invokeGeneratePlan`):

```ts
// Resolve the effective goal for the envelope build. A plan-builder goal SWITCHER posts
// their just-picked goal in preferences.primaryGoal, but user_goals.primary_goal in the DB
// still holds the OLD goal until the edge fn's upsert — which runs AFTER this build. Prefer
// the posted goal so the first generation is built for the new sport; fall back to the DB
// value for background/regen and race-event calls that post no preferences.
export function resolveGoalInputs(
  postedGoal: TrainingGoal | undefined,
  dbGoal: string | null | undefined,
  goalParams: unknown,
): { sport: string; ultraParams: UltraGoalParams | null; strengthParams: StrengthGoalParams | null } {
  const effectiveGoal = postedGoal ? primaryGoalFromTrainingGoal(postedGoal) : (dbGoal ?? 'run');
  return {
    sport: effectiveGoal,
    ultraParams: effectiveGoal === 'ultra' ? toUltraParams(goalParams) : null,
    strengthParams: effectiveGoal === 'lift' ? toStrengthParams(goalParams) : null,
  };
}
```

(c) In `invokeGeneratePlan`, read the posted goal once (just after `const userId = ...`):

```ts
  const postedGoal = (extraBody.preferences as UserPreferences | undefined)?.primaryGoal;
```

(d) Replace the `sport` line and the trailing `ultraParams` / `strengthParams` lines of the `inputs = { … }` assembly with a spread of `resolveGoalInputs(...)` at the top of the literal. The block becomes:

```ts
    inputs = {
      ...resolveGoalInputs(postedGoal, g?.primary_goal, g?.goal_params),
      race: g?.target_date && g?.total_weeks_planned ? { targetDate: g.target_date, totalWeeksPlanned: g.total_weeks_planned } : null,
      fitnessLevel: g?.fitness_level ?? 'beginner',
      bodyWeightKg: weightRes.data?.weight_kg ?? 70,
      baselineLoad: 200,          // Phase 2 will thread real CTL; Base default for now
      prevWeekLoad: null,
      bestRunMiles: bestEffort?.distanceMiles ?? null,
      bestRunTimeS: bestEffort?.timeS ?? null,
      rowingSplitSecPer500: rowingSplit,
      selfReportAnchor: toSelfReportAnchor(g?.threshold_anchor as ThresholdAnchorMap | null),
      maxHR: (maxHrRes.data?.max_heart_rate as number | null) ?? null,
    };
```

(The old `sport: g?.primary_goal ?? 'run'`, `ultraParams: g?.primary_goal === 'ultra' ? …`, and `strengthParams: g?.primary_goal === 'lift' ? …` lines are now gone — they live inside `resolveGoalInputs`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/build-envelope.test.ts`
Expected: PASS — the new `resolveGoalInputs` block plus the unchanged `envelopeFromInputs` tests (which already prove per-sport envelope shaping for run/rowing/swim/ultra/tri).

- [ ] **Step 5: Full app suite (regression gate)**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npm test`
Expected: PASS — no non-switching behavior changed (the DB-fallback branch is byte-identical to today).

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/services/coaching/build-envelope.ts OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts
git commit -m "fix(coaching): prefer the just-picked goal over the stale DB read in invokeGeneratePlan (phase3-followups)"
```

---

### Task 3: `buildStrengthPrescription` returns null when there are no 1RMs (Fix #2 Part A)

**Files:**
- Modify: `OSPREY-app/src/services/coaching/strength.ts:19-37` (add an all-zero guard after `orm` is computed)
- Test: `OSPREY-app/src/services/coaching/__tests__/strength.test.ts` (**change** the existing absent-params test + add two)

**Interfaces:**
- Consumes: existing `EnvelopeInput`, `StrengthPrescription`.
- Produces: no signature change — `buildStrengthPrescription` still returns `StrengthPrescription | null`, now also `null` when `sport === 'lift'` but no 1RM is present.

**Note:** the existing test at `strength.test.ts:31-33` (`'defaults maxes to 0 when strengthParams is absent (no crash)'`) asserts the *old, buggy* behavior (a 0-max prescription). It must be **rewritten** to expect `null` — do not leave it asserting the old output.

- [ ] **Step 1: Write the failing tests**

In `OSPREY-app/src/services/coaching/__tests__/strength.test.ts`, **replace** the existing test on lines 31-33 with:

```ts
  it('returns null when strengthParams is absent (paramless lifter → general strength plan)', () => {
    expect(buildStrengthPrescription({ ...base(), strengthParams: undefined })).toBeNull();
  });
  it('returns null when all three maxes are null (onboarding "Skip — estimate for me")', () => {
    expect(buildStrengthPrescription({ ...base(), strengthParams: { oneRepMaxKg: { squat: null, bench: null, deadlift: null } } })).toBeNull();
  });
  it('still builds when at least one max is present (partial provide → per-lift 0 handled downstream)', () => {
    const s = buildStrengthPrescription({ ...base(), strengthParams: { oneRepMaxKg: { squat: 200, bench: null, deadlift: null } } })!;
    expect(s.oneRepMaxKg).toEqual({ squat: 200, bench: 0, deadlift: 0 });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/strength.test.ts`
Expected: FAIL — the first two expect `null` but current code returns a 0-max prescription (`Received: { oneRepMaxKg: { squat: 0, … } }`). The third already passes.

- [ ] **Step 3: Write minimal implementation**

In `OSPREY-app/src/services/coaching/strength.ts`, immediately after the `const orm = { … };` line (currently line 22), insert:

```ts
  // A paramless lifter (onboarding "Skip — estimate for me": goal_params null → all-null
  // maxes) has no 1RM to anchor %1RM loads. Return null so the envelope carries no strength
  // block and the plan falls back to the general/whitelist strength prompt, instead of
  // prescribing 0 kg comp lifts. A PARTIAL provide (≥1 max) still builds; its blank lifts
  // are handled by the edge guardrail + prompt (Fix #2 Part B).
  if (orm.squat === 0 && orm.bench === 0 && orm.deadlift === 0) return null;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/strength.test.ts`
Expected: PASS (all buildStrengthPrescription tests, including the unchanged Base/Build/Peak/Taper and non-lift cases).

- [ ] **Step 5: Full app suite (regression gate)**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npm test`
Expected: PASS — non-lift plans still get `strength: null` (unchanged); fully-specified lifters (all maxes > 0) never hit the new guard.

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/services/coaching/strength.ts OSPREY-app/src/services/coaching/__tests__/strength.test.ts
git commit -m "fix(coaching): paramless lifter falls back to the general strength plan, not 0kg comp lifts (phase3-followups)"
```

---

### Task 4: Guardrail skips a comp lift with no 1RM (Fix #2 Part B — validate.ts)

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/validate.ts:171` (extend the step-(d) early-return)
- Test: `supabase/functions/ozzie-generate-plan/validate.test.ts` (add one Deno.test)

**Interfaces:**
- Consumes: existing `validateAndClamp`, the test file's `baseEnvelope` helper.
- Produces: no signature change. Behavioral: a comp lift whose `strength.oneRepMaxKg[lift] ≤ 0` is left untouched by the load guardrail.

- [ ] **Step 1: Write the failing test**

Add to `supabase/functions/ozzie-generate-plan/validate.test.ts` (reuse the existing `baseEnvelope` used at lines ~253–268):

```ts
Deno.test('guardrail leaves a comp lift with orm=0 untouched (partial-provide lifter)', () => {
  const strength = { oneRepMaxKg: { squat: 200, bench: 0, deadlift: 240 }, workingPercent1RM: 80, zone: { name: 'Strength-Volume', percent1RM: [75, 85], reps: [3, 6], rpe: [7, 8], rir: [2, 3] }, prilepin: { repsPerSet: [2, 4], totalReps: [10, 20] }, fatG: { min: 1, max: 2 }, attempts: null };
  const benchDay = { dayOffset: 0, session_type: 'lift',
    lift_prescription: { exercises: [ { name: 'Bench Press', sets: 4, reps: '4', loadKg: 60, note: null } ] } };
  const { days: out, changed } = validateAndClamp([benchDay] as any, { ...baseEnvelope, strength } as any);
  assertEquals((out[0] as any).lift_prescription.exercises[0].loadKg, 60); // bench orm=0 → not clamped into [0,0]
  assertEquals(changed.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/ozzie-generate-plan/validate.test.ts`
Expected: FAIL — current code computes `lo = hi = 0` for a 0 orm and clamps `60 → 0` (`Received 0, expected 60`; `changed.length` is 1).

- [ ] **Step 3: Write minimal implementation**

In `supabase/functions/ozzie-generate-plan/validate.ts`, change the early-return on line 171 from:

```ts
        if (!lift || ex.loadKg == null) return ex;
```

to:

```ts
        // Skip a comp lift with no 1RM (orm ≤ 0): a partial-provide lifter left this lift
        // blank, so there's no %1RM band to clamp against — don't clamp a real day into [0,0].
        if (!lift || ex.loadKg == null || st.oneRepMaxKg[lift] <= 0) return ex;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/ozzie-generate-plan/validate.test.ts`
Expected: PASS — the new test plus every existing guardrail test (the squat-400→clamped case at line ~231 still clamps, since its squat orm is 200 > 0).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/validate.ts supabase/functions/ozzie-generate-plan/validate.test.ts
git commit -m "fix(edge): load guardrail skips a comp lift with no 1RM (orm<=0) (phase3-followups)"
```

---

### Task 5: Extract `strengthGuidance` to `guidance.ts`, omit 0-orm lifts (Fix #2 Part B — prompt)

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/guidance.ts` (add `StrengthInfo` + exported `strengthGuidance`)
- Modify: `supabase/functions/ozzie-generate-plan/index.ts:351-354` (delete the inline `const s` / `const strengthGuidance` block) and `:361` (call the imported function); extend the `./guidance.ts` import
- Test: `supabase/functions/ozzie-generate-plan/guidance.test.ts` (add strengthGuidance tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export interface StrengthInfo { … }` and `export function strengthGuidance(s: StrengthInfo | null | undefined): string`. `index.ts`'s `Envelope.strength` inline type is structurally identical to `StrengthInfo`, so `envelope.strength` is assignable without changing the `Envelope` interface.

**Byte-identical requirement:** for a fully-specified lifter (all three maxes > 0), `strengthGuidance` must return the exact string the inline version produced. The pin test in Step 1 enforces this. (After Task 3, a strength block only exists when ≥1 max > 0, so the load list is never empty.)

- [ ] **Step 1: Write the failing tests**

In `supabase/functions/ozzie-generate-plan/guidance.test.ts`, change the import on line 2 to add `strengthGuidance`/`StrengthInfo`, then append:

```ts
const fullStrength: StrengthInfo = {
  oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 },
  workingPercent1RM: 80,
  zone: { name: 'Strength-Volume', percent1RM: [75, 85], reps: [3, 6], rpe: [7, 8], rir: [2, 3] },
  prilepin: { repsPerSet: [2, 4], totalReps: [10, 20] },
  fatG: { min: 72, max: 135 },
  attempts: null,
};

Deno.test('strengthGuidance returns empty for null/undefined', () => {
  assertEquals(strengthGuidance(null), '');
  assertEquals(strengthGuidance(undefined), '');
});

Deno.test('strengthGuidance is byte-identical to the inline version for a fully-specified lifter', () => {
  assertEquals(
    strengthGuidance(fullStrength),
    ` STRENGTH (powerlifting): work the comp lifts at ~80% 1RM — squat 160kg, bench 112kg, deadlift 192kg (zone "Strength-Volume", RPE 7-8, RIR 2-3). Keep top-set volume within Prilepin: 2-4 reps/set, 10-20 total reps at this intensity; then back-off volume + a variation + 2-3 accessories. Daily fat 72-135 g; creatine 3-5 g/day.`,
  );
});

Deno.test('strengthGuidance omits a comp lift with no 1RM (orm=0) from the load line', () => {
  const g = strengthGuidance({ ...fullStrength, oneRepMaxKg: { squat: 200, bench: 0, deadlift: 240 } });
  assertEquals(g.includes('squat 160kg'), true);
  assertEquals(g.includes('deadlift 192kg'), true);
  assertEquals(g.includes('bench'), false); // a blank bench is never shown as 0kg
});

Deno.test('strengthGuidance omits a 0-orm lift from the meet-week openers too', () => {
  const attempts = {
    squat: { opener: { min: 180, max: 184 }, second: { min: 190, max: 195 }, third: { min: 200, max: 204 } },
    bench: { opener: { min: 0, max: 0 }, second: { min: 0, max: 0 }, third: { min: 0, max: 0 } },
    deadlift: { opener: { min: 214, max: 218 }, second: { min: 228, max: 232 }, third: { min: 240, max: 245 } },
  };
  const g = strengthGuidance({ ...fullStrength, oneRepMaxKg: { squat: 200, bench: 0, deadlift: 240 }, attempts });
  assertEquals(g.includes('MEET WEEK'), true);
  assertEquals(g.includes('squat 180-184kg'), true);
  assertEquals(g.includes('deadlift 214-218kg'), true);
  assertEquals(/bench \d/.test(g), false); // no bench opener line
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/ozzie-generate-plan/guidance.test.ts`
Expected: FAIL — `strengthGuidance` / `StrengthInfo` are not exported from `./guidance.ts`.

- [ ] **Step 3: Write minimal implementation**

(a) In `supabase/functions/ozzie-generate-plan/guidance.ts`, append:

```ts
// Hand-narrowed mirror of StrengthPrescription (OSPREY-app/src/services/coaching/strength.ts),
// matching index.ts's Envelope.strength. Keep in sync if that shape changes.
export interface StrengthInfo {
  oneRepMaxKg: { squat: number; bench: number; deadlift: number };
  workingPercent1RM: number;
  zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
  prilepin: { repsPerSet: [number, number]; totalReps: [number, number] };
  fatG: { min: number; max: number };
  attempts: {
    squat: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
    bench: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
    deadlift: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
  } | null;
}

const COMP_LIFTS = ['squat', 'bench', 'deadlift'] as const;

// Powerlifting %1RM/Prilepin guidance, present only when the envelope carries a strength
// block (sport === 'lift'). A comp lift with no 1RM (orm ≤ 0 — a partial-provide lifter left
// it blank) is omitted from the load lines so the LLM is never told to program a 0 kg day.
// With all three maxes present the string is byte-identical to the pre-extraction inline form.
export function strengthGuidance(s: StrengthInfo | null | undefined): string {
  if (!s) return '';
  const loads = COMP_LIFTS.filter((l) => s.oneRepMaxKg[l] > 0)
    .map((l) => `${l} ${Math.round(s.oneRepMaxKg[l] * s.workingPercent1RM / 100)}kg`)
    .join(', ');
  let meet = '';
  if (s.attempts) {
    const at = s.attempts;
    meet =
      ` MEET WEEK — plan openers (~90% of goal): ` +
      COMP_LIFTS.filter((l) => s.oneRepMaxKg[l] > 0)
        .map((l) => `${l} ${Math.round(at[l].opener.min)}-${Math.round(at[l].opener.max)}kg`)
        .join(', ') +
      `; each lift's 2nd/3rd build to the goal third.`;
  }
  return (
    ` STRENGTH (powerlifting): work the comp lifts at ~${s.workingPercent1RM}% 1RM — ${loads} (zone "${s.zone.name}", RPE ${s.zone.rpe[0]}-${s.zone.rpe[1]}, RIR ${s.zone.rir[0]}-${s.zone.rir[1]}). Keep top-set volume within Prilepin: ${s.prilepin.repsPerSet[0]}-${s.prilepin.repsPerSet[1]} reps/set, ${s.prilepin.totalReps[0]}-${s.prilepin.totalReps[1]} total reps at this intensity; then back-off volume + a variation + 2-3 accessories. Daily fat ${s.fatG.min}-${s.fatG.max} g; creatine 3-5 g/day.` +
    meet
  );
}
```

(b) In `supabase/functions/ozzie-generate-plan/index.ts`, add `strengthGuidance` to the existing `./guidance.ts` import (the one that already brings in `hrGuidance`).

(c) Delete the inline block at index.ts:351-354 (the `const s = envelope?.strength;` and the `const strengthGuidance = !s ? '' : …` assignment).

(d) In the `envelopeGuidance` concatenation (index.ts:361), change the trailing `+ strengthGuidance` (the deleted local const) to a call:

```ts
      strengthGuidance(envelope.strength)
```

so the block reads:

```ts
  const envelopeGuidance = envelope
    ? ` COACHING ENVELOPE (hard constraints — stay inside these): phase=${envelope.phase}, week ${envelope.weekNumber}/${envelope.totalWeeks}, target weekly load ≈ ${envelope.targetWeeklyLoad} TSS, at most ${Math.round(envelope.hardSessionShareMax * 100)}% of sessions hard.` +
      zoneGuidance +
      hrGuidance(envelope.hrZones) +
      ` Daily carbs by day: easy ${envelope.fuel.dailyCarbGByDayType.easy.min}-${envelope.fuel.dailyCarbGByDayType.easy.max} g, hard ${envelope.fuel.dailyCarbGByDayType.high.min}-${envelope.fuel.dailyCarbGByDayType.high.max} g, race ${envelope.fuel.dailyCarbGByDayType.peak.min}-${envelope.fuel.dailyCarbGByDayType.peak.max} g; protein ${envelope.fuel.proteinG.min}-${envelope.fuel.proteinG.max} g/day; in-session ~${envelope.fuel.longSessionCarbGPerHour} g/hr.` +
      strengthGuidance(envelope.strength)
    : '';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/ozzie-generate-plan/guidance.test.ts`
Expected: PASS — including the byte-identical pin. If the pin fails, the extracted string drifted from the original; match it character-for-character (em dash `—`, `~`, the quotes around the zone name).

- [ ] **Step 5: Full edge suite (regression + byte-identical gate)**

Run: `deno test supabase/functions/ozzie-generate-plan/`
Expected: PASS — `deno check` clean of new errors and every existing test green (backtoback, goals, validate, guidance). No existing test pinned the inline `strengthGuidance` output, so the extraction changes no existing assertion.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/guidance.ts supabase/functions/ozzie-generate-plan/guidance.test.ts supabase/functions/ozzie-generate-plan/index.ts
git commit -m "fix(edge): extract strengthGuidance to guidance.ts + omit 0-orm comp lifts from the prompt (phase3-followups)"
```

---

## After all tasks

- **Final whole-branch review** (superpowers:requesting-code-review) on the most capable model, over `git merge-base main HEAD`..HEAD. Focus: the byte-identical guarantee (Task 5 extraction; the DB-fallback branch in Task 2), the goal-map inverse pin, and that Task 3's existing-test rewrite reflects real new behavior.
- **finishing-a-development-branch:** run `cd OSPREY-app && TZ=Asia/Kolkata npm test` and `deno test supabase/functions/ozzie-generate-plan/` on the merged result before merging `--no-ff` to `main`.
- **Deploy:** no migration. Fix #2's edge changes (Tasks 4–5) join the coaching engine's already-pending atomic redeploy (`docs/DEPLOY-CHECKLIST.md` §2) — no new deploy step. Fix #1 is app-only.

## Spec coverage map

| Spec item | Task |
|---|---|
| `goal-map.ts` (PrimaryGoalEnum + map + fn) | 1 |
| Inverse-pin test vs ONBOARDING_GOAL_TO_PREFERENCES | 1 |
| `invokeGeneratePlan` prefers posted goal (sport + ultra/lift gating) | 2 |
| Regression across ultra/tri/swim/rowing/lift | 2 (`resolveGoalInputs` cases) + existing `envelopeFromInputs` tests |
| DB fallback unchanged (regen/race-event) | 2 |
| Fix #2 Part A — null when all maxes 0 | 3 |
| Fix #2 Part B — guardrail skip orm≤0 | 4 |
| Fix #2 Part B — strengthGuidance omits 0-orm lines | 5 |
| Non-lift / single-sport byte-identical | 2 (fallback), 3 (non-lift null), 5 (pin) + full suites each task |
| No migration | (whole plan — none added) |
