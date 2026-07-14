# Coaching-Engine Phase 2b-ii — Baseline Anchor Input — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an athlete state a real training anchor in an optional onboarding Baseline step, persist it to `user_goals.threshold_anchor`, and make `computeEnvelope` prefer it (`self_report > data-derive > tier`).

**Architecture:** App-only. A new pure `baseline.ts` (parse/validate + shared anchor types + a stored-map→envelope-input flattener) is the TDD core. `computeEnvelope` gains an optional `selfReportAnchor` it prefers per sport; `build-envelope` reads the existing (Phase-1) `threshold_anchor` JSONB column and threads it in. A skippable `baseline.tsx` onboarding screen (after `goals`, before `health`) collects the sport-appropriate input and writes it via the onboarding draft. **No migration, no edge-fn change** — the app resolves the envelope and the edge fn already accepts any `ZoneSet`.

**Tech Stack:** React Native / Expo, TypeScript, Jest (`TZ=Asia/Kolkata jest`), Zustand (onboarding store), expo-router.

## Global Constraints

- **TDD throughout.** Failing test first, watch it fail, then implement. App tests: `npm test` (runs `TZ=Asia/Kolkata jest`) from `OSPREY-app/`.
- **`computeEnvelope` must be byte-identical to today when `selfReportAnchor` is null/absent**, for every sport. Hard regression guard — a test pins it.
- **No migration, no edge-fn change, no webapp change** (this slice). `threshold_anchor JSONB` already exists (Phase 1, `20260714000002`); the webapp zones editor is the separate next slice (see the spec §2/§11).
- **Storage shape:** `user_goals.threshold_anchor` = `{ run?: {thresholdSecPerMile, source}, swim?: {cssSecPer100, source}, row?: {splitSecPer500, source} }`, `source: 'self_report'`. Note the rowing key is **`row`** (not `rowing`).
- **Path alias:** `@/(.*)` → `OSPREY-app/src/$1`. Use `import type` for the anchor type imports to keep them erased (no runtime import cycles).
- **No new dependencies.** Reuse `computeCSSPer100` (swimming.ts), `deriveThresholdSecPerMile` (anchor.ts), `blueprintSport` (zones.ts).

---

## File Structure

**New files:**
- `OSPREY-app/src/services/coaching/baseline.ts` — anchor types + `parseSwimBaseline`/`parseRowingBaseline`/`parseRunBaseline` + `anchorKeyForGoal` + `toSelfReportAnchor`.
- `OSPREY-app/src/services/coaching/__tests__/baseline.test.ts`
- `OSPREY-app/app/(onboarding)/baseline.tsx` — the skippable Baseline screen.

**Modified files:**
- `OSPREY-app/src/services/coaching/envelope.ts` — `EnvelopeInput.selfReportAnchor` + per-sport priority.
- `OSPREY-app/src/services/coaching/build-envelope.ts` — `EnvelopeInputs.selfReportAnchor`, thread it, read `threshold_anchor`.
- `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` — priority + regression tests.
- `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts` — threading test.
- `OSPREY-app/src/types/onboarding.ts` — `OnboardingDraft.thresholdAnchor` (required) + default.
- `OSPREY-app/src/store/onboardingStore.ts` — `setThresholdAnchor`.
- `OSPREY-app/src/services/onboarding.ts` — persist `threshold_anchor` in `completeOnboarding`.
- `OSPREY-app/app/(onboarding)/health.tsx` — include `thresholdAnchor` in the draft object; step 4→5, totalSteps 4→5.
- `OSPREY-app/app/(onboarding)/goals.tsx` — route to `/baseline` (endurance) or `/health`; totalSteps 4→5.
- `OSPREY-app/app/(onboarding)/{welcome,name,mode}.tsx` — totalSteps 4→5.

---

### Task 1: Pure `baseline.ts` — anchor types, parse/validate, flatten

**Files:**
- Create: `OSPREY-app/src/services/coaching/baseline.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/baseline.test.ts`

**Interfaces:**
- Consumes: `computeCSSPer100` (`@/services/calculators/swimming`), `deriveThresholdSecPerMile` (`./anchor`), `blueprintSport` (`./zones`).
- Produces (later tasks depend on these exact names):
  - `type AnchorSource = 'self_report'`
  - `interface ThresholdAnchorMap { run?: {thresholdSecPerMile: number; source: AnchorSource}; swim?: {cssSecPer100: number; source: AnchorSource}; row?: {splitSecPer500: number; source: AnchorSource} }`
  - `interface SelfReportAnchor { thresholdSecPerMile: number | null; cssSecPer100: number | null; splitSecPer500: number | null }`
  - `type ParseResult = { ok: true; value: number } | { ok: false; error: string }`
  - `parseSwimBaseline(time400Sec, time200Sec): ParseResult` (value = cssSecPer100)
  - `parseRowingBaseline(time2kSec): ParseResult` (value = splitSecPer500)
  - `parseRunBaseline(distanceMiles, timeS): ParseResult` (value = thresholdSecPerMile)
  - `anchorKeyForGoal(goal: string): 'run' | 'swim' | 'row' | null`
  - `toSelfReportAnchor(map: ThresholdAnchorMap | null | undefined): SelfReportAnchor`

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/services/coaching/__tests__/baseline.test.ts`:

```typescript
import {
  parseSwimBaseline,
  parseRowingBaseline,
  parseRunBaseline,
  anchorKeyForGoal,
  toSelfReportAnchor,
} from '@/services/coaching/baseline';

describe('parseSwimBaseline', () => {
  it('computes CSS = (400 − 200) / 2 for valid times', () => {
    // 400m in 6:00 (360s), 200m in 2:50 (170s) → CSS = (360-170)/2 = 95 s/100m
    expect(parseSwimBaseline(360, 170)).toEqual({ ok: true, value: 95 });
  });
  it('rejects when the 400 time is not greater than the 200 time (CSS would be ≤ 0)', () => {
    const r = parseSwimBaseline(170, 360);
    expect(r.ok).toBe(false);
  });
  it('rejects non-positive input', () => {
    expect(parseSwimBaseline(0, 0).ok).toBe(false);
  });
});

describe('parseRowingBaseline', () => {
  it('splits a 2k time into sec/500m (time / 4)', () => {
    // 2k in 8:00 (480s) → 120 s/500m
    expect(parseRowingBaseline(480)).toEqual({ ok: true, value: 120 });
  });
  it('rejects an implausible 2k time', () => {
    expect(parseRowingBaseline(30).ok).toBe(false);   // 30s 2k is impossible
    expect(parseRowingBaseline(0).ok).toBe(false);
  });
});

describe('parseRunBaseline', () => {
  it('derives a plausible threshold sec/mile from a recent run', () => {
    // ~6.2 mi (10K) in 50:00 (3000s) → threshold in a sane 4:00–15:00/mi band
    const r = parseRunBaseline(6.2, 3000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeGreaterThan(240);
      expect(r.value).toBeLessThan(900);
    }
  });
  it('rejects non-positive input', () => {
    expect(parseRunBaseline(0, 3000).ok).toBe(false);
    expect(parseRunBaseline(6.2, 0).ok).toBe(false);
  });
});

describe('anchorKeyForGoal', () => {
  it('maps sports to their stored anchor key', () => {
    expect(anchorKeyForGoal('swim')).toBe('swim');
    expect(anchorKeyForGoal('rowing')).toBe('row');
    expect(anchorKeyForGoal('run')).toBe('run');
    expect(anchorKeyForGoal('hyrox')).toBe('run');
    expect(anchorKeyForGoal('hybrid')).toBe('run');
  });
  it('returns null for non-endurance goals (no baseline to collect)', () => {
    expect(anchorKeyForGoal('lift')).toBeNull();
    expect(anchorKeyForGoal('weight_loss')).toBeNull();
    expect(anchorKeyForGoal('general_fitness')).toBeNull();
  });
});

describe('toSelfReportAnchor', () => {
  it('flattens the stored per-sport map to the flat envelope input', () => {
    expect(toSelfReportAnchor({ swim: { cssSecPer100: 95, source: 'self_report' } })).toEqual({
      thresholdSecPerMile: null,
      cssSecPer100: 95,
      splitSecPer500: null,
    });
  });
  it('returns all-null for null/undefined', () => {
    expect(toSelfReportAnchor(null)).toEqual({
      thresholdSecPerMile: null,
      cssSecPer100: null,
      splitSecPer500: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/coaching/__tests__/baseline.test.ts`
Expected: FAIL — `@/services/coaching/baseline` does not exist.

- [ ] **Step 3: Implement `baseline.ts`**

Create `OSPREY-app/src/services/coaching/baseline.ts`:

```typescript
import { computeCSSPer100 } from '@/services/calculators/swimming';
import { deriveThresholdSecPerMile } from './anchor';
import { blueprintSport } from './zones';

export type AnchorSource = 'self_report';

// Stored shape of user_goals.threshold_anchor (rowing key is `row`, not `rowing`).
export interface ThresholdAnchorMap {
  run?: { thresholdSecPerMile: number; source: AnchorSource };
  swim?: { cssSecPer100: number; source: AnchorSource };
  row?: { splitSecPer500: number; source: AnchorSource };
}

// Flat shape consumed by computeEnvelope (see envelope.ts EnvelopeInput).
export interface SelfReportAnchor {
  thresholdSecPerMile: number | null;
  cssSecPer100: number | null;
  splitSecPer500: number | null;
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

// Plausibility guards keep a typo from poisoning the athlete's zones for weeks.
export function parseSwimBaseline(time400Sec: number, time200Sec: number): ParseResult {
  if (!Number.isFinite(time400Sec) || !Number.isFinite(time200Sec) || time200Sec <= 0) {
    return { ok: false, error: 'Enter both swim times in seconds.' };
  }
  if (time400Sec <= time200Sec) {
    return { ok: false, error: 'Your 400m time should be greater than your 200m time.' };
  }
  const css = computeCSSPer100(time400Sec, time200Sec);
  if (css < 40 || css > 200) {
    return { ok: false, error: "That doesn't look like a valid swim — check your times." };
  }
  return { ok: true, value: css };
}

export function parseRowingBaseline(time2kSec: number): ParseResult {
  if (!Number.isFinite(time2kSec) || time2kSec <= 0) {
    return { ok: false, error: 'Enter your 2k time in seconds.' };
  }
  const split = time2kSec / 4; // 2000 m ÷ 500 m
  if (split < 80 || split > 180) {
    return { ok: false, error: "That doesn't look like a valid 2k time." };
  }
  return { ok: true, value: split };
}

export function parseRunBaseline(distanceMiles: number, timeS: number): ParseResult {
  if (!Number.isFinite(distanceMiles) || !Number.isFinite(timeS) || distanceMiles <= 0 || timeS <= 0) {
    return { ok: false, error: 'Enter a distance and a time.' };
  }
  const threshold = deriveThresholdSecPerMile(distanceMiles, timeS);
  if (threshold < 240 || threshold > 900) {
    return { ok: false, error: "That doesn't look right — check the distance and time." };
  }
  return { ok: true, value: threshold };
}

// The stored anchor key for a primary goal, or null if the goal has no endurance
// anchor to collect. Reuses blueprintSport (run/hybrid/hyrox→run, swim, rowing).
export function anchorKeyForGoal(goal: string): 'run' | 'swim' | 'row' | null {
  const bp = blueprintSport(goal);
  return bp === 'rowing' ? 'row' : bp; // 'run' | 'swim' | null pass through
}

export function toSelfReportAnchor(map: ThresholdAnchorMap | null | undefined): SelfReportAnchor {
  return {
    thresholdSecPerMile: map?.run?.thresholdSecPerMile ?? null,
    cssSecPer100: map?.swim?.cssSecPer100 ?? null,
    splitSecPer500: map?.row?.splitSecPer500 ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/coaching/__tests__/baseline.test.ts`
Expected: PASS (all cases). If `parseRunBaseline`'s bounds reject the 10K fixture, read `deriveThresholdSecPerMile`'s output for `(6.2, 3000)` and widen the fixture/bounds to match reality — the derived value is authoritative, keep the assertion a sane band.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/baseline.ts OSPREY-app/src/services/coaching/__tests__/baseline.test.ts
git commit -m "feat(coaching): pure Baseline anchor parse/validate + shared anchor types (2b-ii)"
```

---

### Task 2: `computeEnvelope` self-report priority

**Files:**
- Modify: `OSPREY-app/src/services/coaching/envelope.ts` (`EnvelopeInput` ~`:20`, `computeEnvelope` ~`:44-57`)
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts`

**Interfaces:**
- Consumes: `SelfReportAnchor` (Task 1).
- Produces: `EnvelopeInput.selfReportAnchor?: SelfReportAnchor | null` — a value present there wins over data/tier.

- [ ] **Step 1: Write the failing test**

Add to `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` (keep existing tests):

```typescript
import { computeEnvelope, EnvelopeInput } from '@/services/coaching/envelope';

const base: EnvelopeInput = {
  sport: 'swim', phase: 'Base', weekNumber: 1, totalWeeks: 8,
  baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
  fitnessLevel: 'beginner', bodyWeightKg: 70,
};

describe('computeEnvelope self-report priority', () => {
  it('prefers a self-reported swim CSS over the tier estimate', () => {
    const env = computeEnvelope({ ...base, sport: 'swim', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: 88, splitSecPer500: null } });
    expect(env.zones).toMatchObject({ kind: 'swim', cssSecPer100: 88 });
  });
  it('prefers a self-reported run threshold over data/tier', () => {
    const env = computeEnvelope({ ...base, sport: 'run', selfReportAnchor: { thresholdSecPerMile: 400, cssSecPer100: null, splitSecPer500: null } });
    expect(env.zones).toMatchObject({ kind: 'run', thresholdSecPerMile: 400 });
  });
  it('prefers a self-reported rowing split over data/tier', () => {
    const env = computeEnvelope({ ...base, sport: 'rowing', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: 108 } });
    expect(env.zones).toMatchObject({ kind: 'rowing', splitSecPer500: 108 });
  });
  it('is unchanged when selfReportAnchor is absent (regression guard)', () => {
    const withField = computeEnvelope({ ...base, sport: 'swim', selfReportAnchor: null });
    const withoutField = computeEnvelope({ ...base, sport: 'swim' });
    expect(withField).toEqual(withoutField);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/coaching/__tests__/envelope.test.ts`
Expected: FAIL — `selfReportAnchor` is not on `EnvelopeInput` (ts-jest type error) / the CSS is the tier estimate, not 88.

- [ ] **Step 3: Add the field + the priority**

In `envelope.ts`, add the import and the field:

```typescript
import type { SelfReportAnchor } from './baseline';
```

Add to `EnvelopeInput` (after `rowingSplitSecPer500`):

```typescript
  rowingSplitSecPer500: number | null;
  selfReportAnchor?: SelfReportAnchor | null;
```

Replace the three zone branches in `computeEnvelope` (the `if (bp === 'run')` block) with:

```typescript
  if (bp === 'run') {
    const t =
      input.selfReportAnchor?.thresholdSecPerMile ??
      resolveRunningAnchor({
        bestRunMiles: input.bestRunMiles,
        bestRunTimeS: input.bestRunTimeS,
        fitnessLevel: input.fitnessLevel,
      }).thresholdSecPerMile;
    zones = { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) };
  } else if (bp === 'swim') {
    const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
    zones = { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) };
  } else if (bp === 'rowing') {
    const split =
      input.selfReportAnchor?.splitSecPer500 ??
      input.rowingSplitSecPer500 ??
      estimateRowingSplitByTier(input.fitnessLevel);
    zones = { kind: 'rowing', splitSecPer500: split, bands: rowingTrainingZones(split) };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/coaching/__tests__/envelope.test.ts`
Expected: PASS (priority + regression). Then `npm run typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "feat(coaching): computeEnvelope prefers self-report anchor over data/tier (2b-ii)"
```

---

### Task 3: `build-envelope` reads `threshold_anchor` + threads `selfReportAnchor`

**Files:**
- Modify: `OSPREY-app/src/services/coaching/build-envelope.ts` (`EnvelopeInputs` `:9`, `envelopeFromInputs` `:29`, defaults `:49`, `user_goals` select `:57`, inputs assembly `:83`)
- Test: `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts`

**Interfaces:**
- Consumes: `toSelfReportAnchor`, `SelfReportAnchor`, `ThresholdAnchorMap` (Task 1); `EnvelopeInput.selfReportAnchor` (Task 2).
- Produces: `EnvelopeInputs.selfReportAnchor` threaded through `envelopeFromInputs`.

- [ ] **Step 1: Write the failing test**

Add to `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts` (keep existing tests; match their `envelopeFromInputs` fixture style):

```typescript
import { envelopeFromInputs } from '@/services/coaching/build-envelope';

it('threads a self-reported swim CSS into the envelope', () => {
  const env = envelopeFromInputs({
    sport: 'swim', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
    baselineLoad: 200, prevWeekLoad: null,
    bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
    selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: 90, splitSecPer500: null },
  });
  expect(env.zones).toMatchObject({ kind: 'swim', cssSecPer100: 90 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/coaching/__tests__/build-envelope.test.ts`
Expected: FAIL — `selfReportAnchor` is not on `EnvelopeInputs` (type error).

- [ ] **Step 3: Add the field, thread it, read the column**

In `build-envelope.ts`:

Add the import (top, with the other `./` imports):
```typescript
import { toSelfReportAnchor, type SelfReportAnchor, type ThresholdAnchorMap } from './baseline';
```

Add to the `EnvelopeInputs` interface (after `rowingSplitSecPer500`):
```typescript
  rowingSplitSecPer500: number | null;
  selfReportAnchor: SelfReportAnchor | null;
```

In `envelopeFromInputs`, pass it to `computeEnvelope` (after `rowingSplitSecPer500: i.rowingSplitSecPer500,`):
```typescript
    rowingSplitSecPer500: i.rowingSplitSecPer500,
    selfReportAnchor: i.selfReportAnchor,
```

In the default `inputs` literal (`:49`), add `selfReportAnchor: null,`:
```typescript
  let inputs: EnvelopeInputs = {
    sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
    baselineLoad: 200, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
    rowingSplitSecPer500: null, selfReportAnchor: null,
  };
```

Add `threshold_anchor` to the `user_goals` select:
```typescript
      supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned, threshold_anchor').eq('user_id', userId).maybeSingle(),
```

In the populated `inputs = { … }` assembly (`:83`), add (after `rowingSplitSecPer500: rowingSplit,`):
```typescript
      rowingSplitSecPer500: rowingSplit,
      selfReportAnchor: toSelfReportAnchor(g?.threshold_anchor as ThresholdAnchorMap | null),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/coaching/__tests__/build-envelope.test.ts`
Expected: PASS. Then `npm run typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/build-envelope.ts OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts
git commit -m "feat(coaching): build-envelope reads user_goals.threshold_anchor (2b-ii)"
```

---

### Task 4: Persist the anchor — onboarding draft, store, and `completeOnboarding`

**Files:**
- Modify: `OSPREY-app/src/types/onboarding.ts` (`OnboardingDraft` + `DEFAULT_ONBOARDING_DRAFT`)
- Modify: `OSPREY-app/src/store/onboardingStore.ts` (add `setThresholdAnchor`)
- Modify: `OSPREY-app/src/services/onboarding.ts` (`completeOnboarding` `user_goals` insert `:52`)
- Modify: `OSPREY-app/app/(onboarding)/health.tsx` (include `thresholdAnchor` in the draft object `:26` — the `step`/`totalSteps` renumber is Task 5)

**Interfaces:**
- Consumes: `ThresholdAnchorMap` (Task 1).
- Produces: `OnboardingDraft.thresholdAnchor: ThresholdAnchorMap | null` (required, so any draft literal that omits it is a compile error), `useOnboardingStore().setThresholdAnchor`.

No new unit test — this is DB-writing glue whose correctness is enforced by the type system (the required draft field makes an un-wired call site a compile error) and verified by `npm run typecheck`. This task ends green on its own.

- [ ] **Step 1: Add the draft field + default**

In `OSPREY-app/src/types/onboarding.ts`, add the import at the top and the field:

```typescript
import type { ThresholdAnchorMap } from '@/services/coaching/baseline';
```

Add to `OnboardingDraft` (after `healthConnected`):
```typescript
  healthConnected: boolean;
  thresholdAnchor: ThresholdAnchorMap | null;
```

Add to `DEFAULT_ONBOARDING_DRAFT`:
```typescript
  healthConnected: false,
  thresholdAnchor: null,
```

- [ ] **Step 2: Add the store setter**

In `OSPREY-app/src/store/onboardingStore.ts`:

Add to the `OnboardingState` interface (after `setHealthConnected`):
```typescript
  setHealthConnected: (connected: boolean) => void;
  setThresholdAnchor: (anchor: OnboardingDraft['thresholdAnchor']) => void;
```

Add the implementation (after `setHealthConnected`):
```typescript
  setHealthConnected: (healthConnected) => set({ healthConnected }),
  setThresholdAnchor: (thresholdAnchor) => set({ thresholdAnchor }),
```

- [ ] **Step 3: Persist it in `completeOnboarding`**

In `OSPREY-app/src/services/onboarding.ts`, add `threshold_anchor` to the `user_goals` insert (`:52`):
```typescript
  const { error: goalsError } = await supabase.from('user_goals').insert({
    user_id: userId,
    primary_goal: draft.primaryGoal,
    weekly_run_days: draft.weeklyRunDays,
    weekly_lift_days: draft.weeklyLiftDays,
    fitness_level: draft.experienceTier,
    threshold_anchor: draft.thresholdAnchor,
  });
```

- [ ] **Step 4: Wire it into health.tsx's draft object**

In `OSPREY-app/app/(onboarding)/health.tsx`, add `thresholdAnchor` to the `onboardingDraft` literal (`:26`) so the required field is satisfied and the collected anchor reaches `completeOnboarding`:
```typescript
      const onboardingDraft = {
        displayName: draft.displayName,
        primaryGoal: draft.primaryGoal,
        experienceTier: draft.experienceTier,
        weeklyRunDays: draft.weeklyRunDays,
        weeklyLiftDays: draft.weeklyLiftDays,
        healthConnected: draft.healthConnected,
        thresholdAnchor: draft.thresholdAnchor,
      };
```
(Leave health.tsx's `step`/`totalSteps` alone — that renumber is Task 5.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS — the required `thresholdAnchor` is satisfied everywhere a draft is constructed. (If any *other* draft literal errors, add `thresholdAnchor: null` to it.)

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/types/onboarding.ts OSPREY-app/src/store/onboardingStore.ts OSPREY-app/src/services/onboarding.ts "OSPREY-app/app/(onboarding)/health.tsx"
git commit -m "feat(onboarding): carry threshold_anchor through the draft + persist it (2b-ii)"
```

---

### Task 5: Baseline onboarding screen + flow routing + step renumber

**Files:**
- Create: `OSPREY-app/app/(onboarding)/baseline.tsx`
- Modify: `OSPREY-app/app/(onboarding)/goals.tsx` (routing + `totalSteps`)
- Modify: `OSPREY-app/app/(onboarding)/health.tsx` (`step` 4→5, `totalSteps` 4→5 — the draft object was wired in Task 4)
- Modify: `OSPREY-app/app/(onboarding)/{welcome,name,mode}.tsx` (`totalSteps` only)

**Interfaces:**
- Consumes: `parseSwimBaseline`/`parseRowingBaseline`/`parseRunBaseline`/`anchorKeyForGoal` (Task 1), `useOnboardingStore().setThresholdAnchor` + `primaryGoal` (Task 4).

RN screens have no unit-test harness here — verified by `npm run typecheck` (which also confirms Task 4's wiring closes) and on-device.

- [ ] **Step 1: Create the Baseline screen**

Create `OSPREY-app/app/(onboarding)/baseline.tsx`. It renders the sport-appropriate inputs, validates on continue, writes the anchor to the store, and routes to `health`; a Skip control routes to `health` without writing. (Minutes/seconds inputs convert to seconds before parsing.)

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import {
  parseSwimBaseline,
  parseRowingBaseline,
  parseRunBaseline,
  anchorKeyForGoal,
  type ThresholdAnchorMap,
} from '@/services/coaching/baseline';
import { Colors } from '@/constants/colors';

const HEALTH = '/(onboarding)/health';
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const mmss = (m: string, s: string) => num(m) * 60 + num(s);

export default function BaselineScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const setThresholdAnchor = useOnboardingStore((s) => s.setThresholdAnchor);
  const key = anchorKeyForGoal(primaryGoal);

  // Fields (times as minutes + seconds; run distance in miles).
  const [swim400m, setSwim400m] = useState(''); const [swim400s, setSwim400s] = useState('');
  const [swim200m, setSwim200m] = useState(''); const [swim200s, setSwim200s] = useState('');
  const [row2kM, setRow2kM] = useState(''); const [row2kS, setRow2kS] = useState('');
  const [runMiles, setRunMiles] = useState(''); const [runMin, setRunMin] = useState(''); const [runSec, setRunSec] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onContinue() {
    setError(null);
    let value: number;
    let anchor: ThresholdAnchorMap;
    if (key === 'swim') {
      const r = parseSwimBaseline(mmss(swim400m, swim400s), mmss(swim200m, swim200s));
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { swim: { cssSecPer100: value, source: 'self_report' } };
    } else if (key === 'row') {
      const r = parseRowingBaseline(mmss(row2kM, row2kS));
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { row: { splitSecPer500: value, source: 'self_report' } };
    } else {
      const r = parseRunBaseline(num(runMiles), mmss(runMin, runSec));
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { run: { thresholdSecPerMile: value, source: 'self_report' } };
    }
    setThresholdAnchor(anchor);
    router.push(HEALTH);
  }

  const title =
    key === 'swim' ? 'Know your swim times?' : key === 'row' ? 'Know your 2k?' : 'A recent hard run?';

  return (
    <OnboardingShell
      step={4}
      totalSteps={5}
      title={title}
      hint="Optional — it sharpens your training zones. Skip and Ozzie estimates from your experience, then refines as you log."
      onContinue={onContinue}
      continueLabel="Use these numbers →"
    >
      {key === 'swim' ? (
        <>
          <TimeRow label="400m time" m={swim400m} s={swim400s} setM={setSwim400m} setS={setSwim400s} />
          <TimeRow label="200m time" m={swim200m} s={swim200s} setM={setSwim200m} setS={setSwim200s} />
        </>
      ) : key === 'row' ? (
        <TimeRow label="2k time" m={row2kM} s={row2kS} setM={setRow2kM} setS={setRow2kS} />
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Distance (miles)</Text>
            <TextInput style={styles.input} value={runMiles} onChangeText={setRunMiles} keyboardType="decimal-pad" placeholder="6.2" placeholderTextColor={Colors.textMuted} />
          </View>
          <TimeRow label="Time" m={runMin} s={runSec} setM={setRunMin} setS={setRunSec} />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => router.push(HEALTH)} accessibilityRole="button">
        <Text style={styles.skip}>Skip — estimate for me</Text>
      </Pressable>
    </OnboardingShell>
  );
}

function TimeRow({ label, m, s, setM, setS }: { label: string; m: string; s: string; setM: (v: string) => void; setS: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} value={m} onChangeText={setM} keyboardType="number-pad" placeholder="min" placeholderTextColor={Colors.textMuted} />
        <Text style={styles.colon}>:</Text>
        <TextInput style={[styles.input, styles.timeInput]} value={s} onChangeText={setS} keyboardType="number-pad" placeholder="sec" placeholderTextColor={Colors.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.textPrimary, fontSize: 16 },
  timeInput: { flex: 1, textAlign: 'center' },
  colon: { color: Colors.textMuted, fontSize: 18, fontWeight: '700' },
  error: { fontSize: 12, color: Colors.danger, marginTop: 4 },
  skip: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
});
```

> If `Colors.textPrimary` / `Colors.danger` aren't in the palette, use the nearest existing tokens (check `@/constants/colors`) — match the app's existing form styling; exact shades are not load-bearing.

- [ ] **Step 2: Route to Baseline only for endurance goals**

In `OSPREY-app/app/(onboarding)/goals.tsx`, add the import:
```typescript
import { anchorKeyForGoal } from '@/services/coaching/baseline';
```

Change `totalSteps` `3`/`4` → keep `step={3}`, set `totalSteps={5}`, and route conditionally (a non-endurance goal has no baseline, so skip straight to health):
```typescript
      step={3}
      totalSteps={5}
      title="What's your main goal right now?"
      hint="This shapes your entire plan. You can always change it later."
      continueDisabled={weeklyRunDays + weeklyLiftDays === 0}
      onContinue={() =>
        router.push(anchorKeyForGoal(primaryGoal) ? '/(onboarding)/baseline' : '/(onboarding)/health')
      }
```

- [ ] **Step 3: Renumber the trailing + leading screens**

In `OSPREY-app/app/(onboarding)/health.tsx`, change `step={4}` → `step={5}` and `totalSteps={4}` → `totalSteps={5}`.

In `welcome.tsx`, `name.tsx`, and `mode.tsx`, change `totalSteps={4}` → `totalSteps={5}` (leave each `step` as-is).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS — `baseline.tsx` type-checks and the flow wiring is consistent (Task 4 already satisfied the required `thresholdAnchor`).

- [ ] **Step 5: Full suite**

Run: `npm test`
Expected: PASS — 120 existing + the new baseline/envelope/build-envelope tests, all green.

- [ ] **Step 6: Commit**

```bash
git add "OSPREY-app/app/(onboarding)/baseline.tsx" "OSPREY-app/app/(onboarding)/goals.tsx" "OSPREY-app/app/(onboarding)/health.tsx" "OSPREY-app/app/(onboarding)/welcome.tsx" "OSPREY-app/app/(onboarding)/name.tsx" "OSPREY-app/app/(onboarding)/mode.tsx"
git commit -m "feat(onboarding): skippable Baseline anchor step + flow renumber (2b-ii)"
```

---

## Post-implementation
App-only — nothing to deploy or migrate. Ships with the app build. On-device check: onboard as a swimmer, enter 400/200 times, confirm the first generated plan's swim paces reflect the entered CSS (not the tier estimate); repeat skipping the step and confirm it still completes.

## Self-Review

**Spec coverage** (against `2026-07-14-coaching-engine-phase2b-ii-design.md`):
- §3 self-report priority in `computeEnvelope` → Task 2. ✅
- §4 `build-envelope` reads `threshold_anchor`, flattens, threads; missing → all-null → Task 1 (`toSelfReportAnchor`) + Task 3. ✅
- §5 storage shape `{run,swim,row}` + `source` → Task 1 types + Task 5 screen writes them. ✅
- §6 Baseline screen (swim 400+200 → `computeCSSPer100`; rowing 2k → /4; run → `deriveThresholdSecPerMile`), skippable, non-endurance self-skips, validation incl. 400>200 → Tasks 1 + 5. ✅
- §7 step renumber + routing `goals → baseline → health` → Task 5. ✅
- §8 TDD (baseline parse, envelope priority + regression, build-envelope threading) → Tasks 1–3. ✅
- §2/§9 app-only (no migration/edge-fn) → no such task exists, by design. ✅

**Placeholder scan:** none — every code step is complete. The two `>` notes (parseRunBaseline bound reconciliation; Colors token fallback) are explicit reconciliation instructions, not TODOs.

**Type consistency:** `SelfReportAnchor`/`ThresholdAnchorMap`/`ParseResult`/`anchorKeyForGoal`/`toSelfReportAnchor` are defined in Task 1 and consumed with the same signatures in Tasks 2–5. `EnvelopeInput.selfReportAnchor` (Task 2) matches `EnvelopeInputs.selfReportAnchor` threading (Task 3). `OnboardingDraft.thresholdAnchor` required (Task 4) is what forces the `health.tsx` literal (Task 5 Step 4). Storage key `row` (not `rowing`) is used consistently in `ThresholdAnchorMap`, `anchorKeyForGoal`, `toSelfReportAnchor`, and the screen's `anchor` object.

**Cross-task independence:** Every task ends green — Task 4 wires `health.tsx`'s draft object itself (satisfying the required `thresholdAnchor`), so no task leaves `typecheck` red for the next. `health.tsx` is edited by Task 4 (draft object, `:26`) and Task 5 (`step`/`totalSteps`, `:73`) on disjoint lines.
