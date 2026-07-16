# Coaching-Engine Phase 3 — CrossFit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `crossfit` a real periodized goal with its 3 concurrent modalities (strength + engine + gymnastics/metcon) plus benchmark testing.

**Architecture:** Full goal plumbing + the first new enum migration; a composing `crossfit: CrossfitPrescription | null` envelope field (strength %1RM via the reused `intensityZoneForPercent1RM`, engine via the always-present `hrZones` + the wired `ENERGY_SYSTEM_ZONES`, gymnastics/metcon prompt-driven) + a benchmark library; an edge `crossfitGuidance` block. All crossfit logic sport-gated → non-crossfit byte-identical.

**Tech Stack:** TypeScript. App = React Native / Expo, Jest. Edge = Supabase Edge Function (Deno). Postgres migration.

## Global Constraints

- **Non-crossfit plans MUST stay byte-identical.** All crossfit logic gated on `sport === 'crossfit'`.
- **ONE new migration** — `ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'crossfit';` (additive/idempotent). Joins the pending atomic redeploy (apply before/with the fn redeploy).
- **App + edge deploy atomically.** **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test`. **Edge tests:** `deno test supabase/functions/ozzie-generate-plan/`.
- **Mirror, don't share** (edge hand-mirrors `CrossfitPrescription`, pinned per side). **TDD.**
- Gymnastics/metcon movements go in session descriptions/`ozzie_notes`, NOT the `lift_prescription` exercise whitelist (the powerlifting-slice lesson — `lift.tsx` silently drops off-library names).

Branch: `spec/coaching-phase3-crossfit` (spec `3498f26`). File links use the `Osprey/` prefix.

Task order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. T4 depends on T2+T3; T6/T9 on T2; T8 mirrors T4's shape.

---

### Task 1: Migration + goal plumbing

**Files:**
- Create: `supabase/migrations/20260716000001_crossfit_primary_goal.sql`
- Modify: `OSPREY-app/src/types/preferences.ts` (`TrainingGoal`), `OSPREY-app/src/types/onboarding.ts` (`PrimaryGoal`), `OSPREY-app/src/services/onboarding.ts` (`ONBOARDING_GOAL_TO_PREFERENCES`), `OSPREY-app/src/services/coaching/goal-map.ts` (`PrimaryGoalEnum` + `TRAINING_GOAL_TO_PRIMARY_GOAL`), `supabase/functions/ozzie-generate-plan/index.ts` (`PRIMARY_GOAL_MAP`)
- Test: `OSPREY-app/src/services/coaching/__tests__/goal-map.test.ts` (inverse pin now covers crossfit)

**Interfaces:**
- Produces: `'crossfit'` is a valid `TrainingGoal`, `PrimaryGoal`, and `PrimaryGoalEnum`; `TRAINING_GOAL_TO_PRIMARY_GOAL.crossfit === 'crossfit'`; the edge maps it too. `blueprintSport('crossfit')` stays `null` (no change) → crossfit gets `hrZones`.

- [ ] **Step 1: Update the goal-map inverse-pin test (fails first)**

The existing goal-map test iterates `ONBOARDING_GOAL_TO_PREFERENCES` and asserts the round-trip + `toHaveLength(11)`. After adding crossfit it's 12. Change the exhaustiveness assertion in `goal-map.test.ts` from `toHaveLength(11)` to `toHaveLength(12)` and add `expect(TRAINING_GOAL_TO_PRIMARY_GOAL.crossfit).toBe('crossfit');`.

- [ ] **Step 2: Run — verify it fails**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/goal-map.test.ts`
Expected: FAIL — `crossfit` missing from the maps (and length is 11).

- [ ] **Step 3: Add crossfit to every plumbing point**

- `supabase/migrations/20260716000001_crossfit_primary_goal.sql`:
```sql
-- Phase 3 (crossfit): add the crossfit primary goal. Additive + idempotent.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'crossfit';
```
- `preferences.ts` `TrainingGoal` union: add `| 'crossfit'`.
- `onboarding.ts` `PrimaryGoal` union: add `| 'crossfit'`.
- `onboarding.ts` `ONBOARDING_GOAL_TO_PREFERENCES`: add `crossfit: 'crossfit',`.
- `goal-map.ts` `PrimaryGoalEnum`: add `| 'crossfit'`; `TRAINING_GOAL_TO_PRIMARY_GOAL`: add `crossfit: 'crossfit',`.
- `index.ts` `PRIMARY_GOAL_MAP` (~line 495): add `crossfit: 'crossfit',`.

- [ ] **Step 4: Run — verify it passes**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/goal-map.test.ts` — Expected: PASS (round-trips 11 PrimaryGoals incl. crossfit; length 12).
Then `cd OSPREY-app && TZ=Asia/Kolkata npm test` — Expected: PASS (adding a union member is inert until consumed).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716000001_crossfit_primary_goal.sql OSPREY-app/src/types/preferences.ts OSPREY-app/src/types/onboarding.ts OSPREY-app/src/services/onboarding.ts OSPREY-app/src/services/coaching/goal-map.ts supabase/functions/ozzie-generate-plan/index.ts OSPREY-app/src/services/coaching/__tests__/goal-map.test.ts
git commit -m "feat(coaching): add crossfit primary goal (enum migration + plumbing + goal-map) (phase3-crossfit)"
```

---

### Task 2: `crossfit-params.ts` + `GoalParams` union

**Files:**
- Create: `OSPREY-app/src/services/coaching/crossfit-params.ts`
- Modify: `OSPREY-app/src/services/coaching/strength-params.ts` (`GoalParams` union)
- Test: `OSPREY-app/src/services/coaching/__tests__/crossfit-params.test.ts`

**Interfaces:**
- Consumes: `ParseResult` from `./baseline`.
- Produces: `interface CrossfitGoalParams { oneRepMaxKg: { backSquat: number | null; deadlift: number | null; press: number | null }; competing: boolean; franSec: number | null }`; `toCrossfitParams(raw): CrossfitGoalParams | null`; `parseCrossfitParams(input): ParseResult<CrossfitGoalParams>`. `GoalParams` gains `| CrossfitGoalParams`.

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/services/coaching/__tests__/crossfit-params.test.ts`:

```ts
import { toCrossfitParams, parseCrossfitParams } from '@/services/coaching/crossfit-params';

describe('toCrossfitParams', () => {
  it('reads a stored blob (1RMs + compete + fran)', () => {
    expect(toCrossfitParams({ oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, competing: true, franSec: 200 }))
      .toEqual({ oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, competing: true, franSec: 200 });
  });
  it('is null only when the blob is absent (onboarding skip → generic plan)', () => {
    expect(toCrossfitParams(null)).toBeNull();
  });
  it('keeps a general-fitness crossfitter (competing:false, no 1RMs) as valid params', () => {
    expect(toCrossfitParams({ competing: false })).toEqual({ oneRepMaxKg: { backSquat: null, deadlift: null, press: null }, competing: false, franSec: null });
  });
  it('drops implausible numbers to null', () => {
    expect(toCrossfitParams({ oneRepMaxKg: { backSquat: -5, deadlift: 9999, press: 60 }, competing: false, franSec: 99999 }))
      .toEqual({ oneRepMaxKg: { backSquat: null, deadlift: null, press: 60 }, competing: false, franSec: null });
  });
});

describe('parseCrossfitParams', () => {
  it('accepts all-blank (general fitness needs no 1RM)', () => {
    expect(parseCrossfitParams({ backSquat: '', deadlift: '', press: '', competing: false, fran: '' }))
      .toEqual({ ok: true, value: { oneRepMaxKg: { backSquat: null, deadlift: null, press: null }, competing: false, franSec: null } });
  });
  it('rejects a non-numeric 1RM', () => {
    expect(parseCrossfitParams({ backSquat: 'heavy', deadlift: '', press: '', competing: true, fran: '' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify it fails** — `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/crossfit-params.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

Create `OSPREY-app/src/services/coaching/crossfit-params.ts`:

```ts
import { ParseResult } from './baseline';

type CrossfitMaxes = { backSquat: number | null; deadlift: number | null; press: number | null };

export interface CrossfitGoalParams {
  oneRepMaxKg: CrossfitMaxes;
  competing: boolean;      // Open/compete vs general fitness
  franSec: number | null;  // the athlete's Fran PR — seeds the benchmark read
}

const posKg = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 600 ? Math.round(v) : null);
const posSec = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v <= 3600 ? Math.round(v) : null);
const maxes = (o: unknown): CrossfitMaxes => {
  const m = (o ?? {}) as Partial<CrossfitMaxes>;
  return { backSquat: posKg(m.backSquat), deadlift: posKg(m.deadlift), press: posKg(m.press) };
};

// Stored JSONB → safe params; null only when the blob is absent (onboarding skip → generic
// plan). A general-fitness crossfitter still has competing:false and is valid params.
export function toCrossfitParams(raw: unknown): CrossfitGoalParams | null {
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as Partial<CrossfitGoalParams>;
  return { oneRepMaxKg: maxes(p.oneRepMaxKg), competing: p.competing === true, franSec: posSec(p.franSec) };
}

// Validate collection-form inputs. Nothing is required (general fitness needs no 1RM/Fran).
export function parseCrossfitParams(input: {
  backSquat: string; deadlift: string; press: string; competing: boolean; fran: string;
}): ParseResult<CrossfitGoalParams> {
  const one = (s: string, label: string, max: number): { ok: true; v: number | null } | { ok: false; error: string } => {
    const t = s.trim();
    if (t === '') return { ok: true, v: null };
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > max) return { ok: false, error: `Enter a valid ${label} (or leave it blank).` };
    return { ok: true, v: Math.round(n) };
  };
  const bs = one(input.backSquat, 'back squat in kg', 600);
  const dl = one(input.deadlift, 'deadlift in kg', 600);
  const pr = one(input.press, 'press in kg', 600);
  const fr = one(input.fran, 'Fran time in seconds', 3600);
  const bad = [bs, dl, pr, fr].find((r) => !r.ok);
  if (bad && !bad.ok) return { ok: false, error: bad.error };
  return {
    ok: true,
    value: {
      oneRepMaxKg: { backSquat: bs.ok ? bs.v : null, deadlift: dl.ok ? dl.v : null, press: pr.ok ? pr.v : null },
      competing: input.competing,
      franSec: fr.ok ? fr.v : null,
    },
  };
}
```

In `strength-params.ts`, extend the union + import:
```ts
import type { CrossfitGoalParams } from './crossfit-params';
export type GoalParams = UltraGoalParams | StrengthGoalParams | HyroxGoalParams | CrossfitGoalParams;
```

- [ ] **Step 4: Run — verify it passes** — focused (6 tests) then `npm test`.
- [ ] **Step 5: Commit** — `git add` the two files + test; `feat(coaching): crossfit-params + GoalParams union (phase3-crossfit)`.

---

### Task 3: Benchmark library + `franTier`

**Files:**
- Modify: `OSPREY-app/src/services/calculators/crossfit.ts` (add the library + `franTier`; **export** `ENERGY_SYSTEM_ZONES`)
- Test: `OSPREY-app/src/services/calculators/__tests__/crossfit.test.ts` (create if absent)

**Interfaces:**
- Produces: `type BenchmarkTier`; `interface CrossfitBenchmark`; `const CROSSFIT_BENCHMARKS`; `franTier(franSec: number): BenchmarkTier`; and `ENERGY_SYSTEM_ZONES` becomes exported (consumed by Task 4).

- [ ] **Step 1: Write the failing test**

Create/extend `OSPREY-app/src/services/calculators/__tests__/crossfit.test.ts`:

```ts
import { franTier, CROSSFIT_BENCHMARKS } from '@/services/calculators/crossfit';

describe('franTier', () => {
  it('buckets a Fran time to the fastest tier it beats', () => {
    expect(franTier(110)).toBe('elite');       // <= 120
    expect(franTier(170)).toBe('advanced');     // <= 180
    expect(franTier(280)).toBe('intermediate'); // <= 300
    expect(franTier(600)).toBe('beginner');     // slower than all
  });
});
describe('CROSSFIT_BENCHMARKS', () => {
  it('includes the five iconic WODs', () => {
    expect(CROSSFIT_BENCHMARKS.map((b) => b.name)).toEqual(['Fran', 'Grace', 'Helen', 'Cindy', 'Murph']);
  });
});
```

- [ ] **Step 2: Run — verify it fails** — FAIL (`franTier`/`CROSSFIT_BENCHMARKS` not exported).

- [ ] **Step 3: Implement** — append to `calculators/crossfit.ts` (and add `export` to the existing `const ENERGY_SYSTEM_ZONES`):

```ts
export type BenchmarkTier = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface CrossfitBenchmark {
  name: string;
  movements: string;
  timeDomain: 'short' | 'medium' | 'long';
  scoreType: 'time' | 'rounds';
  // time: seconds (lower = fitter); rounds: total rounds (higher = fitter). Normative by tier.
  normativeByTier: Record<BenchmarkTier, number>;
}

export const CROSSFIT_BENCHMARKS: CrossfitBenchmark[] = [
  { name: 'Fran', movements: '21-15-9 thrusters (43/30 kg) + pull-ups', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 120, advanced: 180, intermediate: 300, beginner: 480 } },
  { name: 'Grace', movements: '30 clean & jerks (60/40 kg) for time', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 90, advanced: 150, intermediate: 240, beginner: 420 } },
  { name: 'Helen', movements: '3 RFT: 400m run, 21 KB swings (24/16 kg), 12 pull-ups', timeDomain: 'medium', scoreType: 'time', normativeByTier: { elite: 480, advanced: 600, intermediate: 780, beginner: 1020 } },
  { name: 'Cindy', movements: '20 min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats', timeDomain: 'long', scoreType: 'rounds', normativeByTier: { elite: 30, advanced: 24, intermediate: 18, beginner: 12 } },
  { name: 'Murph', movements: '1mi run, 100 pull-ups, 200 push-ups, 300 squats, 1mi run', timeDomain: 'long', scoreType: 'time', normativeByTier: { elite: 2400, advanced: 2880, intermediate: 3600, beginner: 4800 } },
];

// Bucket a Fran time (sec) to a tier — the fastest tier whose normative bound it beats.
export function franTier(franSec: number): BenchmarkTier {
  const fran = CROSSFIT_BENCHMARKS[0].normativeByTier;
  if (franSec <= fran.elite) return 'elite';
  if (franSec <= fran.advanced) return 'advanced';
  if (franSec <= fran.intermediate) return 'intermediate';
  return 'beginner';
}
```

- [ ] **Step 4: Run — verify it passes** — focused, then `npm test`.
- [ ] **Step 5: Commit** — `feat(coaching): crossfit benchmark library + franTier + export energy zones (phase3-crossfit)`.

---

### Task 4: `crossfit.ts` (`CrossfitPrescription`) + envelope wiring

**Files:**
- Create: `OSPREY-app/src/services/coaching/crossfit.ts`
- Modify: `OSPREY-app/src/services/coaching/envelope.ts` (import; `EnvelopeInput.crossfitParams?`; `CoachingEnvelope.crossfit`; `computeEnvelope`)
- Test: `OSPREY-app/src/services/coaching/__tests__/crossfit.test.ts` + additions to `__tests__/envelope.test.ts`

**Interfaces:**
- Consumes: `intensityZoneForPercent1RM` from `@/services/calculators/powerlifting`; `ENERGY_SYSTEM_ZONES`/`franTier`/`CROSSFIT_BENCHMARKS`/`EnergySystemZone`/`BenchmarkTier` from `@/services/calculators/crossfit`; `Phase` from `./periodization`; `EnvelopeInput` (gains `crossfitParams?`).
- Produces: `interface CrossfitPrescription { strengthLoadsKg: { backSquat: number; deadlift: number; press: number }; workingPercent1RM: number; zoneName: string; energySystems: EnergySystemZone[]; benchmark: { name: string; timeDomain: string; athleteFranSec: number | null; franTier: BenchmarkTier | null } }`; `buildCrossfitPrescription(input): CrossfitPrescription | null`. Mirrored by the edge (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `OSPREY-app/src/services/coaching/__tests__/crossfit.test.ts`:

```ts
import { buildCrossfitPrescription } from '@/services/coaching/crossfit';

const base = () => ({
  sport: 'crossfit', phase: 'Base', weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'intermediate', bodyWeightKg: 80, rowingSplitSecPer500: null,
  crossfitParams: { oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, competing: true, franSec: 200 },
} as any);

describe('buildCrossfitPrescription', () => {
  it('builds phase-% strength loads + the athlete Fran tier', () => {
    const c = buildCrossfitPrescription(base())!;
    expect(c.workingPercent1RM).toBe(78);                       // Base
    expect(c.strengthLoadsKg.backSquat).toBe(Math.round(140 * 78 / 100)); // 109
    expect(c.benchmark.franTier).toBe('intermediate');          // franTier(200): 200 > 180 (advanced), 200 <= 300 (intermediate)
    expect(c.energySystems.length).toBe(4);
  });
  it('is null for a non-crossfit sport', () => {
    expect(buildCrossfitPrescription({ ...base(), sport: 'run' })).toBeNull();
  });
  it('is null when crossfitParams is absent (paramless → generic plan)', () => {
    expect(buildCrossfitPrescription({ ...base(), crossfitParams: null })).toBeNull();
  });
  it('uses 0 load for a lift with no 1RM (prompt programs it by RPE)', () => {
    const c = buildCrossfitPrescription({ ...base(), crossfitParams: { oneRepMaxKg: { backSquat: null, deadlift: 180, press: null }, competing: false, franSec: null } })!;
    expect(c.strengthLoadsKg.backSquat).toBe(0);
    expect(c.benchmark.franTier).toBeNull();
  });
});
```

Add to `envelope.test.ts` (mirroring the hyrox block): a `crossfit` non-null case for `sport:'crossfit'`, and the byte-identical regression — `computeEnvelope({...baseInput, crossfitParams})` for `sport:'run'` has `crossfit: null` and `toEqual` the no-crossfitParams envelope.

- [ ] **Step 2: Run — verify it fails.**

- [ ] **Step 3: Implement**

Create `OSPREY-app/src/services/coaching/crossfit.ts`:

```ts
import { intensityZoneForPercent1RM } from '@/services/calculators/powerlifting';
import { ENERGY_SYSTEM_ZONES, franTier, CROSSFIT_BENCHMARKS, type EnergySystemZone, type BenchmarkTier } from '@/services/calculators/crossfit';
import { Phase } from './periodization';
import type { EnvelopeInput } from './envelope';

// Concurrent-strength %1RM by phase (crossfit is not peaking a 1RM like powerlifting).
// Each value lands inside an INTENSITY_ZONES band so intensityZoneForPercent1RM is non-null.
const CROSSFIT_PHASE_PERCENT: Record<Phase, number> = { Base: 78, Build: 84, Peak: 88, Taper: 80 };
// Benchmark to test per phase (short in Base/Build, a Hero before Competition, retest at Taper).
const BENCHMARK_BY_PHASE: Record<Phase, string> = { Base: 'Fran', Build: 'Fran', Peak: 'Murph', Taper: 'Fran' };

export interface CrossfitPrescription {
  strengthLoadsKg: { backSquat: number; deadlift: number; press: number }; // 0 = no 1RM → RPE
  workingPercent1RM: number;
  zoneName: string;
  energySystems: EnergySystemZone[];
  benchmark: { name: string; timeDomain: string; athleteFranSec: number | null; franTier: BenchmarkTier | null };
}

export function buildCrossfitPrescription(input: EnvelopeInput): CrossfitPrescription | null {
  if (input.sport !== 'crossfit') return null;
  const p = input.crossfitParams;
  if (!p) return null;
  const pct = CROSSFIT_PHASE_PERCENT[input.phase];
  const zone = intensityZoneForPercent1RM(pct);
  const load = (orm: number | null) => (orm && orm > 0 ? Math.round(orm * pct / 100) : 0);
  const name = BENCHMARK_BY_PHASE[input.phase];
  return {
    strengthLoadsKg: { backSquat: load(p.oneRepMaxKg.backSquat), deadlift: load(p.oneRepMaxKg.deadlift), press: load(p.oneRepMaxKg.press) },
    workingPercent1RM: pct,
    zoneName: zone?.name ?? 'Strength-Volume',
    energySystems: ENERGY_SYSTEM_ZONES,
    benchmark: {
      name,
      timeDomain: CROSSFIT_BENCHMARKS.find((b) => b.name === name)?.timeDomain ?? 'short',
      athleteFranSec: p.franSec,
      franTier: p.franSec != null ? franTier(p.franSec) : null,
    },
  };
}
```

In `envelope.ts`: import `{ buildCrossfitPrescription, CrossfitPrescription } from './crossfit';`; add `crossfit: CrossfitPrescription | null;` to `CoachingEnvelope` (after `hyrox`); add `crossfitParams?: import('./crossfit-params').CrossfitGoalParams | null;` to `EnvelopeInput` (after `hyroxParams`); in `computeEnvelope`, after `const hyrox = buildHyroxPrescription(input);` add `const crossfit = buildCrossfitPrescription(input);` and add `crossfit,` to the return (after `hyrox,`).

- [ ] **Step 4: Run — verify it passes** (focused + `envelope.test.ts`).
- [ ] **Step 5: Full app suite** (byte-identical gate — non-crossfit envelopes carry `crossfit: null`, unchanged).
- [ ] **Step 6: Commit** — `feat(coaching): CrossfitPrescription envelope field (3-modality + benchmark) (phase3-crossfit)`.

---

### Task 5: `computeFuel` crossfit branch

**Files:** Modify `OSPREY-app/src/services/coaching/fuel.ts`; Test `__tests__/fuel.test.ts`.

**Interfaces:** Consumes `crossfitDailyNutrition` from `@/services/calculators/crossfit`. No signature change.

- [ ] **Step 1: Failing test** — add to `fuel.test.ts`:
```ts
  it('gives crossfit its nutrition (4-8 g/kg carbs) + a race in-session rate', () => {
    const f = computeFuel('crossfit', 80);
    expect(f.dailyCarbGByDayType.easy.min).toBe(Math.round(4 * 80)); // 320
    expect(f.dailyCarbGByDayType.peak.max).toBe(Math.round(8 * 80)); // 640
    expect(f.proteinG.min).toBe(Math.round(80 * 1.6));
    expect(f.longSessionCarbGPerHour).toBeGreaterThan(0);            // doubles/long metcons
  });
```
- [ ] **Step 2: Run — fails** (crossfit currently hits the endurance default; the carb band differs).
- [ ] **Step 3: Implement** — add the import `crossfitDailyNutrition` and a branch after the `hyrox` branch, mirroring it:
```ts
  if (sport === 'crossfit') {
    const n = crossfitDailyNutrition(bodyWeightKg);          // carbG 4-8 g/kg, proteinG 1.6-2.2
    const mid = Math.round((n.carbG.min + n.carbG.max) / 2);
    const low: Range = { min: Math.round(n.carbG.min), max: mid };
    const high: Range = { min: mid, max: Math.round(n.carbG.max) };
    return {
      dailyCarbGByDayType: { easy: low, moderate: low, high, peak: high },
      proteinG: { min: Math.round(n.proteinG.min), max: Math.round(n.proteinG.max) },
      longSessionCarbGPerHour: 45,                           // intra-workout carbs on long metcons/doubles
    };
  }
```
- [ ] **Step 4: Run — passes** (focused + full suite; other sports unchanged).
- [ ] **Step 5: Commit** — `feat(coaching): crossfit fuel branch (phase3-crossfit)`.

---

### Task 6: Thread `crossfitParams` through `build-envelope.ts`

**Files:** Modify `OSPREY-app/src/services/coaching/build-envelope.ts`; Test `__tests__/build-envelope.test.ts`.

**Interfaces:** Consumes `toCrossfitParams`/`CrossfitGoalParams` (Task 2). Produces: `resolveGoalInputs` return gains `crossfitParams: CrossfitGoalParams | null`; `EnvelopeInputs.crossfitParams?`.

- [ ] **Step 1: Failing test** — add to the `resolveGoalInputs` describe block:
```ts
  it('switches to crossfit and populates crossfitParams', () => {
    const r = resolveGoalInputs('crossfit', 'run', { competing: true, oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 } });
    expect(r.sport).toBe('crossfit');
    expect(r.crossfitParams).toEqual({ oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, competing: true, franSec: null });
    expect(r.strengthParams).toBeNull();
  });
  it('leaves crossfitParams null for a non-crossfit goal', () => {
    expect(resolveGoalInputs('run_performance', 'run', null).crossfitParams).toBeNull();
  });
```
- [ ] **Step 2: Run — fails** (`crossfitParams` not on the return).
- [ ] **Step 3: Implement** — import `{ toCrossfitParams, type CrossfitGoalParams } from './crossfit-params';`; extend `resolveGoalInputs`'s return type + body with `crossfitParams: effectiveGoal === 'crossfit' ? toCrossfitParams(goalParams) : null,`; add `crossfitParams?: CrossfitGoalParams | null;` to the private `EnvelopeInputs`; add `crossfitParams: i.crossfitParams,` to `envelopeFromInputs`'s `computeEnvelope({ … })` call. (The `...resolveGoalInputs(...)` spread in `invokeGeneratePlan` carries it automatically.)
- [ ] **Step 4: Run — passes** (focused + full suite).
- [ ] **Step 5: Commit** — `feat(coaching): thread crossfitParams through resolveGoalInputs + envelope build (phase3-crossfit)`.

---

### Task 7: `routeDisciplineDays` crossfit branch (edge)

**Files:** Modify `supabase/functions/ozzie-generate-plan/goals.ts`; Test `goals.test.ts`.

**Interfaces:** No signature change; `routeDisciplineDays('crossfit', …)` returns a strength-anchored mixed split.

- [ ] **Step 1: Failing test** — add a Deno test asserting a crossfit athlete is strength-anchored with engine days:
```ts
Deno.test('crossfit routes strength-anchored with engine days', () => {
  const d = routeDisciplineDays('crossfit', 5, 2, false, false);
  assertEquals(d.weeklyLiftDays, 5);            // strength/metcon in most sessions
  assertEquals(d.weeklyRunDays, 2);             // dedicated engine (min(2, liftDays))
  assertEquals(d.weeklyRowDays, 0);
});
```
- [ ] **Step 2: Run — fails** (crossfit falls to the `ENDURANCE_PRIMARY` default → run-primary).
- [ ] **Step 3: Implement** — add a crossfit early-return before the `ENDURANCE_PRIMARY` lookup (mirroring the `lift` branch; the prompt programs concurrent modalities within the lift/metcon days):
```ts
  if (primaryGoal === 'crossfit') {
    // Mixed-modal, strength-anchored: most sessions carry a barbell + a metcon; keep a
    // couple of dedicated engine days (docs/coaching/crossfit.md §3).
    return {
      weeklyRunDays: Math.min(2, liftDays),
      weeklyLiftDays: primaryDays,
      weeklySwimDays: includeSwim ? 1 : 0,
      weeklyBikeDays: includeBike ? 1 : 0,
      weeklyRowDays: 0,
    };
  }
```
- [ ] **Step 4: Run — passes** (`deno test .../goals.test.ts`; non-crossfit routing unchanged).
- [ ] **Step 5: Commit** — `feat(edge): route crossfit strength-anchored mixed-modal (phase3-crossfit)`.

---

### Task 8: Edge — `crossfitGuidance` + `Envelope.crossfit` mirror

**Files:** Modify `supabase/functions/ozzie-generate-plan/guidance.ts` (+ `CrossfitInfo`), `index.ts` (`Envelope.crossfit` mirror + call); Test `guidance.test.ts`.

**Interfaces:** Produces `CrossfitInfo` + `crossfitGuidance(c: CrossfitInfo | null | undefined): string`. `index.ts` `Envelope.crossfit` inline type mirrors `CrossfitPrescription`.

- [ ] **Step 1: Failing tests** — add to `guidance.test.ts` a `fullCrossfit: CrossfitInfo` fixture + tests: `crossfitGuidance(null) === ''`; a populated one includes the strength loads (`squat 109kg`), the benchmark (`Fran`), the phase %, and `descriptions` (gymnastics/metcon steered to notes, not the whitelist).
- [ ] **Step 2: Run — fails** (not exported).
- [ ] **Step 3: Implement** — append to `guidance.ts` (mirroring `hyroxGuidance`): `CrossfitInfo` (field-for-field mirror of `CrossfitPrescription`) + `crossfitGuidance(c)` that, when `c`, states: the concurrent 3-modality emphasis by phase; strength at `~${c.workingPercent1RM}% 1RM` — back squat/deadlift/press loads (omit a lift with load 0 → "by RPE"); the energy-system work:rest framework for metcons (from `c.energySystems`); the benchmark test (`c.benchmark.name`) + the athlete's Fran tier read; "program gymnastics + metcon work in the session descriptions/ozzie_notes (not lift_prescription)". In `index.ts`: add `crossfitGuidance` to the `./guidance.ts` import; add the `Envelope.crossfit` mirror block (after `hyrox`); append `+ crossfitGuidance(envelope.crossfit)` in `envelopeGuidance` (after `hyroxGuidance(envelope.hyrox)`).
- [ ] **Step 4: Run — passes** — `deno test .../guidance.test.ts`, then the full edge suite + `deno check index.ts` (26 baseline, 0 new).
- [ ] **Step 5: Commit** — `feat(edge): crossfit prompt block (3 modalities + energy systems + benchmark) + Envelope.crossfit mirror (phase3-crossfit)`.

---

### Task 9: Collection UI

**Files:** Modify `app/(onboarding)/goals.tsx` (crossfit option), `app/(onboarding)/baseline.tsx` + `app/preferences.tsx` (1RM inputs + compete toggle + Fran); Verify typecheck + preview.

- [ ] **Step 1** — add a `crossfit` option to the goal picker in `goals.tsx` and the `GOAL_OPTIONS` in `preferences.tsx` (mirroring the hyrox/lift options).
- [ ] **Step 2** — in `baseline.tsx`: add state for `backSquat`/`deadlift`/`press`/`competing`/`fran`; a crossfit render branch (three `NumberField`s + a compete toggle + an optional Fran field) mirroring the `lift` branch; in `onContinue`, a `primaryGoal === 'crossfit'` branch that `parseCrossfitParams(...)` → `setGoalParams` (early-return on `!ok`, like lift). CrossFit has no run anchor → follow the **lift** pattern (early-return via `router.push(HEALTH)`), not the ultra/hyrox fall-through.
- [ ] **Step 3** — in `preferences.tsx`: `isCrossfit = primaryGoal === 'crossfit'`; state seeded from `saved.goalParams`; in `handleGenerate`, `parseCrossfitParams` + persist-before-generate (mirror the `strengthParamsValue` block: `update user_goals.goal_params` BEFORE `invokeGeneratePlan`) + add to the `preferences` object; render the crossfit fields (mirror `isLift`).
- [ ] **Step 4** — `cd OSPREY-app && npx tsc --noEmit` (0 errors); preview. Device smoke test is the pre-ship item (headless Expo caveat).
- [ ] **Step 5: Commit** — `feat(app): collect crossfit 1RMs + compete + Fran on onboarding + plan-builder (phase3-crossfit)`.

---

## After all tasks

- **Final whole-branch review** (opus) over `git merge-base main HEAD`..HEAD. Focus: non-crossfit byte-identical (envelope/fuel/routing/validate untouched paths), the app↔edge `CrossfitPrescription`/`CrossfitInfo` mirror agreement, `resolveGoalInputs` gates all four param families, and the new migration is additive/idempotent.
- **finishing-a-development-branch:** full Jest + Deno suites on the merged result before `--no-ff` to `main`.
- **Deploy:** the crossfit enum migration + the edge changes join the coaching engine's already-pending atomic redeploy (now 5 migrations + the fn redeploy). Apply the enum **before/with** the redeploy.

## Spec coverage map

| Spec item | Task |
|---|---|
| Migration + goal plumbing (enum/TrainingGoal/PrimaryGoal/goal-map/PRIMARY_GOAL_MAP) | 1 |
| `CrossfitGoalParams` + `GoalParams` union | 2 |
| Benchmark library + Fran tiering | 3 |
| `crossfit` envelope field (strength %1RM + energy systems + benchmark) | 4 |
| Engine = hrZones (no ZoneSet/blueprintSport change) | 4 (test asserts) |
| Crossfit fuel branch | 5 |
| `resolveGoalInputs` gates crossfitParams | 6 |
| Mixed-modal routing | 7 |
| Edge prompt block + mirror; metcon in notes not whitelist | 8 |
| Collection UI + persist-before-generate | 9 |
| Paramless crossfit → null → generic plan | 2 (`toCrossfitParams` null) + 4 (`buildCrossfitPrescription` null) |
| Non-crossfit byte-identical / one new migration | 4 + full suites; 1 |
