# Coaching-Engine Phase 3 — Hyrox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `hyrox` a real hybrid coaching engine by wiring the already-built (orphaned) hyrox calculators into the envelope, fuel, and prompt.

**Architecture:** A new `hyrox: HyroxPrescription | null` envelope field (parallel to `strength`, hyrox-gated) carries the compromised run-pace split + division station weights + race electrolytes; a `computeFuel` hyrox branch supplies hyrox nutrition; the edge fn mirrors the field and renders a hyrox prompt block. Running reuses the existing run zones — no ZoneSet variant, no `validate.ts` change.

**Tech Stack:** TypeScript. App = React Native / Expo, Jest. Edge = Supabase Edge Function (Deno).

## Global Constraints

*(Copied verbatim from the spec — every task's requirements implicitly include these.)*

- **Non-hyrox plans MUST stay byte-identical.** All hyrox logic is gated on `sport === 'hyrox'`. Every existing envelope / fuel / validate / zone test stays green, unchanged.
- **NO database migration.** `hyrox` already exists in `primary_goal_enum` (pending `20260714000003`); `goal_params` exists. Rides the already-pending atomic redeploy.
- **App + edge deploy atomically** — the `envelope.hyrox` contract and the edge prompt block must agree.
- **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test` (Jest, `TZ` mandatory). **Edge tests:** `deno test supabase/functions/ozzie-generate-plan/` (Deno).
- **Mirror, don't share.** The edge fn hand-mirrors the app's `HyroxPrescription` shape, pinned per side.
- **Reuse run zones — NO ZoneSet variant, NO `validate.ts` change** (byte-identical). No station guardrail (division weights are training references).
- **TDD.** Failing test → minimal wiring → green.

Branch: `spec/coaching-phase3-hyrox` (spec committed as `36e2081`).

---

## File Structure

**App (`OSPREY-app/`):**
- `src/services/coaching/hyrox-params.ts` — **new.** `HyroxGoalParams`, `toHyroxParams`, `parseHyroxParams`, re-export `HyroxDivision`.
- `src/services/coaching/strength-params.ts` — extend `GoalParams` union.
- `src/services/coaching/hyrox.ts` — **new.** `HyroxPrescription`, `buildHyroxPrescription`.
- `src/services/coaching/envelope.ts` — `EnvelopeInput.hyroxParams?`, `CoachingEnvelope.hyrox`, wire into `computeEnvelope`.
- `src/services/coaching/fuel.ts` — `hyrox` branch.
- `src/services/coaching/build-envelope.ts` — extend `resolveGoalInputs`; `EnvelopeInputs.hyroxParams?`; passthrough.
- `app/(onboarding)/baseline.tsx` + `app/preferences.tsx` — division picker + persist-before-generate.

**Edge (`supabase/functions/ozzie-generate-plan/`):**
- `guidance.ts` — `HyroxInfo` + `hyroxGuidance`.
- `index.ts` — `Envelope.hyrox` mirror + call `hyroxGuidance`.

Task order: 1 → 2 → 3 → 4 → 5 → 6. T2 depends on T1; T4 depends on T1+T2; T5 mirrors T2's shape; T6 depends on T1.

---

### Task 1: `hyrox-params.ts` + `GoalParams` union

**Files:**
- Create: `OSPREY-app/src/services/coaching/hyrox-params.ts`
- Modify: `OSPREY-app/src/services/coaching/strength-params.ts:14` (extend `GoalParams`)
- Test: `OSPREY-app/src/services/coaching/__tests__/hyrox-params.test.ts`

**Interfaces:**
- Consumes: `ParseResult` from `./baseline`; `HyroxDivision` from `@/services/calculators/hyrox`.
- Produces: `interface HyroxGoalParams { division: HyroxDivision; targetTimeMinutes: number | null }`; `toHyroxParams(raw: unknown): HyroxGoalParams | null`; `parseHyroxParams(input: { division: string; targetTimeMinutes: string }): ParseResult<HyroxGoalParams>`; re-export `HyroxDivision`. `GoalParams` gains `| HyroxGoalParams`.

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/services/coaching/__tests__/hyrox-params.test.ts`:

```ts
import { toHyroxParams, parseHyroxParams } from '@/services/coaching/hyrox-params';

describe('toHyroxParams', () => {
  it('reads a stored division blob', () => {
    expect(toHyroxParams({ division: 'open_men', targetTimeMinutes: 85 })).toEqual({ division: 'open_men', targetTimeMinutes: 85 });
  });
  it('returns null when there is no valid division (paramless hyrox → graceful fallback)', () => {
    expect(toHyroxParams(null)).toBeNull();
    expect(toHyroxParams({})).toBeNull();
    expect(toHyroxParams({ division: 'nonsense' })).toBeNull();
  });
  it('drops an implausible target time to null', () => {
    expect(toHyroxParams({ division: 'pro_women', targetTimeMinutes: -5 })).toEqual({ division: 'pro_women', targetTimeMinutes: null });
  });
});

describe('parseHyroxParams', () => {
  it('accepts a valid division with a blank target time', () => {
    expect(parseHyroxParams({ division: 'open_women', targetTimeMinutes: '' })).toEqual({ ok: true, value: { division: 'open_women', targetTimeMinutes: null } });
  });
  it('rejects a missing/invalid division', () => {
    expect(parseHyroxParams({ division: '', targetTimeMinutes: '' }).ok).toBe(false);
  });
  it('rejects a non-numeric target time', () => {
    expect(parseHyroxParams({ division: 'open_men', targetTimeMinutes: 'soon' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/hyrox-params.test.ts`
Expected: FAIL — cannot find module `@/services/coaching/hyrox-params`.

- [ ] **Step 3: Write minimal implementation**

Create `OSPREY-app/src/services/coaching/hyrox-params.ts`:

```ts
import { ParseResult } from './baseline';
import type { HyroxDivision } from '@/services/calculators/hyrox';

export type { HyroxDivision };

export interface HyroxGoalParams {
  division: HyroxDivision;
  targetTimeMinutes: number | null; // optional race-time goal; null = unset
}

const DIVISIONS: HyroxDivision[] = ['open_men', 'open_women', 'pro_men', 'pro_women'];
const isDivision = (v: unknown): v is HyroxDivision => DIVISIONS.includes(v as HyroxDivision);
const posMin = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 300 ? Math.round(v) : null);

// Stored JSONB (or null) → safe params, or null when no valid division (a paramless hyrox
// athlete degrades to a generic run+strength plan, like the paramless-lift follow-up).
export function toHyroxParams(raw: unknown): HyroxGoalParams | null {
  const p = (raw ?? {}) as Partial<HyroxGoalParams>;
  if (!isDivision(p.division)) return null;
  return { division: p.division, targetTimeMinutes: posMin(p.targetTimeMinutes) };
}

// Validate the collection-form inputs (division required; target time optional).
export function parseHyroxParams(input: { division: string; targetTimeMinutes: string }): ParseResult<HyroxGoalParams> {
  if (!isDivision(input.division)) return { ok: false, error: 'Pick your division.' };
  const t = input.targetTimeMinutes.trim();
  let targetTimeMinutes: number | null = null;
  if (t !== '') {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > 300) return { ok: false, error: 'Target time must be minutes (or leave it blank).' };
    targetTimeMinutes = Math.round(n);
  }
  return { ok: true, value: { division: input.division, targetTimeMinutes } };
}
```

In `OSPREY-app/src/services/coaching/strength-params.ts`, extend the `GoalParams` union (line 14) and add the import:

```ts
import type { UltraGoalParams } from './ultra-params';
import type { HyroxGoalParams } from './hyrox-params';
// ...
export type GoalParams = UltraGoalParams | StrengthGoalParams | HyroxGoalParams;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/hyrox-params.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/hyrox-params.ts OSPREY-app/src/services/coaching/strength-params.ts OSPREY-app/src/services/coaching/__tests__/hyrox-params.test.ts
git commit -m "feat(coaching): hyrox-params (division + target time) + GoalParams union (phase3-hyrox)"
```

---

### Task 2: `hyrox.ts` (`HyroxPrescription`) + envelope wiring

**Files:**
- Create: `OSPREY-app/src/services/coaching/hyrox.ts`
- Modify: `OSPREY-app/src/services/coaching/envelope.ts` (import; `EnvelopeInput.hyroxParams?`; `CoachingEnvelope.hyrox`; `computeEnvelope`)
- Test: `OSPREY-app/src/services/coaching/__tests__/hyrox.test.ts` + additions to `__tests__/envelope.test.ts`

**Interfaces:**
- Consumes: `predictCompromisedRunSplit`, `hyroxStationWeights`, `hyroxSodiumMgPerHour`, `hyroxCaffeineMg`, `HyroxStationWeights`, `HyroxDivision` from `@/services/calculators/hyrox`; `Range` from `@/services/calculators/types`; `EnvelopeInput` (gains `hyroxParams?`), which carries the run anchor as `selfReportAnchor.thresholdSecPerMile` + `bestRunMiles`/`bestRunTimeS`/`fitnessLevel`.
- Produces: `interface HyroxPrescription { division: HyroxDivision; compromisedRunSplitSecPerKm: Range; stationWeights: HyroxStationWeights; sodiumMgPerHour: Range; caffeineMg: Range }`; `buildHyroxPrescription(input: EnvelopeInput): HyroxPrescription | null`. Consumed by `computeEnvelope` (→ `CoachingEnvelope.hyrox`) and mirrored by the edge (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `OSPREY-app/src/services/coaching/__tests__/hyrox.test.ts`:

```ts
import { buildHyroxPrescription } from '@/services/coaching/hyrox';
import { hyroxStationWeights, predictCompromisedRunSplit } from '@/services/calculators/hyrox';

const base = () => ({
  sport: 'hyrox', phase: 'Base', weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'intermediate', bodyWeightKg: 70,
  rowingSplitSecPer500: null,
  selfReportAnchor: { thresholdSecPerMile: 483, cssSecPer100: null, splitSecPer500: null, ftpWatts: null }, // ~300 s/km
  hyroxParams: { division: 'open_men', targetTimeMinutes: null },
} as any);

describe('buildHyroxPrescription', () => {
  it('builds a prescription from the division + run threshold', () => {
    const h = buildHyroxPrescription(base())!;
    expect(h.division).toBe('open_men');
    expect(h.stationWeights).toEqual(hyroxStationWeights('open_men'));   // sled push 152kg, etc.
    // 483 s/mile → 300 s/km → compromised split = threshold + 15..30
    expect(h.compromisedRunSplitSecPerKm).toEqual(predictCompromisedRunSplit(300));
    expect(h.sodiumMgPerHour).toEqual({ min: 500, max: 1000 });
    expect(h.caffeineMg).toEqual({ min: Math.round(3 * 70), max: Math.round(6 * 70) });
  });
  it('is null for a non-hyrox sport', () => {
    expect(buildHyroxPrescription({ ...base(), sport: 'run' })).toBeNull();
  });
  it('is null when hyroxParams is absent (paramless hyrox → generic plan)', () => {
    expect(buildHyroxPrescription({ ...base(), hyroxParams: null })).toBeNull();
    expect(buildHyroxPrescription({ ...base(), hyroxParams: undefined })).toBeNull();
  });
});
```

Add to `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` (extend the top import to also import nothing new; append this describe block):

```ts
describe('computeEnvelope hyrox prescription', () => {
  const hyroxInput = () => ({
    ...baseInput, sport: 'hyrox',
    selfReportAnchor: { thresholdSecPerMile: 483, cssSecPer100: null, splitSecPer500: null, ftpWatts: null },
    hyroxParams: { division: 'open_men', targetTimeMinutes: null },
  }) as any;

  it('populates a non-null hyrox prescription for a hyrox sport, wired from buildHyroxPrescription', () => {
    const env = computeEnvelope(hyroxInput());
    expect(env.hyrox).not.toBeNull();
    expect(env.hyrox?.division).toBe('open_men');
    expect(env.zones?.kind).toBe('run'); // hyrox reuses run zones
  });

  it('is null for a non-hyrox sport and leaves every other envelope field byte-identical (regression)', () => {
    const withHyrox = computeEnvelope({ ...baseInput, hyroxParams: { division: 'open_men', targetTimeMinutes: null } } as any);
    const withoutHyrox = computeEnvelope({ ...baseInput });
    expect(withHyrox.hyrox).toBeNull();
    expect(withoutHyrox.hyrox).toBeNull();
    expect(withHyrox).toEqual(withoutHyrox); // hyroxParams fully inert for sport: 'run'
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/hyrox.test.ts src/services/coaching/__tests__/envelope.test.ts`
Expected: FAIL — `buildHyroxPrescription` / `env.hyrox` do not exist.

- [ ] **Step 3: Write minimal implementation**

Create `OSPREY-app/src/services/coaching/hyrox.ts`:

```ts
import {
  predictCompromisedRunSplit, hyroxStationWeights, hyroxSodiumMgPerHour, hyroxCaffeineMg,
  type HyroxStationWeights, type HyroxDivision,
} from '@/services/calculators/hyrox';
import { Range } from '@/services/calculators/types';
import { resolveRunningAnchor } from './anchor';
import type { EnvelopeInput } from './envelope';

const MILES_PER_KM = 0.621371;

export interface HyroxPrescription {
  division: HyroxDivision;
  compromisedRunSplitSecPerKm: Range; // race-pace target under station fatigue (threshold + 15-30 s/km)
  stationWeights: HyroxStationWeights; // division-fixed race weights (training references)
  sodiumMgPerHour: Range;
  caffeineMg: Range;
}

export function buildHyroxPrescription(input: EnvelopeInput): HyroxPrescription | null {
  if (input.sport !== 'hyrox') return null;
  const division = input.hyroxParams?.division;
  if (!division) return null;
  // Run threshold: self-report first, else derive from data/tier — same resolution the run
  // zones use. Convert sec/mile → sec/km for the compromised-split predictor.
  const thresholdSecPerMile =
    input.selfReportAnchor?.thresholdSecPerMile ??
    resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).thresholdSecPerMile;
  const thresholdSecPerKm = Math.round(thresholdSecPerMile * MILES_PER_KM);
  return {
    division,
    compromisedRunSplitSecPerKm: predictCompromisedRunSplit(thresholdSecPerKm),
    stationWeights: hyroxStationWeights(division),
    sodiumMgPerHour: hyroxSodiumMgPerHour(),
    caffeineMg: hyroxCaffeineMg(input.bodyWeightKg),
  };
}
```

In `OSPREY-app/src/services/coaching/envelope.ts`:

(a) Add the import near line 13 (`import { buildStrengthPrescription, StrengthPrescription } from './strength';`):

```ts
import { buildHyroxPrescription, HyroxPrescription } from './hyrox';
```

(b) `CoachingEnvelope` (after `strength: StrengthPrescription | null;`) gains:

```ts
  hyrox: HyroxPrescription | null;
```

(c) `EnvelopeInput` (after `strengthParams?: …`) gains:

```ts
  hyroxParams?: import('./hyrox-params').HyroxGoalParams | null;
```

(d) In `computeEnvelope`, after `const strength = buildStrengthPrescription(input);` add:

```ts
  const hyrox = buildHyroxPrescription(input);
```

and add `hyrox,` to the returned object (after `strength,`).

*(Note: `caffeineMg`/`sodiumMgPerHour` from calculators/hyrox return `Range` with number `min`/`max`; `predictCompromisedRunSplit` returns `{ min, max }` numbers — all match `Range`.)*

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/hyrox.test.ts src/services/coaching/__tests__/envelope.test.ts`
Expected: PASS — including the byte-identical regression for `sport: 'run'`.

- [ ] **Step 5: Full app suite (regression gate)**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npm test`
Expected: PASS — non-hyrox envelopes carry `hyrox: null` and are otherwise unchanged.

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/services/coaching/hyrox.ts OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/hyrox.test.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "feat(coaching): HyroxPrescription envelope field (compromised split + station weights + electrolytes) (phase3-hyrox)"
```

---

### Task 3: `computeFuel` hyrox branch

**Files:**
- Modify: `OSPREY-app/src/services/coaching/fuel.ts` (add a `sport === 'hyrox'` branch at the top of `computeFuel`)
- Test: `OSPREY-app/src/services/coaching/__tests__/fuel.test.ts`

**Interfaces:**
- Consumes: `hyroxDailyNutrition`, `hyroxInRaceCarbGPerHour` from `@/services/calculators/hyrox`; existing `midpoint`, `Range`, `FuelPlan`.
- Produces: no signature change — `computeFuel('hyrox', bw)` now returns hyrox nutrition.

- [ ] **Step 1: Write the failing test**

Add to `OSPREY-app/src/services/coaching/__tests__/fuel.test.ts` (inside the `describe('computeFuel', …)` block):

```ts
  it('gives hyrox its nutrition (5-8 g/kg carbs) + a race in-session rate', () => {
    const f = computeFuel('hyrox', 70);
    expect(f.dailyCarbGByDayType.easy.min).toBe(Math.round(5 * 70)); // low end of 5-8 g/kg
    expect(f.dailyCarbGByDayType.peak.max).toBe(Math.round(8 * 70)); // high end
    expect(f.proteinG.min).toBe(Math.round(70 * 1.6));
    expect(f.longSessionCarbGPerHour).toBe(45); // midpoint hyroxInRaceCarbGPerHour(90) = {30,60}
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/fuel.test.ts`
Expected: FAIL — hyrox currently flows through the endurance default (`dailyCarbGrams` + marathon in-session ~60), so `easy.min`/`peak.max`/`longSessionCarbGPerHour` differ.

- [ ] **Step 3: Write minimal implementation**

In `OSPREY-app/src/services/coaching/fuel.ts`:

(a) Add the import (near line 5):

```ts
import { hyroxDailyNutrition, hyroxInRaceCarbGPerHour } from '@/services/calculators/hyrox';
```

(b) At the top of `computeFuel`, immediately after the `if (sport === 'lift') { … }` block, add:

```ts
  if (sport === 'hyrox') {
    const n = hyroxDailyNutrition(bodyWeightKg);              // carbG 5-8 g/kg, proteinG 1.6-2.2
    const mid = Math.round((n.carbG.min + n.carbG.max) / 2);
    const low: Range = { min: Math.round(n.carbG.min), max: mid };
    const high: Range = { min: mid, max: Math.round(n.carbG.max) };
    return {
      dailyCarbGByDayType: { easy: low, moderate: low, high, peak: high },
      proteinG: { min: Math.round(n.proteinG.min), max: Math.round(n.proteinG.max) },
      longSessionCarbGPerHour: Math.round(midpoint(hyroxInRaceCarbGPerHour(90)) ?? 45), // race >75 min → 30-60 g/hr
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/fuel.test.ts`
Expected: PASS — including the existing `run`/`swim`/`ultra`/`lift` cases (unchanged).

- [ ] **Step 5: Full app suite (regression gate)**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npm test`
Expected: PASS — only `hyrox` fuel changed.

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/services/coaching/fuel.ts OSPREY-app/src/services/coaching/__tests__/fuel.test.ts
git commit -m "feat(coaching): hyrox fuel branch (5-8 g/kg carbs + race in-session rate) (phase3-hyrox)"
```

---

### Task 4: `build-envelope.ts` — thread `hyroxParams`

**Files:**
- Modify: `OSPREY-app/src/services/coaching/build-envelope.ts` (extend `resolveGoalInputs`; `EnvelopeInputs.hyroxParams?`; `envelopeFromInputs` passthrough; import)
- Test: `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts`

**Interfaces:**
- Consumes: `toHyroxParams`/`HyroxGoalParams` from `./hyrox-params`; existing `resolveGoalInputs` (extended).
- Produces: `resolveGoalInputs` return type gains `hyroxParams: HyroxGoalParams | null`; `EnvelopeInputs.hyroxParams?`.

- [ ] **Step 1: Write the failing test**

Add to `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts` (inside the `describe('resolveGoalInputs …')` block from the follow-ups slice):

```ts
  it('switches to hyrox and populates hyroxParams from goal_params', () => {
    const r = resolveGoalInputs('hyrox', 'run', { division: 'open_men', targetTimeMinutes: 85 });
    expect(r.sport).toBe('hyrox');
    expect(r.hyroxParams).toEqual({ division: 'open_men', targetTimeMinutes: 85 });
    expect(r.ultraParams).toBeNull();
    expect(r.strengthParams).toBeNull();
  });
  it('leaves hyroxParams null for a non-hyrox goal', () => {
    expect(resolveGoalInputs('run_performance', 'run', null).hyroxParams).toBeNull();
    expect(resolveGoalInputs(undefined, 'lift', { division: 'open_men' }).hyroxParams).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/build-envelope.test.ts`
Expected: FAIL — `r.hyroxParams` is `undefined` (not on the return type).

- [ ] **Step 3: Write minimal implementation**

In `OSPREY-app/src/services/coaching/build-envelope.ts`:

(a) Extend the import on line 7 area and add:

```ts
import { toHyroxParams, type HyroxGoalParams } from './hyrox-params';
```

(b) Extend `resolveGoalInputs` (its return type and body):

```ts
export function resolveGoalInputs(
  postedGoal: TrainingGoal | undefined,
  dbGoal: string | null | undefined,
  goalParams: unknown,
): { sport: string; ultraParams: UltraGoalParams | null; strengthParams: StrengthGoalParams | null; hyroxParams: HyroxGoalParams | null } {
  const effectiveGoal = postedGoal ? primaryGoalFromTrainingGoal(postedGoal) : (dbGoal ?? 'run');
  return {
    sport: effectiveGoal,
    ultraParams: effectiveGoal === 'ultra' ? toUltraParams(goalParams) : null,
    strengthParams: effectiveGoal === 'lift' ? toStrengthParams(goalParams) : null,
    hyroxParams: effectiveGoal === 'hyrox' ? toHyroxParams(goalParams) : null,
  };
}
```

(c) `EnvelopeInputs` gains (after `strengthParams?`):

```ts
  hyroxParams?: HyroxGoalParams | null;
```

(d) In `envelopeFromInputs`, add `hyroxParams: i.hyroxParams,` to the `computeEnvelope({ … })` call (after `strengthParams: i.strengthParams,`).

*(The `inputs = { ...resolveGoalInputs(...) }` spread in `invokeGeneratePlan` now carries `hyroxParams` automatically. The no-userId default literal leaves it `undefined` — fine, since `EnvelopeInputs.hyroxParams?` is optional and `buildHyroxPrescription` treats `undefined` as null.)*

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/build-envelope.test.ts`
Expected: PASS — the new hyrox cases plus the existing `resolveGoalInputs`/`envelopeFromInputs` tests.

- [ ] **Step 5: Full app suite (regression gate)**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/services/coaching/build-envelope.ts OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts
git commit -m "feat(coaching): thread hyroxParams through resolveGoalInputs + envelope build (phase3-hyrox)"
```

---

### Task 5: Edge — `hyroxGuidance` + `Envelope.hyrox` mirror + prompt block

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/guidance.ts` (add `HyroxInfo` + `hyroxGuidance`)
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` (`Envelope.hyrox` mirror; import + call `hyroxGuidance`)
- Test: `supabase/functions/ozzie-generate-plan/guidance.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export interface HyroxInfo { … }` + `export function hyroxGuidance(h: HyroxInfo | null | undefined): string`. `index.ts`'s `Envelope.hyrox` inline type is structurally identical to `HyroxInfo`.

- [ ] **Step 1: Write the failing tests**

In `supabase/functions/ozzie-generate-plan/guidance.test.ts`, extend the import on line 2 to add `hyroxGuidance`/`HyroxInfo`, then append:

```ts
const fullHyrox: HyroxInfo = {
  division: 'open_men',
  compromisedRunSplitSecPerKm: { min: 315, max: 330 },
  stationWeights: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
  sodiumMgPerHour: { min: 500, max: 1000 },
  caffeineMg: { min: 210, max: 420 },
};

Deno.test('hyroxGuidance returns empty for null/undefined', () => {
  assertEquals(hyroxGuidance(null), '');
  assertEquals(hyroxGuidance(undefined), '');
});

Deno.test('hyroxGuidance states the compromised split, station weights, and race electrolytes', () => {
  const g = hyroxGuidance(fullHyrox);
  assertEquals(g.includes('315-330 s/km'), true);
  assertEquals(g.includes('sled push 152kg'), true);
  assertEquals(g.includes('wall ball 6kg'), true);
  assertEquals(g.includes('500-1000 mg/hr'), true);
  assertEquals(g.includes('descriptions'), true); // station work goes in session notes, not the whitelist
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/ozzie-generate-plan/guidance.test.ts`
Expected: FAIL — `hyroxGuidance` / `HyroxInfo` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/functions/ozzie-generate-plan/guidance.ts`:

```ts
// Hand-narrowed mirror of HyroxPrescription (OSPREY-app/src/services/coaching/hyrox.ts),
// matching index.ts's Envelope.hyrox. Keep in sync if that shape changes.
export interface HyroxInfo {
  division: string;
  compromisedRunSplitSecPerKm: { min: number; max: number };
  stationWeights: { sledPushKg: number; sledPullKg: number; farmersCarryPerHandKg: number; sandbagLungesKg: number; wallBallKg: number };
  sodiumMgPerHour: { min: number; max: number };
  caffeineMg: { min: number; max: number };
}

// Hyrox coaching, present only when the envelope carries a hyrox block (sport === 'hyrox').
export function hyroxGuidance(h: HyroxInfo | null | undefined): string {
  if (!h) return '';
  const w = h.stationWeights;
  return (
    ` HYROX (${h.division.replace('_', ' ')}): race 8×1km runs + 8 stations as ONE effort — control the opening` +
    ` SkiErg→Sled block. Target compromised run splits ${h.compromisedRunSplitSecPerKm.min}-${h.compromisedRunSplitSecPerKm.max} s/km` +
    ` (stations pre-fatigue you — do NOT run fresh-5k pace). Signature session: compromised-running intervals` +
    ` (1km race-pace → a station → 1km race-pace). Station strength-endurance at race weights — sled push ${w.sledPushKg}kg,` +
    ` sled pull ${w.sledPullKg}kg, farmers ${w.farmersCarryPerHandKg}kg/hand, sandbag lunge ${w.sandbagLungesKg}kg,` +
    ` wall ball ${w.wallBallKg}kg (100 reps, pre-plan the break); ski/row 1000m at target split. Race day:` +
    ` ${h.sodiumMgPerHour.min}-${h.sodiumMgPerHour.max} mg/hr sodium, caffeine ${h.caffeineMg.min}-${h.caffeineMg.max} mg pre-race` +
    ` (familiar dose). Program station work in the session descriptions/ozzie_notes (not lift_prescription).`
  );
}
```

In `supabase/functions/ozzie-generate-plan/index.ts`:

(a) Add `hyroxGuidance` to the existing `./guidance.ts` import.

(b) In the `Envelope` interface (after the `strength?: { … } | null;` block), add:

```ts
  hyrox?: {
    division: string;
    compromisedRunSplitSecPerKm: { min: number; max: number };
    stationWeights: { sledPushKg: number; sledPullKg: number; farmersCarryPerHandKg: number; sandbagLungesKg: number; wallBallKg: number };
    sodiumMgPerHour: { min: number; max: number };
    caffeineMg: { min: number; max: number };
  } | null;
```

(c) In the `envelopeGuidance` concatenation, add `+ hyroxGuidance(envelope.hyrox)` immediately after `strengthGuidance(envelope.strength)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/ozzie-generate-plan/guidance.test.ts`
Expected: PASS.

- [ ] **Step 5: Full edge suite + typecheck (regression gate)**

Run: `deno test supabase/functions/ozzie-generate-plan/` — Expected: PASS (all existing tests green; the hyrox block is additive and gated on `envelope.hyrox`).
Run: `deno check supabase/functions/ozzie-generate-plan/index.ts` — Expected: the 26 pre-existing `@supabase/supabase-js` baseline errors, 0 new.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/guidance.ts supabase/functions/ozzie-generate-plan/guidance.test.ts supabase/functions/ozzie-generate-plan/index.ts
git commit -m "feat(edge): hyrox prompt block (compromised running + station strength + roxzone) + Envelope.hyrox mirror (phase3-hyrox)"
```

---

### Task 6: Collection UI — division picker

**Files:**
- Modify: `OSPREY-app/app/(onboarding)/baseline.tsx` (division picker for hyrox + `onContinue` parse/persist)
- Modify: `OSPREY-app/app/preferences.tsx` (division picker + `handleGenerate` persist-before-generate)
- Verify: typecheck + preview (UI wiring; the tested core is `parseHyroxParams`, covered in Task 1). Device smoke test is a pre-ship item.

**Interfaces:**
- Consumes: `parseHyroxParams` from `@/services/coaching/hyrox-params`; the existing `setGoalParams` (onboarding store) / `goalParams` preferences field.

**Context:** Hyrox is run-blueprint (`blueprintSport('hyrox')='run'`), so it **keeps** the run-anchor collection (it needs the run threshold) and **augments** it with a division picker — mirror the **ultra** flow, NOT lift. In `baseline.tsx` the `ultra` branch of `onContinue` (:73-77) parses its params, `setGoalParams`, and then **falls through** to the run-anchor collection (:85-107); the `lift` branch (:78-84) early-returns via `router.push` because it has no anchor. Hyrox must behave like ultra (fall through). Chip styles: `styles.chip`/`chipSelected`/`chipText`/`chipTextSelected` (from the ultra block :122-136).

- [ ] **Step 1: Add hyrox division state + parse/persist (baseline.tsx)**

In `app/(onboarding)/baseline.tsx`:
- Add state: `const [division, setDivision] = useState<HyroxDivision>('open_men');` and import `parseHyroxParams`, `type HyroxDivision` from `@/services/coaching/hyrox-params`.
- In `onContinue`, add a hyrox branch **after** the `lift` branch and **before** the anchor-collection code (:85), mirroring the `ultra` branch — parse, set, and DO NOT return on success (so it falls through and `parseRunBaseline` collects the run threshold via the `else` branch):

```ts
    if (primaryGoal === 'hyrox') {
      const h = parseHyroxParams({ division, targetTimeMinutes: '' });
      if (!h.ok) return setError(h.error);
      setGoalParams(h.value);
    }
```

- Add a `title` case for hyrox (near :111) e.g. `primaryGoal === 'hyrox' ? 'Your division, and a recent hard run'`.
- In the render, show a division-chip row for hyrox **above the default run-effort inputs**. The existing ternary is `ultra ? (…) : lift ? (…) : (<default run-effort form>)`. Wrap the default branch so hyrox also gets the chips: render `{primaryGoal === 'hyrox' && <DivisionChips … />}` immediately above the default run-effort inputs (the `else` branch already renders the recent-hard-run inputs that hyrox's threshold needs). Four chips — `open_men`/`open_women`/`pro_men`/`pro_women`, labels "Open M / Open W / Pro M / Pro W" — `onPress={() => setDivision(d)}`, `accessibilityState={{ selected: division === d }}`, using the ultra chip styles.

- [ ] **Step 2: Add hyrox division to the plan-builder (preferences.tsx)**

In `app/preferences.tsx`:
- Add `const isHyrox = primaryGoal === 'hyrox';`, state `const [division, setDivision] = useState<HyroxDivision>('open_men');`, import `parseHyroxParams`, `type HyroxDivision`.
- In the restore effect (near :122), seed from `saved.goalParams`: `if (saved.goalParams?.division) setDivision(saved.goalParams.division);`.
- In `handleGenerate` (mirror the `strengthParams` block at :182-189 and the persist block at :232-241):

```ts
      const hyroxParams = isHyrox ? parseHyroxParams({ division, targetTimeMinutes: '' }) : null;
      if (hyroxParams && !hyroxParams.ok) { Alert.alert('Check your hyrox details', hyroxParams.error); return; }
      const hyroxParamsValue = hyroxParams && hyroxParams.ok ? hyroxParams.value : null;
```

  add `...(hyroxParamsValue ? { goalParams: hyroxParamsValue } : {})` to the `preferences` object, and add the persist-before-generate block:

```ts
      if (hyroxParamsValue && userId) {
        const { error: goalParamsError } = await supabase.from('user_goals').update({ goal_params: hyroxParamsValue }).eq('user_id', userId);
        if (goalParamsError) { Alert.alert('Could not save your hyrox details', goalParamsError.message); return; }
      }
```

- Render the division-chip row when `isHyrox` (mirror the `isUltra` block at :335-348).

- [ ] **Step 3: Typecheck + preview**

Run: `cd OSPREY-app && npx tsc --noEmit` — Expected: 0 errors.
Then start the preview (Browser pane) and confirm the hyrox goal shows the division picker on both onboarding baseline and the plan-builder; confirm Continue/Generate is not blocked. (Headless CI cannot render these screens — a device/simulator smoke test is the pre-ship item, same caveat as ultra/powerlifting.)

- [ ] **Step 4: Commit**

```bash
git add "OSPREY-app/app/(onboarding)/baseline.tsx" OSPREY-app/app/preferences.tsx
git commit -m "feat(app): collect hyrox division on onboarding + plan-builder (phase3-hyrox)"
```

---

## After all tasks

- **Final whole-branch review** (superpowers:requesting-code-review, most capable model) over `git merge-base main HEAD`..HEAD. Focus: non-hyrox byte-identical (envelope/fuel/validate untouched paths), the app↔edge `HyroxPrescription`/`HyroxInfo` mirror agreement, and that `resolveGoalInputs` gates all three param families correctly.
- **finishing-a-development-branch:** run `cd OSPREY-app && TZ=Asia/Kolkata npm test` and `deno test supabase/functions/ozzie-generate-plan/` on the merged result before merging `--no-ff` to `main`.
- **Deploy:** no migration. The edge changes (Task 5) join the coaching engine's already-pending atomic redeploy (`docs/DEPLOY-CHECKLIST.md` §2).

## Spec coverage map

| Spec item | Task |
|---|---|
| `HyroxGoalParams` + `GoalParams` union | 1 |
| `hyrox: HyroxPrescription \| null` field + `buildHyroxPrescription` | 2 |
| Reuse run zones (no ZoneSet variant) | 2 (test asserts `zones.kind==='run'`) |
| Fuel hyrox branch (5-8 g/kg + in-race rate) | 3 |
| `resolveGoalInputs` gates hyroxParams (goal-switch correct first gen) | 4 |
| Paramless hyrox → null → generic plan | 1 (`toHyroxParams` null) + 2 (`buildHyroxPrescription` null) |
| Edge hyrox prompt block + mirror; station work in notes not whitelist | 5 |
| Division collection UI + persist-before-generate | 6 |
| `validate.ts` byte-identical (no change) | (whole plan — no validate.ts task) |
| Non-hyrox byte-identical | 2 + 3 regression tests + full suites each task |
| No migration | (whole plan — none added) |
