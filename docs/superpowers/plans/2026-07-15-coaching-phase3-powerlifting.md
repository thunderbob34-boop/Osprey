# Coaching-Engine Phase 3 (Powerlifting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `lift` from a generic bodybuilder-prompt stub into a real powerlifting engine — capture 1RMs, build a block-periodized %1RM/Prilepin/RPE prescription (a new `strength` envelope field), rework the prompt, fix run-primary routing, add meet attempts + real nutrition, and add a server-side load guardrail.

**Architecture:** Wires the dormant `calculators/powerlifting.ts` into a new `strength: StrengthPrescription | null` field on `CoachingEnvelope` (parallel to `zones`/`fuel`), populated by a `lift` branch in `computeEnvelope`. Inputs ride the existing `goal_params` JSONB (mirroring ultra's `ultra-params.ts`). Every strength behavior is **gated on `sport === 'lift'`** so non-lift plans stay byte-identical. NO migration.

**Tech Stack:** TypeScript; app Jest (`TZ=Asia/Kolkata jest`, from `OSPREY-app/`); edge Deno (`deno test`/`deno check`, std assert `https://deno.land/std@0.224.0/assert/mod.ts`). React Native (Expo) for the two collection screens.

## Global Constraints

- **Non-lift plans MUST stay byte-identical.** Every strength behavior is gated on `sport === 'lift'` / `goal === 'lift'`.
- **NO migration.** `lift` enum, `user_goals.goal_params` (JSONB), and `target_date`/`total_weeks_planned` all exist.
- **`validate.ts` guardrail is the one risky change** (first since triathlon). Regression gate: every existing pace-clamp + polarization test stays **byte-identical**.
- **Apply the two ultra-Critical lessons:** the plan-builder persists `goal_params` before generating, and `buildPlanPreferences` threads `draft.goalParams` (both already in place from ultra — this slice widens their types, keeps them working).
- **Powerlifting math is SoT in `docs/coaching/powerlifting.md`.** Phase→%1RM: `Base 80, Build 88, Peak 95, Taper 90`. Intensity zones + Prilepin + `attemptSelector` come verbatim from `calculators/powerlifting.ts`.
- **⚠️ GIT HYGIENE:** each task `git add`s ONLY its own files (never `-A`/`.`; `git status` before committing). **Run the FULL suite before committing.**

---

## File Structure

- Create: `OSPREY-app/src/services/coaching/strength-params.ts`, `OSPREY-app/src/services/coaching/strength.ts` (the `StrengthPrescription` builder).
- Modify (app): `calculators/powerlifting.ts` (export the tables), `coaching/envelope.ts`, `coaching/fuel.ts`, `coaching/build-envelope.ts`, `services/onboarding.ts`, `services/lift-analytics.ts`, `types/preferences.ts` (`UserPreferences.ultraParams` → `goalParams: GoalParams`), `types/onboarding.ts` (`OnboardingDraft.goalParams`), `store/onboardingStore.ts`, `constants/sports.ts`, `app/(onboarding)/baseline.tsx`, `app/preferences.tsx`.
- Modify (edge): `goals.ts`, `index.ts` (prompt + Envelope mirror + guidance + preferences branch + regen), `validate.ts`.

---

### Task 1: `strength-params` + `GoalParams` plumbing + lift 1RM accessor

**Files:**
- Create: `OSPREY-app/src/services/coaching/strength-params.ts`
- Modify: `types/preferences.ts`, `types/onboarding.ts`, `store/onboardingStore.ts`, `coaching/build-envelope.ts`, `coaching/envelope.ts` (`EnvelopeInput`), `services/lift-analytics.ts`, `supabase/functions/ozzie-generate-plan/index.ts` (upsert type)
- Test: `OSPREY-app/src/services/coaching/__tests__/strength-params.test.ts`, `OSPREY-app/src/services/__tests__/lift-analytics.test.ts` (add), `OSPREY-app/src/services/__tests__/onboarding.test.ts` (add a lift round-trip)

**Interfaces:**
- Produces: `StrengthGoalParams { oneRepMaxKg: {squat,bench,deadlift: number|null}; goalThirdKg?: {…} }`; `GoalParams = UltraGoalParams | StrengthGoalParams`; `toStrengthParams(raw): StrengthGoalParams`; `parseStrengthParams(form): ParseResult<StrengthGoalParams>`; `bestE1rmForLift(analytics, lift): number | null`. `EnvelopeInput.strengthParams?: StrengthGoalParams | null`.

- [ ] **Step 1: Failing test** — `strength-params.test.ts`:
```typescript
import { toStrengthParams, parseStrengthParams } from '@/services/coaching/strength-params';

describe('toStrengthParams', () => {
  it('null-safe defaults an empty blob to all-null maxes', () => {
    expect(toStrengthParams(null)).toEqual({ oneRepMaxKg: { squat: null, bench: null, deadlift: null }, goalThirdKg: { squat: null, bench: null, deadlift: null } });
  });
  it('passes through valid maxes + goal thirds and drops non-positive values', () => {
    expect(toStrengthParams({ oneRepMaxKg: { squat: 200, bench: 140, deadlift: 0 }, goalThirdKg: { squat: 210, bench: -5, deadlift: 250 } }))
      .toEqual({ oneRepMaxKg: { squat: 200, bench: 140, deadlift: null }, goalThirdKg: { squat: 210, bench: null, deadlift: 250 } });
  });
});
describe('parseStrengthParams', () => {
  it('accepts at least one max and rejects all-blank', () => {
    expect(parseStrengthParams({ squat: '200', bench: '', deadlift: '', goalSquat: '', goalBench: '', goalDeadlift: '' }).ok).toBe(true);
    expect(parseStrengthParams({ squat: '', bench: '', deadlift: '', goalSquat: '', goalBench: '', goalDeadlift: '' }).ok).toBe(false);
  });
  it('rejects an implausible load', () => {
    expect(parseStrengthParams({ squat: '9000', bench: '', deadlift: '', goalSquat: '', goalBench: '', goalDeadlift: '' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `npm test -- src/services/coaching/__tests__/strength-params.test.ts`

- [ ] **Step 3: Implement `strength-params.ts`** (mirrors `ultra-params.ts`):
```typescript
import { ParseResult } from './baseline';
import type { UltraGoalParams } from './ultra-params';

export type PowerliftingLift = 'squat' | 'bench' | 'deadlift';
type LiftMaxes = { squat: number | null; bench: number | null; deadlift: number | null };

export interface StrengthGoalParams {
  oneRepMaxKg: LiftMaxes;
  goalThirdKg?: LiftMaxes; // meet target 3rd attempt; defaults to the 1RM when unset
}

// A sport-specific goal_params blob is one of these. `goal_params` is a generic JSONB
// column (ultra added it); its shape depends on the athlete's primary_goal.
export type GoalParams = UltraGoalParams | StrengthGoalParams;

const posKg = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 600 ? Math.round(v) : null);
const maxes = (o: unknown): LiftMaxes => {
  const m = (o ?? {}) as Partial<LiftMaxes>;
  return { squat: posKg(m.squat), bench: posKg(m.bench), deadlift: posKg(m.deadlift) };
};

// Stored JSONB (or null) → safe params.
export function toStrengthParams(raw: unknown): StrengthGoalParams {
  const p = (raw ?? {}) as Partial<StrengthGoalParams>;
  return { oneRepMaxKg: maxes(p.oneRepMaxKg), goalThirdKg: maxes(p.goalThirdKg) };
}

// Validate the collection-form inputs. At least one 1RM is required; each field is optional-but-plausible.
export function parseStrengthParams(input: {
  squat: string; bench: string; deadlift: string; goalSquat: string; goalBench: string; goalDeadlift: string;
}): ParseResult<StrengthGoalParams> {
  const one = (s: string, label: string): { ok: true; v: number | null } | { ok: false; error: string } => {
    const t = s.trim();
    if (t === '') return { ok: true, v: null };
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > 600) return { ok: false, error: `Enter a valid ${label} in kg (or leave it blank).` };
    return { ok: true, v: Math.round(n) };
  };
  const fields: [string, string][] = [
    [input.squat, 'squat'], [input.bench, 'bench'], [input.deadlift, 'deadlift'],
    [input.goalSquat, 'goal squat'], [input.goalBench, 'goal bench'], [input.goalDeadlift, 'goal deadlift'],
  ];
  const parsed = fields.map(([s, label]) => one(s, label));
  const bad = parsed.find((r) => !r.ok);
  if (bad && !bad.ok) return { ok: false, error: bad.error };
  const [sq, be, dl, gsq, gbe, gdl] = parsed.map((r) => (r.ok ? r.v : null));
  if (sq == null && be == null && dl == null) return { ok: false, error: 'Enter at least one 1RM (squat, bench, or deadlift).' };
  return { ok: true, value: { oneRepMaxKg: { squat: sq, bench: be, deadlift: dl }, goalThirdKg: { squat: gsq, bench: gbe, deadlift: gdl } } };
}
```

- [ ] **Step 4: Widen the `GoalParams` type + thread `strengthParams`.**
  - `types/onboarding.ts`: `OnboardingDraft.goalParams?: import('@/services/coaching/strength-params').GoalParams | null` (was `UltraGoalParams`).
  - `types/preferences.ts`: rename `UserPreferences.ultraParams` → `goalParams?: GoalParams | null` (import `GoalParams`). This is the generic goal_params carrier.
  - `store/onboardingStore.ts`: change `goalParams: UltraGoalParams | null` → `GoalParams | null` and `setGoalParams: (params: GoalParams) => void` (import `GoalParams`).
  - `services/onboarding.ts` `buildPlanPreferences`: change `ultraParams: draft.goalParams ?? null` → `goalParams: draft.goalParams ?? null` (the renamed field). The `completeOnboarding` insert already writes `goal_params: draft.goalParams ?? null` — no change.
  - `app/preferences.tsx` `handleGenerate`: change the preferences object's `ultraParams` key → `goalParams` (Task 7 sets its value; here just rename the existing ultra spread's key).
  - `index.ts` upsert (line 543): change `goal_params: (prefs.ultraParams as unknown) ?? null` → `goal_params: (prefs.goalParams as unknown) ?? null`.
  - `coaching/envelope.ts` `EnvelopeInput`: add `strengthParams?: import('./strength-params').StrengthGoalParams | null;`.
  - `coaching/build-envelope.ts`: add `strengthParams: StrengthGoalParams | null` to `EnvelopeInputs`; in the default `inputs` add `strengthParams: null`; in the populated `inputs` add `strengthParams: g?.primary_goal === 'lift' ? toStrengthParams(g?.goal_params) : null` (import `toStrengthParams` + `StrengthGoalParams`); pass `strengthParams: i.strengthParams` in the `envelopeFromInputs` → `computeEnvelope` call. (`goal_params` is already in the `user_goals` select.)

- [ ] **Step 5: Add the lift 1RM accessor** (`services/lift-analytics.ts`) for the hybrid pre-fill. `estimate1RM` is module-private and `prs` is capped at top-5; add an exported helper that maps a lift → the canonical exercise name → its `bestE1rmKg` from `prs`:
```typescript
const LIFT_EXERCISE_NAME: Record<PowerliftingLift, string> = { squat: 'Back Squat', bench: 'Bench Press', deadlift: 'Deadlift' };
/** Best estimated 1RM (kg) for a comp lift from analytics.prs, or null if it isn't in the athlete's top lifts. */
export function bestE1rmForLift(analytics: LiftAnalytics, lift: PowerliftingLift): number | null {
  const pr = analytics.prs.find((p) => p.exerciseName === LIFT_EXERCISE_NAME[lift]);
  return pr ? Math.round(pr.bestE1rmKg) : null;
}
```
Import `PowerliftingLift` from `@/services/calculators/powerlifting`. Test in `lift-analytics.test.ts`: `bestE1rmForLift({ prs: [{ exerciseName: 'Back Squat', bestE1rmKg: 205.4, achievedOn: '…' }], … } as any, 'squat')` → `205`; a missing lift → `null`.

- [ ] **Step 6: Add a lift `buildPlanPreferences` round-trip pin** (`onboarding.test.ts`, the ultra-Critical lesson generalized): `buildPlanPreferences({ …draft, primaryGoal: 'lift', goalParams: { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 } } }).goalParams` equals that object — so the edge upsert re-persists a lifter's maxes instead of nulling them.

- [ ] **Step 7: Run — expect PASS** (all three test files) + `npm run typecheck` + full app suite; `deno check supabase/functions/ozzie-generate-plan/index.ts` (26 pre-existing errors, none new).

- [ ] **Step 8: Commit** — `git add` the created + modified files above ; `git commit -m "feat(coaching): strength-params + GoalParams plumbing + lift 1RM accessor (phase3-powerlifting)"`

---

### Task 2: Export the tables + `StrengthPrescription` envelope field

**Files:**
- Modify: `OSPREY-app/src/services/calculators/powerlifting.ts` (export the tables), `OSPREY-app/src/services/coaching/envelope.ts`
- Create: `OSPREY-app/src/services/coaching/strength.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/strength.test.ts`, `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` (add lift cases)

**Interfaces:**
- Consumes: `StrengthGoalParams` + `EnvelopeInput.strengthParams` (Task 1); `intensityZoneForPercent1RM`, `prilepinRange`, `attemptSelector`, `AttemptPlan` (calculators).
- Produces: `StrengthPrescription` (see below); `buildStrengthPrescription(input): StrengthPrescription | null`; `CoachingEnvelope.strength: StrengthPrescription | null`. Tasks 5/6 mirror `StrengthPrescription` in Deno.

- [ ] **Step 1: Export the tables** — in `powerlifting.ts`, change `const PRILEPIN_TABLE` → `export const PRILEPIN_TABLE` (line 8) and `const INTENSITY_ZONES` → `export const INTENSITY_ZONES` (line 30). (No other change; the lookup fns already exist.)

- [ ] **Step 2: Failing test** — `strength.test.ts`:
```typescript
import { buildStrengthPrescription } from '@/services/coaching/strength';

const base = () => ({
  sport: 'lift', phase: 'Base', weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'intermediate', bodyWeightKg: 90,
  rowingSplitSecPer500: null,
  strengthParams: { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 }, goalThirdKg: { squat: 210, bench: 145, deadlift: 250 } },
} as any);

describe('buildStrengthPrescription', () => {
  it('maps Base → the Strength-Volume zone at 80% with Prilepin caps', () => {
    const s = buildStrengthPrescription(base())!;
    expect(s.workingPercent1RM).toBe(80);
    expect(s.zone.name).toBe('Strength-Volume');
    expect(s.zone.percent1RM).toEqual([75, 85]);
    expect(s.prilepin.repsPerSet).toEqual([2, 4]); // Prilepin @80%
    expect(s.oneRepMaxKg).toEqual({ squat: 200, bench: 140, deadlift: 240 });
    expect(s.attempts).toBeNull(); // no attempts outside Peak/Taper
  });
  it('maps Build → Max Strength (88%) and Peak → Peak/Test (95%) with an attempt card', () => {
    expect(buildStrengthPrescription({ ...base(), phase: 'Build' })!.zone.name).toBe('Max Strength');
    const peak = buildStrengthPrescription({ ...base(), phase: 'Peak' })!;
    expect(peak.zone.name).toBe('Peak / Test');
    expect(peak.attempts).not.toBeNull();
    expect(peak.attempts!.squat.opener.min).toBeCloseTo(210 * 0.89, 1); // opener off the goal third
  });
  it('is null for a non-lift sport', () => {
    expect(buildStrengthPrescription({ ...base(), sport: 'run' })).toBeNull();
  });
});
```

- [ ] **Step 3: Implement `strength.ts`:**
```typescript
import { intensityZoneForPercent1RM, prilepinRange, attemptSelector, AttemptPlan, PowerliftingLift } from '@/services/calculators/powerlifting';
import { Range } from '@/services/calculators/types';
import { Phase } from './periodization';
import type { EnvelopeInput } from './envelope';

export interface StrengthPrescription {
  oneRepMaxKg: { squat: number; bench: number; deadlift: number };
  workingPercent1RM: number;                          // % that × 1RM = the day's working load
  zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
  prilepin: { repsPerSet: [number, number]; totalReps: [number, number] };
  fatG: Range;                                        // daily fat target (powerlifting-specific; not in FuelPlan)
  attempts: { squat: AttemptPlan; bench: AttemptPlan; deadlift: AttemptPlan } | null; // Peak/Taper only
}

// Block periodization → one representative working %1RM per phase (docs/coaching/powerlifting.md §2).
// Each value lands inside an INTENSITY_ZONES band, so intensityZoneForPercent1RM never returns null.
const STRENGTH_PHASE_PERCENT: Record<Phase, number> = { Base: 80, Build: 88, Peak: 95, Taper: 90 };

export function buildStrengthPrescription(input: EnvelopeInput): StrengthPrescription | null {
  if (input.sport !== 'lift') return null;
  const p = input.strengthParams;
  const orm = { squat: p?.oneRepMaxKg.squat ?? 0, bench: p?.oneRepMaxKg.bench ?? 0, deadlift: p?.oneRepMaxKg.deadlift ?? 0 };
  const pct = STRENGTH_PHASE_PERCENT[input.phase];
  const z = intensityZoneForPercent1RM(pct)!;
  const pr = prilepinRange(pct);
  const fatG: Range = { min: Math.round(input.bodyWeightKg * 0.8), max: Math.round(input.bodyWeightKg * 1.5) };
  const goalThird = (lift: PowerliftingLift) => p?.goalThirdKg?.[lift] ?? p?.oneRepMaxKg[lift] ?? 0;
  const attempts = (input.phase === 'Peak' || input.phase === 'Taper')
    ? { squat: attemptSelector(goalThird('squat')), bench: attemptSelector(goalThird('bench')), deadlift: attemptSelector(goalThird('deadlift')) }
    : null;
  return {
    oneRepMaxKg: orm, workingPercent1RM: pct,
    zone: { name: z.name, percent1RM: z.percent1RMRange, reps: z.repRange, rpe: z.rpeRange, rir: z.rirRange },
    prilepin: { repsPerSet: pr.repsPerSet, totalReps: pr.totalReps },
    fatG, attempts,
  };
}
```

- [ ] **Step 4: Wire the envelope** (`envelope.ts`): `import { buildStrengthPrescription, StrengthPrescription } from './strength';` add `strength: StrengthPrescription | null;` to `CoachingEnvelope` (after `fuel`); in `computeEnvelope`, before the `return`, add `const strength = buildStrengthPrescription(input);` and add `strength,` to the returned object. (Non-lift → `null`, so `zones`/`hrZones`/`fuel` are byte-identical.) Add lift cases to `envelope.test.ts`: a `sport: 'lift'` envelope has a non-null `strength`; a `sport: 'run'` envelope has `strength: null` and its other fields are byte-identical (regression).

- [ ] **Step 5: Run — expect PASS** (`strength.test.ts`, `envelope.test.ts`, full suite) + typecheck.

- [ ] **Step 6: Commit** — `git add powerlifting.ts strength.ts envelope.ts` + the 2 test files ; `git commit -m "feat(coaching): StrengthPrescription envelope field (phase→%1RM zone + Prilepin + attempts) (phase3-powerlifting)"`

---

### Task 3: Lift-primary day-routing fix

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/goals.ts`, `OSPREY-app/src/constants/sports.ts`
- Test: `supabase/functions/ozzie-generate-plan/goals.test.ts`, `OSPREY-app/src/constants/__tests__/sports.test.ts`

**Interfaces:**
- Produces: `routeDisciplineDays('lift', primaryDays, liftDays, …)` routes the bulk to **lift** (`weeklyLiftDays = primaryDays`, `weeklyRunDays = min(2, liftDays)` conditioning); `primaryDayLabel('lift') === 'Lift days per week'`.

- [ ] **Step 1: Failing tests.** `goals.test.ts` (Deno):
```typescript
Deno.test('lift routes the bulk of days to lifting (not running)', () => {
  const d = routeDisciplineDays('lift', 3, 2, false, false); // 5-day builder → primaryDays 3, liftDays 2
  assertEquals(d.weeklyLiftDays, 3);          // the bulk is lifting
  assertEquals(d.weeklyRunDays, 2);           // min(2, liftDays) easy-cardio conditioning
  assertEquals(d.weeklySwimDays, 0);
});
Deno.test('non-lift routing is unchanged (regression)', () => {
  assertEquals(routeDisciplineDays('run', 3, 2, false, false).weeklyRunDays, 3);
  assertEquals(routeDisciplineDays('cycling', 4, 1, false, false).weeklyBikeDays, 4);
});
```
`sports.test.ts` (Jest): `expect(primaryDayLabel('lift')).toBe('Lift days per week');`

- [ ] **Step 2: Run — expect FAIL** (lift currently routes run-primary; label is "Run days per week").

- [ ] **Step 3: Implement.** In `goals.ts` `routeDisciplineDays`, add a lift branch at the top of the function body (before the `discipline` lookup):
```typescript
  if (primaryGoal === 'lift') {
    // Strength-primary: the bulk of days are lifting; keep 1-2 easy-cardio days for
    // recovery (docs/coaching/powerlifting.md §5). primaryDays is the bigger share.
    return {
      weeklyRunDays: Math.min(2, liftDays),
      weeklyLiftDays: primaryDays,
      weeklySwimDays: includeSwim ? 1 : 0,
      weeklyBikeDays: includeBike ? 1 : 0,
      weeklyRowDays: 0,
    };
  }
```
In `sports.ts` `primaryDayLabel`, add `if (goal === 'lift') return 'Lift days per week';` (before the final `return`).

- [ ] **Step 4: Run — expect PASS** (both test files + full edge dir + full app suite; the regression tests confirm run/cycling/swim routing unchanged).

- [ ] **Step 5: Commit** — `git add goals.ts goals.test.ts sports.ts sports.test.ts` ; `git commit -m "fix(coaching): route lift goals lift-primary, not run-primary (phase3-powerlifting)"`

---

### Task 4: Powerlifting nutrition + shared protein-in-prompt

**Files:**
- Modify: `OSPREY-app/src/services/coaching/fuel.ts`, `supabase/functions/ozzie-generate-plan/index.ts` (the fuel prompt line only)
- Test: `OSPREY-app/src/services/coaching/__tests__/fuel.test.ts`

**Interfaces:**
- Produces: `computeFuel('lift', bw)` → powerlifting carbs (4–7 g/kg by volume) + protein (1.6–2.2 g/kg) + `longSessionCarbGPerHour: 0`. The shared `envelopeGuidance` fuel line now states protein for **all** sports.

- [ ] **Step 1: Failing test** — add to `fuel.test.ts`:
```typescript
it('gives a lifter powerlifting carbs (4-7 g/kg) + no in-session rate', () => {
  const f = computeFuel('lift', 90);
  expect(f.longSessionCarbGPerHour).toBe(0);
  expect(f.dailyCarbGByDayType.easy.min).toBe(Math.round(4 * 90)); // low end of 4-7 g/kg
  expect(f.dailyCarbGByDayType.peak.max).toBe(Math.round(7 * 90)); // high end
  expect(f.proteinG.min).toBe(Math.round(90 * 1.6));
});
it('leaves non-lift fuel unchanged (regression)', () => {
  expect(computeFuel('run', 70).longSessionCarbGPerHour).toBe(75); // marathon default
});
```

- [ ] **Step 2: Run — expect FAIL** (lift currently gets the endurance carb ladder + a marathon in-session rate).

- [ ] **Step 3: Implement `fuel.ts`.** Add the import `import { powerliftingDailyNutrition } from '@/services/calculators/powerlifting';` and a lift branch at the TOP of `computeFuel` (before the endurance path):
```typescript
export function computeFuel(sport: string, bodyWeightKg: number, gutTrained = false): FuelPlan {
  if (sport === 'lift') {
    const n = powerliftingDailyNutrition(bodyWeightKg);      // carbG 4-7 g/kg, proteinG 1.6-2.2
    const mid = Math.round((n.carbG.min + n.carbG.max) / 2);
    const low: Range = { min: Math.round(n.carbG.min), max: mid };      // rest/easy days
    const high: Range = { min: mid, max: Math.round(n.carbG.max) };     // high-volume days
    return {
      dailyCarbGByDayType: { easy: low, moderate: low, high, peak: high },
      proteinG: { min: Math.round(n.proteinG.min), max: Math.round(n.proteinG.max) },
      longSessionCarbGPerHour: 0,                            // no endurance in-session fueling
    };
  }
  const carb = (dt: EnduranceDayType) => dailyCarbGrams(dt, bodyWeightKg);
  return {
    dailyCarbGByDayType: { easy: carb('easy'), moderate: carb('moderate'), high: carb('high'), peak: carb('peak') },
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.2) },
    longSessionCarbGPerHour: inSessionCarbGPerHour(sport, gutTrained),
  };
}
```
> The test expects `easy.min === 4*90 === 360` and `peak.max === 7*90 === 630`. `powerliftingDailyNutrition` returns un-rounded `{min: 4*bw, max: 7*bw}`; `Math.round` makes it exact for integer `bw`.

- [ ] **Step 4: Shared protein-in-prompt.** In `index.ts` `envelopeGuidance` (line 338), add protein to the fuel line — change it to:
```typescript
      ` Daily carbs by day: easy ${envelope.fuel.dailyCarbGByDayType.easy.min}-${envelope.fuel.dailyCarbGByDayType.easy.max} g, hard ${envelope.fuel.dailyCarbGByDayType.high.min}-${envelope.fuel.dailyCarbGByDayType.high.max} g, race ${envelope.fuel.dailyCarbGByDayType.peak.min}-${envelope.fuel.dailyCarbGByDayType.peak.max} g; protein ${envelope.fuel.proteinG.min}-${envelope.fuel.proteinG.max} g/day; in-session ~${envelope.fuel.longSessionCarbGPerHour} g/hr.`
```
(Additive prompt text — `proteinG` is already on the `Envelope.fuel` mirror. No behavior change; benefits every sport.)

- [ ] **Step 5: Run — expect PASS** (`fuel.test.ts` + full app suite) + `deno test supabase/functions/ozzie-generate-plan/` (all green — no test asserts the prompt string) + `deno check` unchanged (26).

- [ ] **Step 6: Commit** — `git add fuel.ts fuel.test.ts index.ts` ; `git commit -m "feat(coaching): powerlifting nutrition + surface protein in the prompt for all sports (phase3-powerlifting)"`

---

### Task 5: Prompt rework + `Envelope` mirror + `strengthGuidance`

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` (`PLAN_SYSTEM_PROMPT` lift rule, the `Envelope` mirror, `envelopeGuidance`)

**Interfaces:**
- Consumes: `CoachingEnvelope.strength` (Task 2) over the wire.
- Produces: lift days emit structured %1RM loads; the `Envelope` mirror gains `strength`; a `strengthGuidance` block carries the numbers.

- [ ] **Step 1: Mirror `StrengthPrescription`** on the edge `Envelope` interface (after `fuel`, line 130):
```typescript
  strength?: {
    oneRepMaxKg: { squat: number; bench: number; deadlift: number };
    workingPercent1RM: number;
    zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
    prilepin: { repsPerSet: [number, number]; totalReps: [number, number] };
    fatG: { min: number; max: number };
    attempts: { squat: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } }; bench: typeof attempts.squat; deadlift: typeof attempts.squat } | null;
  } | null;
```
> Write the `attempts` sub-shape out in full (three lifts, each with opener/second/third `{min,max}`) rather than the `typeof` shorthand — Deno needs a concrete literal. Keep it in sync with `strength.ts`.

- [ ] **Step 2: Add `strengthGuidance`** in `generateWeekDays`, and append it to `envelopeGuidance`. When `envelope.strength` is present, emit a block like:
```typescript
  const s = envelope?.strength;
  const strengthGuidance = !s ? '' :
    ` STRENGTH (powerlifting): work the comp lifts at ~${s.workingPercent1RM}% 1RM — squat ${Math.round(s.oneRepMaxKg.squat * s.workingPercent1RM / 100)}kg, bench ${Math.round(s.oneRepMaxKg.bench * s.workingPercent1RM / 100)}kg, deadlift ${Math.round(s.oneRepMaxKg.deadlift * s.workingPercent1RM / 100)}kg (zone "${s.zone.name}", RPE ${s.zone.rpe[0]}-${s.zone.rpe[1]}, RIR ${s.zone.rir[0]}-${s.zone.rir[1]}). Keep top-set volume within Prilepin: ${s.prilepin.repsPerSet[0]}-${s.prilepin.repsPerSet[1]} reps/set, ${s.prilepin.totalReps[0]}-${s.prilepin.totalReps[1]} total reps at this intensity; then back-off volume + a variation + 2-3 accessories. Daily fat ${s.fatG.min}-${s.fatG.max} g; creatine 3-5 g/day.` +
    (s.attempts ? ` MEET WEEK — plan openers (~90% of goal): squat ${Math.round(s.attempts.squat.opener.min)}-${Math.round(s.attempts.squat.opener.max)}kg, bench ${Math.round(s.attempts.bench.opener.min)}-${Math.round(s.attempts.bench.opener.max)}kg, deadlift ${Math.round(s.attempts.deadlift.opener.min)}-${Math.round(s.attempts.deadlift.opener.max)}kg; each lift's 2nd/3rd build to the goal third.` : '');
```
Append `strengthGuidance` into the `envelopeGuidance` concatenation (after the fuel line).

- [ ] **Step 3: Rework the `lift_prescription` rule** (line 41) so lift days emit real powerlifting programming AND a structured load the guardrail can check. Replace the bodybuilder-whitelist rule with:
```
- lift_prescription: for lift days ONLY. When a STRENGTH block is given (powerlifting), program a competition lift first — name EXACTLY "Back Squat", "Bench Press", or "Deadlift" — as the top working set at the prescribed %1RM load (set "loadKg" to the kg from the STRENGTH block for that lift), sets/reps within the Prilepin caps, then back-off sets, one variation (e.g. "Pause Squat", "Spoto Press", "Deficit Deadlift"), and 2-3 accessories (rows, pull-ups, RDLs, triceps, upper back, abs). Shape: {"exercises": [{"name": string, "sets": number, "reps": string, "loadKg": number|null, "note": string|null}]}, 4-6 exercises, the comp lift first with its loadKg set. When NO strength block is given, fall back to a general strength session (no loadKg needed). For every non-lift day, set lift_prescription to null.
```
Also add `"loadKg": number|null` to each exercise in the JSON-schema line (line 44) exercise shape.

- [ ] **Step 4: Verify** — `deno test supabase/functions/ozzie-generate-plan/` (all green — additive; no test asserts the prompt) + `deno check supabase/functions/ozzie-generate-plan/index.ts` (26 pre-existing errors, none referencing `strength`).

- [ ] **Step 5: Commit** — `git add index.ts` ; `git commit -m "feat(edge): powerlifting prompt rework + strength envelope mirror + guidance (phase3-powerlifting)"`

---

### Task 6: `validate.ts` load guardrail — the isolated risky task

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/validate.ts`
- Test: `supabase/functions/ozzie-generate-plan/validate.test.ts`

**Interfaces:**
- Produces: a `lift`-gated step that clamps a comp-lift's `loadKg` into the zone's `%1RM × 1RM` band; leaves reps within Prilepin; non-lift plans and load-free lift days pass through. Pace-clamp + polarization + fuel-attach stay **byte-identical**.

- [ ] **Step 1: Write / update tests** — `validate.test.ts`:
```typescript
Deno.test('clamps an out-of-band comp-lift load into the %1RM band, leaves a valid load', () => {
  const envelope = {
    hardSessionShareMax: 1, zones: null,
    fuel: { dailyCarbGByDayType: { easy: {min:1,max:2}, moderate:{min:1,max:2}, high:{min:1,max:2}, peak:{min:1,max:2} }, proteinG:{min:1,max:2}, longSessionCarbGPerHour:0 },
    strength: { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 }, workingPercent1RM: 80, zone: { name:'Strength-Volume', percent1RM:[75,85], reps:[3,6], rpe:[7,8], rir:[2,3] }, prilepin: { repsPerSet:[2,4], totalReps:[10,20] }, fatG:{min:1,max:2}, attempts: null },
  };
  const days = [
    { dayOffset: 0, session_type: 'lift', intensity: 'moderate', planned_minutes: 60, planned_distance_km: null,
      lift_prescription: { exercises: [ { name: 'Back Squat', sets: 4, reps: '4', loadKg: 400, note: null }, { name: 'Barbell Row', sets: 3, reps: '8', loadKg: null, note: null } ] } },
    { dayOffset: 1, session_type: 'lift', intensity: 'moderate', planned_minutes: 60, planned_distance_km: null,
      lift_prescription: { exercises: [ { name: 'Bench Press', sets: 4, reps: '4', loadKg: 112, note: null } ] } }, // 80% of 140 = 112, in band
  ];
  const { days: out, changed } = validateAndClamp(days as any, envelope as any);
  const squat = (out[0] as any).lift_prescription.exercises[0].loadKg;
  assertEquals(squat >= 200*0.75 && squat <= 200*0.85, true); // clamped into [150,170]
  assertEquals((out[1] as any).lift_prescription.exercises[0].loadKg, 112); // valid → untouched
  assertEquals((out[0] as any).lift_prescription.exercises[1].loadKg, null); // accessory untouched
  assertEquals(changed.some((c) => c.includes('squat')), true);
});
Deno.test('non-lift plan + load-free lift day pass through the guardrail untouched', () => {
  // an envelope with no strength, or a lift day with no loadKg, is unchanged
  // (reuse an existing run clamp fixture + assert its output is identical) …
});
```
> Do NOT modify any pace-clamp/polarization test.

- [ ] **Step 2: Run — expect FAIL** (no guardrail yet).

- [ ] **Step 3: Implement.** In `validate.ts`: add a `strength` mirror to `EnvelopeLike`:
```typescript
type StrengthLike = { oneRepMaxKg: { squat: number; bench: number; deadlift: number }; workingPercent1RM: number; zone: { percent1RM: [number, number] }; prilepin: { repsPerSet: [number, number] } };
interface EnvelopeLike { hardSessionShareMax: number; zones: Zones | null; fuel: FuelPlan; strength?: StrengthLike | null; }
```
Add a helper + a new step **(d)** after the fuel-attach (never touching a/b/c):
```typescript
const LIFT_OF: Record<string, 'squat' | 'bench' | 'deadlift'> = { 'Back Squat': 'squat', 'Bench Press': 'bench', 'Deadlift': 'deadlift' };

// (d) lift load guardrail: clamp a comp lift's loadKg into the zone's %1RM band.
const st = envelope.strength;
if (st) {
  out = out.map((d) => {
    if (d.session_type !== 'lift') return d;
    const lp = d.lift_prescription as { exercises?: { name: string; loadKg: number | null }[] } | undefined;
    if (!lp?.exercises) return d;
    let touched = false;
    const exercises = lp.exercises.map((ex) => {
      const lift = LIFT_OF[ex.name];
      if (!lift || ex.loadKg == null) return ex;
      const orm = st.oneRepMaxKg[lift];
      const lo = orm * st.zone.percent1RM[0] / 100;
      const hi = orm * st.zone.percent1RM[1] / 100;
      const clamped = Math.round(Math.min(hi, Math.max(lo, ex.loadKg)));
      if (clamped !== ex.loadKg) { touched = true; changed.push(`day${d.dayOffset}: ${lift} ${ex.loadKg}→${clamped}kg (%1RM guardrail)`); }
      return { ...ex, loadKg: clamped };
    });
    return touched ? { ...d, lift_prescription: { ...lp, exercises } } : d;
  });
}
```
(Place this after step (c). Every earlier step is unchanged → the byte-identical regression gate holds.)

- [ ] **Step 4: Run — expect PASS**: `deno test supabase/functions/ozzie-generate-plan/` — the 2 new guardrail tests + **every existing clamp/polarization/fuel test byte-identical** + `deno check` unchanged (26).

- [ ] **Step 5: Commit** — `git add validate.ts validate.test.ts` ; `git commit -m "feat(edge): lift %1RM load guardrail in validate.ts (phase3-powerlifting)"`

---

### Task 7: Collection UI (onboarding + plan-builder lift fields, hybrid pre-fill)

**Files:**
- Modify: `OSPREY-app/app/(onboarding)/baseline.tsx`, `OSPREY-app/app/preferences.tsx`
- Test: `strength-params.test.ts` (the `parseStrengthParams` coverage from Task 1 backs the validation)

**Interfaces:**
- Consumes: `parseStrengthParams`, `StrengthGoalParams` (Task 1), `bestE1rmForLift` + `fetchLiftAnalytics` (hybrid pre-fill), the `goalParams` persistence paths (Task 1).
- Produces: onboarding + plan-builder capture the 1RMs (+ optional goal thirds + meet date) and persist them to `user_goals.goal_params`.

> This is UI wiring on top of Task 1's tested `parseStrengthParams`. RN screens aren't unit-tested here; verify with `npm run typecheck` + the full suite (screens couldn't be visually rendered headlessly for ultra either — flag the same device-smoke-test caveat).

- [ ] **Step 1: Onboarding baseline** — in `baseline.tsx`, when `primaryGoal === 'lift'` render a strength section (three numeric 1RM inputs — squat/bench/deadlift — **pre-filled** via `fetchLiftAnalytics(userId)` → `bestE1rmForLift(analytics, lift)` on mount when a value exists; optional goal-third inputs). On `onContinue`, validate with `parseStrengthParams` and `setGoalParams(u.value)` before pushing HEALTH (mirror the ultra branch already in this file). Reuse the screen's `styles.field`/`styles.input`. Import `parseStrengthParams` from `@/services/coaching/strength-params`, `bestE1rmForLift` + `fetchLiftAnalytics` from `@/services/lift-analytics`.

- [ ] **Step 2: Plan-builder** — in `preferences.tsx`, add `const isLift = primaryGoal === 'strength';` (the plan-builder's `TrainingGoal` value for lift is `'strength'`), lift state (the 1RMs, seeded from `saved.goalParams` when present), and — when `isLift` — the three 1RM inputs (+ optional goal thirds). In `handleGenerate`: `const strengthParams = isLift ? parseStrengthParams({…}) : null;` — if `isLift && !strengthParams.ok`, `Alert.alert` and return; else include `...(isLift ? { goalParams: strengthParams.value } : {})` in the `preferences` object (the renamed generic field from Task 1), and **persist before generating**: when `isLift`, `await supabase.from('user_goals').update({ goal_params: strengthParams.value }).eq('user_id', userId)` BEFORE `invokeGeneratePlan` (build-envelope reads `goal_params` from the DB — the ultra-Critical lesson). (The ultra section already does this with `ultraParams`; rename its object key to `goalParams` per Task 1 and add the lift branch alongside.)

- [ ] **Step 3: Verify** — `npm run typecheck` clean; full app suite green (`strength-params.test.ts` + `onboarding.test.ts` lift round-trip still pass); load the two screens in the browser preview if Expo web runs (best-effort — note if the pre-existing Expo Router SSR block prevents it, same as ultra).

- [ ] **Step 4: Commit** — `git add baseline.tsx preferences.tsx` ; `git commit -m "feat(app): collect powerlifting 1RMs (hybrid pre-fill) on onboarding + plan-builder (phase3-powerlifting)"`

---

## Post-implementation

- **DEPLOY-CHECKLIST.md** — add a Phase 3 (powerlifting) bullet to §2: **no migration** (lift enum + goal_params + target_date exist); app + edge deploy together (a new-app lift plan hitting the old fn gets the generic bodybuilder prompt — soft degrade). Non-lift plans byte-identical; the `validate.ts` guardrail is `lift`-gated.
- **Memory** — update `osprey-coaching-engine.md`: Phase 3-ii (powerlifting) shipped.
- App + edge deploy together; **⚠️ device smoke test** the two lift collection screens (same headless-render caveat as ultra).

## Self-Review

**Spec coverage:**
- §3 inputs/storage (`StrengthGoalParams`, `GoalParams`, hybrid pre-fill, persistence, buildPlanPreferences) → Task 1 (+ UI Task 7). ✅
- §4 StrengthPrescription envelope (export tables, phase→zone/Prilepin/attempts) → Task 2. ✅
- §5 phase→intensity mapping → Task 2 (`STRENGTH_PHASE_PERCENT`). ✅
- §6 prompt rework + strengthGuidance + Envelope mirror → Task 5. ✅
- §7 lift-primary routing → Task 3. ✅
- §8 meet peaking + attempts → Task 2 (built) + Task 5 (prompted). ✅
- §9 nutrition (fuel lift branch) + shared protein-in-prompt → Task 4. ✅
- §10 validate.ts load guardrail → Task 6 (isolated). ✅
- §11 no migration, non-lift byte-identical → Global Constraints + regression tests in Tasks 2/3/4/6. ✅
- §12 testing → each task. ✅

**Placeholder scan:** none — every code step shows the code. The `>` notes are explicit reconciliations (write the `attempts` sub-shape out in full for Deno; the `powerliftingDailyNutrition` rounding; the `TrainingGoal` value for lift is `'strength'`).

**Type consistency:** `StrengthGoalParams`/`GoalParams`/`toStrengthParams`/`parseStrengthParams` (Task 1) → consumed in Task 2 (`input.strengthParams`), Task 7 (`parseStrengthParams`). `StrengthPrescription` (Task 2) is hand-mirrored in `index.ts` (Task 5) + `validate.ts` `StrengthLike` (Task 6) — the mirrored fields (`oneRepMaxKg`, `workingPercent1RM`, `zone.percent1RM`, `prilepin.repsPerSet`, `fatG`, `attempts`) match. The `goalParams` rename (Task 1) is applied consistently across `UserPreferences` / `buildPlanPreferences` / `preferences.tsx` / the edge upsert, guarded by typecheck. `computeFuel`'s lift branch (Task 4) returns the same `FuelPlan` shape.
