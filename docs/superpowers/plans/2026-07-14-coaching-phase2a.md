# Coaching-Engine Phase 2a — ZoneSet + Swim & Rowing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the running-only coaching envelope to a `ZoneSet` discriminated union and extend the pace-clamp to swimming (CSS, sec/100m) and rowing (2k split, sec/500m), reusing the whole Phase 1 architecture.

**Architecture:** `CoachingEnvelope.runZones` becomes `zones: ZoneSet | null` (kinds `run`/`swim`/`rowing`). `computeEnvelope` dispatches per sport (via a canonical sport-key map) to the existing tested calculators. `validate.ts` clamps implied pace into the band using a per-kind pace formula. Cycling / triathlon / HR-fallback / anchor-acquisition are later sub-phases (2b/2c) — out of scope here.

**Tech Stack:** React Native / Expo (app, Jest), Deno (edge function, `deno test`), Supabase.

## Global Constraints

- Coaching logic authoritative in `docs/coaching/`; reuse `src/services/calculators/*` (swimming, rowing) — do not reinvent formulas.
- TDD: test first, watch it fail, minimal impl. Jest pinned `TZ=Asia/Kolkata`; `@/` → `OSPREY-app/src/`.
- The Deno edge fn cannot import app `@/` code — it carries a hand-duplicated (narrower) `Envelope`/`ZoneSet` type and a pure `validate.ts`.
- Lint rule `no-restricted-syntax` bans `x.toISOString().slice()`.
- Keep the existing idempotency / one-active-plan / reschedule logic intact. Do NOT deploy (go-live deploys the edge fn).
- Backward-compat: envelope-absent → prior behavior; and within this plan the app (`zones`) and edge fn (`zones`) change together, so there's no deployed-version skew.
- App checks from `OSPREY-app/`: `npx jest`, `npx tsc --noEmit`, `npx eslint src --ext .ts,.tsx`. Edge fn: `cd supabase/functions/ozzie-generate-plan && deno test validate.test.ts`.
- Scope: swim = tier-estimate anchor for now (real input/HR is 2b); rowing = data-derived split (+ tier fallback).

---

### Task 1: `ZoneSet` union + sport-key map + refactor `computeEnvelope` (run stays green)

**Files:**
- Create: `OSPREY-app/src/services/coaching/zones.ts`
- Modify: `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` (exists), `OSPREY-app/src/services/coaching/__tests__/zones.test.ts` (new)

**Interfaces:**
- Produces:
  - `zones.ts`: `type ZoneSet = { kind:'run'; thresholdSecPerMile:number; bands:RunningPaceZones } | { kind:'swim'; cssSecPer100:number; bands:SwimPaceZones } | { kind:'rowing'; splitSecPer500:number; bands:RowingTrainingZones }`
  - `zones.ts`: `blueprintSport(primaryGoal: string): 'run' | 'swim' | 'rowing' | null` — run/hybrid→'run', swim→'swim', rowing→'rowing', hyrox→'run' (its anchor is run pace, docs/coaching/hyrox.md), everything else→null (cycling/tri/lift are later phases).
  - `CoachingEnvelope.zones: ZoneSet | null` replaces `runZones`.

- [ ] **Step 1: Write the failing test** — `zones.test.ts`:

```ts
import { blueprintSport } from '@/services/coaching/zones';

describe('blueprintSport', () => {
  it('maps run and hybrid to run zones', () => {
    expect(blueprintSport('run')).toBe('run');
    expect(blueprintSport('hybrid')).toBe('run');
  });
  it('maps hyrox to run (its anchor is compromised run pace)', () => {
    expect(blueprintSport('hyrox')).toBe('run');
  });
  it('maps swim and rowing to themselves', () => {
    expect(blueprintSport('swim')).toBe('swim');
    expect(blueprintSport('rowing')).toBe('rowing');
  });
  it('returns null for sports without endurance zones this phase', () => {
    expect(blueprintSport('cycling')).toBeNull();
    expect(blueprintSport('lift')).toBeNull();
    expect(blueprintSport('triathlon')).toBeNull();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/zones.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `zones.ts`**

```ts
// OSPREY-app/src/services/coaching/zones.ts
import { RunningPaceZones } from '@/services/calculators/running';
import { SwimPaceZones } from '@/services/calculators/swimming';
import { RowingTrainingZones } from '@/services/calculators/rowing';

export type ZoneSet =
  | { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones }
  | { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones }
  | { kind: 'rowing'; splitSecPer500: number; bands: RowingTrainingZones };

export type BlueprintSport = 'run' | 'swim' | 'rowing';

/** Canonical primaryGoal → the blueprint whose zones drive the plan (Phase 2a set). */
export function blueprintSport(primaryGoal: string): BlueprintSport | null {
  if (primaryGoal === 'run' || primaryGoal === 'hybrid' || primaryGoal === 'hyrox') return 'run';
  if (primaryGoal === 'swim') return 'swim';
  if (primaryGoal === 'rowing') return 'rowing';
  return null; // cycling / triathlon / lift / cross — later phases
}
```

- [ ] **Step 4: Refactor `envelope.ts`** — replace `runZones` with `zones` and dispatch on `blueprintSport`:

```ts
import { runningPaceZones, RunningPaceZones } from '@/services/calculators/running';
import { Phase, loadingWeek, targetWeeklyLoad } from './periodization';
import { resolveRunningAnchor } from './anchor';
import { computeRunningFuel, FuelTargets } from './fuel';
import { ZoneSet, blueprintSport } from './zones';

export interface CoachingEnvelope {
  sport: string;
  phase: Phase;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number;
  zones: ZoneSet | null;
  fuel: FuelTargets;
}
```
In `computeEnvelope`, replace the `isRun`/`runZones` block with:
```ts
  let zones: ZoneSet | null = null;
  const bp = blueprintSport(input.sport);
  if (bp === 'run') {
    const t = resolveRunningAnchor({
      bestRunMiles: input.bestRunMiles,
      bestRunTimeS: input.bestRunTimeS,
      fitnessLevel: input.fitnessLevel,
    }).thresholdSecPerMile;
    zones = { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) };
  }
  // swim / rowing added in Tasks 2 & 3.
```
and return `zones` instead of `runZones`. (Keep the unused `RunningPaceZones` import only if still referenced; otherwise drop it.)

- [ ] **Step 5: Update `envelope.test.ts`** — change assertions from `env.runZones` to `env.zones`, and check the discriminant:

```ts
  it('produces run zones from the derived anchor for a running plan', () => {
    const env = computeEnvelope(baseInput);
    expect(env.zones).not.toBeNull();
    expect(env.zones!.kind).toBe('run');
    if (env.zones!.kind === 'run') {
      expect(env.zones.bands.easy.min).toBeGreaterThan(env.zones.thresholdSecPerMile);
    }
  });
```
(Update the other `runZones` references in that file the same way; the "omits zones for a non-running sport" test now expects `computeEnvelope({ ...baseInput, sport: 'cycling' }).zones` to be `null`.)

- [ ] **Step 6: Run all coaching tests + typecheck**

Run: `cd OSPREY-app && npx jest src/services/coaching && npx tsc --noEmit`
Expected: PASS + clean. (This proves the refactor kept run green.)

- [ ] **Step 7: Commit**

```bash
git add OSPREY-app/src/services/coaching/zones.ts OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/zones.test.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "refactor(coaching): CoachingEnvelope.runZones -> zones ZoneSet + sport-key map"
```

---

### Task 2: Swimming zones (tier-estimate anchor)

**Files:**
- Modify: `OSPREY-app/src/services/coaching/anchor.ts`, `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/anchor.test.ts`, `envelope.test.ts`

**Interfaces:**
- Consumes: `computeCSSPer100`, `swimPaceZones` from `@/services/calculators/swimming`.
- Produces: `estimateSwimCssByTier(fitnessLevel: string): number` (sec/100m); `computeEnvelope` returns `{ kind:'swim', ... }` for a swim sport.

- [ ] **Step 1: Write the failing test** — in `anchor.test.ts`:

```ts
import { estimateSwimCssByTier } from '@/services/coaching/anchor';

describe('estimateSwimCssByTier', () => {
  it('gives a realistic CSS per 100m and ranks advanced faster than beginner', () => {
    const adv = estimateSwimCssByTier('advanced');
    const beg = estimateSwimCssByTier('beginner');
    expect(adv).toBeGreaterThan(60);   // faster than 1:00/100m is implausible for these tiers
    expect(beg).toBeLessThan(180);
    expect(adv).toBeLessThan(beg);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/anchor.test.ts`
Expected: FAIL — `estimateSwimCssByTier` not a function.

- [ ] **Step 3: Implement** in `anchor.ts`:

```ts
// Coarse cold-start CSS (sec/100m) by tier — until 2b adds the 400+200 TT input / HR zones.
const TIER_SWIM_CSS_SEC_PER_100: Record<string, number> = {
  advanced: 80,     // 1:20/100m
  intermediate: 100, // 1:40/100m
  beginner: 130,     // 2:10/100m
};

export function estimateSwimCssByTier(fitnessLevel: string): number {
  return TIER_SWIM_CSS_SEC_PER_100[fitnessLevel] ?? TIER_SWIM_CSS_SEC_PER_100.beginner;
}
```

- [ ] **Step 4: Dispatch swim in `computeEnvelope`** — add after the `run` branch:

```ts
  } else if (bp === 'swim') {
    const css = estimateSwimCssByTier(input.fitnessLevel);
    zones = { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) };
  }
```
Add imports: `import { swimPaceZones } from '@/services/calculators/swimming';` and `estimateSwimCssByTier` from `./anchor`.

- [ ] **Step 5: Test the swim envelope** — in `envelope.test.ts`:

```ts
  it('produces swim zones for a swimming plan', () => {
    const env = computeEnvelope({ ...baseInput, sport: 'swim' });
    expect(env.zones?.kind).toBe('swim');
    if (env.zones?.kind === 'swim') {
      expect(env.zones.bands.z3Threshold.min).toBeLessThan(env.zones.cssSecPer100); // threshold is faster than CSS
    }
  });
```

- [ ] **Step 6: Run + typecheck**

Run: `cd OSPREY-app && npx jest src/services/coaching && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 7: Commit**

```bash
git add OSPREY-app/src/services/coaching/anchor.ts OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/anchor.test.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "feat(coaching): swim zones (tier-estimate CSS -> swimPaceZones)"
```

---

### Task 3: Rowing zones (data-derived 2k split + tier fallback)

**Files:**
- Modify: `OSPREY-app/src/services/coaching/anchor.ts`, `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `anchor.test.ts`, `envelope.test.ts`

**Interfaces:**
- Consumes: `rowingTrainingZones` from `@/services/calculators/rowing`.
- Produces:
  - `selectBestRowingSplit(efforts: { distanceKm: number; timeS: number }[]): number | null` — best (fastest) split sec/500m from efforts ≥ 1000m; null if none.
  - `estimateRowingSplitByTier(fitnessLevel: string): number`
  - `EnvelopeInput.rowingSplitSecPer500: number | null` (pre-derived by build-envelope); `computeEnvelope` returns `{ kind:'rowing', ... }` for a rowing sport, using the passed split or the tier fallback.

- [ ] **Step 1: Write the failing test** — in `anchor.test.ts`:

```ts
import { selectBestRowingSplit, estimateRowingSplitByTier } from '@/services/coaching/anchor';

describe('selectBestRowingSplit', () => {
  it('returns the fastest split (sec/500m) among efforts >= 1000m', () => {
    const efforts = [
      { distanceKm: 2, timeS: 480 },  // 2000m in 8:00 => 120 s/500m
      { distanceKm: 5, timeS: 1350 }, // 5000m in 22:30 => 135 s/500m
      { distanceKm: 0.5, timeS: 90 }, // 500m sprint — excluded (< 1000m)
    ];
    expect(selectBestRowingSplit(efforts)).toBe(120);
  });
  it('returns null when there is no qualifying effort', () => {
    expect(selectBestRowingSplit([{ distanceKm: 0.4, timeS: 80 }])).toBeNull();
    expect(selectBestRowingSplit([])).toBeNull();
  });
});

describe('estimateRowingSplitByTier', () => {
  it('ranks advanced faster than beginner', () => {
    expect(estimateRowingSplitByTier('advanced')).toBeLessThan(estimateRowingSplitByTier('beginner'));
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/anchor.test.ts`
Expected: FAIL — functions not found.

- [ ] **Step 3: Implement** in `anchor.ts`:

```ts
const TIER_ROWING_SPLIT_SEC_PER_500: Record<string, number> = {
  advanced: 105,     // 1:45/500m
  intermediate: 120, // 2:00/500m
  beginner: 140,     // 2:20/500m
};

export function estimateRowingSplitByTier(fitnessLevel: string): number {
  return TIER_ROWING_SPLIT_SEC_PER_500[fitnessLevel] ?? TIER_ROWING_SPLIT_SEC_PER_500.beginner;
}

/** Best (fastest) 500m split from logged rowing efforts >= 1000m. Approximates the
 *  2k-split anchor; refine with a real 2k test in a later phase. */
export function selectBestRowingSplit(efforts: { distanceKm: number; timeS: number }[]): number | null {
  const splits = efforts
    .filter((e) => e.distanceKm >= 1 && e.timeS > 0)
    .map((e) => e.timeS / (e.distanceKm * 2)); // sec per 500m
  if (splits.length === 0) return null;
  return Math.round(Math.min(...splits));
}
```

- [ ] **Step 4: Dispatch rowing in `computeEnvelope`** — add the input field and branch. In `EnvelopeInput` add `rowingSplitSecPer500: number | null;`. Add after the swim branch:

```ts
  } else if (bp === 'rowing') {
    const split = input.rowingSplitSecPer500 ?? estimateRowingSplitByTier(input.fitnessLevel);
    zones = { kind: 'rowing', splitSecPer500: split, bands: rowingTrainingZones(split) };
  }
```
Add imports: `import { rowingTrainingZones } from '@/services/calculators/rowing';` and `estimateRowingSplitByTier` from `./anchor`.

- [ ] **Step 5: Test the rowing envelope** — in `envelope.test.ts` add `rowingSplitSecPer500: null` to `baseInput`, then:

```ts
  it('produces rowing zones for a rowing plan, using the passed split', () => {
    const env = computeEnvelope({ ...baseInput, sport: 'rowing', rowingSplitSecPer500: 120 });
    expect(env.zones?.kind).toBe('rowing');
    if (env.zones?.kind === 'rowing') {
      expect(env.zones.splitSecPer500).toBe(120);
      expect(env.zones.bands.tr.splitSecPer500.min).toBe(120); // TR band starts at the 2k split
    }
  });
```

- [ ] **Step 6: Run + typecheck**

Run: `cd OSPREY-app && npx jest src/services/coaching && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 7: Commit**

```bash
git add OSPREY-app/src/services/coaching/anchor.ts OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/anchor.test.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "feat(coaching): rowing zones (data-derived 2k split + tier fallback)"
```

---

### Task 4: `build-envelope` — feed the rowing split + `rowingSplitSecPer500` through

**Files:**
- Modify: `OSPREY-app/src/services/coaching/build-envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts`

**Interfaces:**
- Consumes: `selectBestRowingSplit` (Task 3).
- Produces: `envelopeFromInputs` + `invokeGeneratePlan` populate `rowingSplitSecPer500`.

- [ ] **Step 1: Write the failing test** — in `build-envelope.test.ts`:

```ts
  it('passes a rowing split through to a rowing envelope', () => {
    const env = envelopeFromInputs({
      sport: 'rowing', race: null, fitnessLevel: 'intermediate', bodyWeightKg: 80,
      baselineLoad: 200, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
      rowingSplitSecPer500: 118,
    });
    expect(env.zones?.kind).toBe('rowing');
  });
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/build-envelope.test.ts`
Expected: FAIL — `EnvelopeInputs`/`envelopeFromInputs` has no `rowingSplitSecPer500` (type error) or the field is dropped.

- [ ] **Step 3: Implement** — add `rowingSplitSecPer500: number | null` to the `EnvelopeInputs` interface and thread it in `envelopeFromInputs` (pass `rowingSplitSecPer500: i.rowingSplitSecPer500` into `computeEnvelope`). In `invokeGeneratePlan`, extend the default `inputs` with `rowingSplitSecPer500: null`, add a rowing-logs fetch to the `Promise.all`, and derive the split:

```ts
      supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'rowing').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
```
Then, alongside the existing `.error` warns and `recentRuns` mapping:
```ts
    const recentRows = (rowsRes.data ?? [])
      .filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceKm: r.total_distance_km as number, timeS: r.total_duration_s as number }));
    const rowingSplit = selectBestRowingSplit(recentRows);
```
and set `rowingSplitSecPer500: rowingSplit` in the `inputs` object. (Name the new `Promise.all` result `rowsRes` and add its `.error` warn.)

- [ ] **Step 4: Run + typecheck + lint**

Run: `cd OSPREY-app && npx jest src/services/coaching && npx tsc --noEmit && npx eslint src/services/coaching/build-envelope.ts`
Expected: PASS, clean, 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/build-envelope.ts OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts
git commit -m "feat(coaching): derive + pass the rowing split from recent rowing logs"
```

---

### Task 5: Edge-fn `Envelope` type + prompt → per-kind zones

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts`

**Interfaces:**
- Consumes: `body.envelope.zones` (the `ZoneSet` JSON from the app).
- Produces: `generateWeekDays` emits pace-band guidance keyed to `zones.kind`.

- [ ] **Step 1: Replace the `Envelope.runZones` field with `zones`** (index.ts ~:57):

```ts
  zones:
    | { kind: 'run'; thresholdSecPerMile: number; easy: { min: number; max: number }; marathonPace: { min: number; max: number }; tenKPace: { min: number; max: number }; fiveKPace: { min: number; max: number } }
    | { kind: 'swim'; cssSecPer100: number; z1EasyRecovery: { min: number; max: number | null }; z2Aerobic: { min: number; max: number }; z3Threshold: { min: number; max: number }; z4Vo2Max: { min: number; max: number } }
    | { kind: 'rowing'; splitSecPer500: number; ut2: { splitSecPer500: { min: number; max: number } }; ut1: { splitSecPer500: { min: number; max: number } }; at: { splitSecPer500: { min: number; max: number } }; tr: { splitSecPer500: { min: number; max: number } } }
    | null;
```
> Note: this is a narrower hand-copy of the app `ZoneSet` (Deno can't import `@/`); the app `bands` are nested under `zones.bands` — keep the edge copy flattened OR read `zones.bands` consistently. To avoid drift, read the SAME shape the app sends: the app's run zone is `{ kind, thresholdSecPerMile, bands: RunningPaceZones }`, so the edge type's per-kind fields live under `.bands`. Update the field paths below accordingly (e.g. `z.bands.easy`).

- [ ] **Step 2: Rewrite `envelopeGuidance`** (index.ts ~:250) to switch on `zones.kind`:

```ts
  const z = envelope?.zones;
  const zoneGuidance = !z
    ? ''
    : z.kind === 'run'
      ? ` Run pace bands (sec/mile): easy ${z.bands.easy.min}-${z.bands.easy.max}, threshold ~${z.thresholdSecPerMile}, 10K ${z.bands.tenKPace.min}-${z.bands.tenKPace.max}, 5K/interval ${z.bands.fiveKPace.min}-${z.bands.fiveKPace.max}.`
      : z.kind === 'swim'
        ? ` Swim CSS ~${z.cssSecPer100} s/100m; easy ${z.bands.z2Aerobic.min}-${z.bands.z2Aerobic.max}, threshold ${z.bands.z3Threshold.min}-${z.bands.z3Threshold.max} s/100m.`
        : ` Rowing 2k split ~${z.splitSecPer500} s/500m; easy (UT2) ${z.bands.ut2.splitSecPer500.min}-${z.bands.ut2.splitSecPer500.max}, threshold (AT) ${z.bands.at.splitSecPer500.min}-${z.bands.at.splitSecPer500.max} s/500m.`;
```
and fold `zoneGuidance` into the existing `envelopeGuidance` string in place of the old run-only clause. Keep the phase/load/fuel parts unchanged. (Align the exact `.bands` paths with what Task 1 emits.)

- [ ] **Step 3: Verify app didn't break**

Run: `cd OSPREY-app && npx tsc --noEmit`
Expected: clean (edge fn excluded; this just confirms no app-side edit).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/index.ts
git commit -m "feat(edge): per-kind zone guidance (run/swim/rowing) in the prompt"
```

---

### Task 6: `validate.ts` — per-kind pace clamp

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/validate.ts`
- Test: `supabase/functions/ozzie-generate-plan/validate.test.ts`

**Interfaces:**
- Produces: `validateAndClamp` clamps swim (sec/100m) and rowing (sec/500m) sessions, in addition to run, keyed off `envelope.zones.kind`.

- [ ] **Step 1: Write the failing tests** (Deno) — add a swim and a rowing scenario:

```ts
const swimEnvelope = {
  hardSessionShareMax: 0.2,
  zones: { kind: 'swim', cssSecPer100: 100,
    z1EasyRecovery: { min: 108, max: null }, z2Aerobic: { min: 103, max: 106 },
    z3Threshold: { min: 98, max: 102 }, z4Vo2Max: { min: 95, max: 98 } },
  fuel: { dailyCarbG: { min: 350, max: 490 }, proteinG: { min: 112, max: 154 }, longSessionCarbGPerHour: 60 },
};

Deno.test('clamps a swim easy session implied too fast into the z2 band (sec/100m)', () => {
  // 2 km in 30 min => 900 s / 20 hundred-m => 45 s/100m, way faster than easy z2 (103-106).
  const day = { dayOffset: 0, session_type: 'swim', intensity: 'moderate', planned_minutes: 30, planned_distance_km: 2 };
  const { days } = validateAndClamp([day], swimEnvelope as never);
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 10); // s/100m
  assert(implied >= 103 && implied <= 106, `implied ${implied} not in z2 band`);
});

const rowEnvelope = {
  hardSessionShareMax: 0.2,
  zones: { kind: 'rowing', splitSecPer500: 120,
    ut2: { splitSecPer500: { min: 132, max: 136 } }, ut1: { splitSecPer500: { min: 126, max: 130 } },
    at: { splitSecPer500: { min: 123, max: 125 } }, tr: { splitSecPer500: { min: 120, max: 122 } } },
  fuel: { dailyCarbG: { min: 350, max: 490 }, proteinG: { min: 112, max: 154 }, longSessionCarbGPerHour: 60 },
};

Deno.test('clamps a rowing easy session into the UT2 split band (sec/500m)', () => {
  // 8 km in 30 min => 1800 s / 16 five-hundred-m => 112.5 s/500m, faster than UT2 (132-136).
  const day = { dayOffset: 0, session_type: 'rowing', intensity: 'easy', planned_minutes: 30, planned_distance_km: 8 };
  const { days } = validateAndClamp([day], rowEnvelope as never);
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 2); // s/500m
  assert(implied >= 132 && implied <= 137, `implied ${implied} not in UT2 band`);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd supabase/functions/ozzie-generate-plan && deno test validate.test.ts`
Expected: FAIL — current code only handles `envelope.runZones`/run.

- [ ] **Step 3: Implement** — generalize the clamp. Replace the `EnvelopeLike`, `bandFor`, the `KM_TO_MI`/pace step, and the run-only gate with per-kind logic:

```ts
type Band = { min: number; max: number };
type Zones =
  | { kind: 'run'; thresholdSecPerMile: number; bands: { easy: Band; marathonPace: Band; tenKPace: Band; fiveKPace: Band } }
  | { kind: 'swim'; cssSecPer100: number; bands: { z1EasyRecovery: Band; z2Aerobic: Band; z3Threshold: Band; z4Vo2Max: Band } }
  | { kind: 'rowing'; splitSecPer500: number; bands: { ut2: { splitSecPer500: Band }; ut1: { splitSecPer500: Band }; at: { splitSecPer500: Band }; tr: { splitSecPer500: Band } } };
interface EnvelopeLike { hardSessionShareMax: number; zones: Zones | null; fuel: unknown; }

const KM_TO_MI = 0.621371;
const HARD = new Set(['interval', 'threshold']);

// Session type each zone kind clamps, and the pace unit divisor from km.
const KIND_TYPE = { run: 'run', swim: 'swim', rowing: 'rowing' } as const;
const KIND_UNIT_PER_KM = { run: KM_TO_MI, swim: 10, rowing: 2 } as const; // sec/mi, sec/100m, sec/500m

function bandFor(intensity: string, z: Zones): Band | null {
  if (z.kind === 'run') {
    if (intensity === 'easy') return z.bands.easy;
    if (intensity === 'moderate') return z.bands.marathonPace;
    if (intensity === 'threshold') return z.bands.tenKPace;
    if (intensity === 'interval') return z.bands.fiveKPace;
  } else if (z.kind === 'swim') {
    if (intensity === 'easy') return z.bands.z2Aerobic;   // easy swims sit in aerobic
    if (intensity === 'moderate') return z.bands.z2Aerobic;
    if (intensity === 'threshold') return z.bands.z3Threshold;
    if (intensity === 'interval') return z.bands.z4Vo2Max;
  } else {
    if (intensity === 'easy') return z.bands.ut2.splitSecPer500;
    if (intensity === 'moderate') return z.bands.ut1.splitSecPer500;
    if (intensity === 'threshold') return z.bands.at.splitSecPer500;
    if (intensity === 'interval') return z.bands.tr.splitSecPer500;
  }
  return null;
}
```
Then in `validateAndClamp`, after the polarization pass, replace the run-only pace-clamp `out = out.map(...)` with:
```ts
  const z = envelope.zones;
  if (z) {
    const clampType = KIND_TYPE[z.kind];
    const perKm = KIND_UNIT_PER_KM[z.kind];
    out = out.map((d) => {
      if (d.session_type === clampType && d.planned_minutes && d.planned_distance_km) {
        const band = bandFor(d.intensity, z);
        if (band) {
          const implied = (d.planned_minutes * 60) / (d.planned_distance_km * perKm);
          const target = Math.min(band.max, Math.max(band.min, implied));
          if (target !== implied) {
            const newKm = (d.planned_minutes * 60) / (target * perKm);
            const roundedKm = target === band.min ? Math.floor(newKm * 10) / 10 : Math.ceil(newKm * 10) / 10;
            changed.push(`day${d.dayOffset}: pace ${Math.round(implied)}→${Math.round(target)} (${z.kind})`);
            return { ...d, planned_distance_km: roundedKm };
          }
        }
      }
      return d;
    });
  }
```
(The polarization pass and the fuel-attach pass stay as-is. The demote-to-easy prose fix from Phase 1.1 is unchanged.)

- [ ] **Step 4: Run and watch it pass**

Run: `cd supabase/functions/ozzie-generate-plan && deno test validate.test.ts`
Expected: PASS (all prior run tests + the 2 new swim/rowing tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/validate.ts supabase/functions/ozzie-generate-plan/validate.test.ts
git commit -m "feat(edge): per-kind pace clamp for swim (sec/100m) and rowing (sec/500m)"
```

---

### Task 7: Edge-fn — pass `zones` into the clamp

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts`

**Interfaces:**
- Consumes: `validateAndClamp` (Task 6, now reads `envelope.zones`).

- [ ] **Step 1: Confirm the clamp call passes the whole envelope** — the existing call is `validateAndClamp(days as never, envelope as never)`. Since `validateAndClamp` now reads `envelope.zones` (Task 6) instead of `envelope.runZones`, and `envelope` is `body.envelope` (which now carries `zones` from the app), no call-site change is needed — but verify the `Envelope` type's `zones` field (Task 5) is what's passed. If any residual `runZones` reference remains in index.ts (e.g. the persist block), remove it.

- [ ] **Step 2: Grep for stragglers**

Run: `grep -n "runZones" supabase/functions/ozzie-generate-plan/index.ts`
Expected: no matches (all replaced by `zones`). If any remain, update them.

- [ ] **Step 3: Verify + commit**

Run: `cd supabase/functions/ozzie-generate-plan && deno test validate.test.ts` (5+2 pass) and `cd ../../../OSPREY-app && npx tsc --noEmit` (clean).
```bash
git add supabase/functions/ozzie-generate-plan/index.ts
git commit -m "chore(edge): drop residual runZones references; clamp reads envelope.zones"
```

---

## Self-Review

- **Spec coverage (2a slice):** ZoneSet generalization → Task 1. Sport-key map incl. hyrox → Task 1. Swim zones → Task 2. Rowing zones + data-derivation → Tasks 3–4. Per-kind pace-clamp → Task 6. Edge-fn prompt + wiring → Tasks 5, 7. Deferred (2b/2c, correctly absent): onboarding Baseline input, HR-fallback zones, cycling (power), triathlon (composite), fuel-per-day-type.
- **Placeholder scan:** none — each code step has runnable code + a command. The one soft spot is the edge-fn `Envelope`/`Zones` `.bands` path (Task 5 note) — the implementer must align it with the exact shape Task 1 emits (`zones.bands.*`); flagged explicitly, not left vague.
- **Type consistency:** `ZoneSet` discriminants (`run`/`swim`/`rowing`) and `bands` shapes match `RunningPaceZones`/`SwimPaceZones`/`RowingTrainingZones` (`easy/marathonPace/tenKPace/fiveKPace`, `z1EasyRecovery/z2Aerobic/z3Threshold/z4Vo2Max`, `ut2/ut1/at/tr`); `CoachingEnvelope.zones`, `EnvelopeInput.rowingSplitSecPer500`, `selectBestRowingSplit`, `estimateSwimCssByTier`, `estimateRowingSplitByTier`, `blueprintSport` are used consistently across tasks.

## Known 2a simplifications (documented, not placeholders)
- Swim anchor is a tier estimate; the real 400+200 TT input + HR fallback are Phase 2b.
- Rowing split approximates the 2k anchor from the best recent ≥1000m effort (not a normalized 2k prediction) — refine in a later phase.
- `bandFor` maps swim `easy`→z2 aerobic (there is no distinct z1-labeled plan intensity); revisit if the plan schema gains a recovery intensity.
