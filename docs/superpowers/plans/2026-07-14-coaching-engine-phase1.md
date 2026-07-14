# Coaching-Engine Fidelity — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every generated plan gets real periodization (Base/Build/Peak/Taper, 3:1 loading, ≤10%/wk, taper cuts), periodized fuel, and — for running — calculator-derived pace zones, with the LLM's numbers validated and clamped server-side to those bounds.

**Architecture:** Architecture ① from the spec. The app computes a `CoachingEnvelope` from the existing tested calculators and passes it to `ozzie-generate-plan`; the edge function prompts the LLM with it and clamps the output before the DB write. Backward-compatible: no `envelope` in the request → today's prompt-only path.

**Tech Stack:** React Native / Expo (app, Jest), Deno (edge function, `deno test`), Supabase Postgres.

## Global Constraints

- Coaching logic is authoritative in `docs/coaching/` — do not invent formulas; reuse `src/services/calculators/*` (all formulas already match the docs).
- All new pure logic is **TDD** (test first, watch it fail, minimal impl). Jest is pinned `TZ=Asia/Kolkata` (`package.json`).
- Path alias `@/` → `OSPREY-app/src/` (jest `moduleNameMapper`).
- Migrations are applied via **MCP `apply_migration`**, NOT `supabase db push` (repo↔live history drift — see `docs/DEPLOY-CHECKLIST.md` appendix). Project id: `jslbutpmgoushkzcghtg`.
- Lint rule `no-restricted-syntax` bans `x.toISOString().slice()` — use `@/utils/date` helpers.
- Keep the existing idempotency / one-active-plan logic in the edge function intact.
- Run app checks from `OSPREY-app/`: `npx jest`, `npx tsc --noEmit`, `npx eslint src --ext .ts,.tsx`.

---

### Task 1: Guarantee real taper weeks in `computeRacePhase`

**Files:**
- Modify: `OSPREY-app/src/services/plan.ts:45-68` (`computeRacePhase`)
- Test: `OSPREY-app/src/services/__tests__/plan.test.ts` (exists)

**Interfaces:**
- Produces: `computeRacePhase(goal, now?)` unchanged signature; taper now spans a scaled final block (1/2/3 weeks by plan length) instead of a fixed 10%.

- [ ] **Step 1: Write the failing test** — append to `plan.test.ts`:

```ts
describe('computeRacePhase taper window', () => {
  const now = new Date(2026, 0, 5, 12, 0, 0); // Mon 2026-01-05

  it('gives a 16-week plan 3 taper weeks (final 3), not ~1.6', () => {
    // race 3 weeks out in a 16-week plan → Taper
    const goal = { targetDate: '2026-01-26', totalWeeksPlanned: 16 } as Parameters<typeof computeRacePhase>[0];
    expect(computeRacePhase(goal, now)?.phase).toBe('Taper');
  });

  it('keeps week 4-of-16-out in Peak/Build, not Taper', () => {
    const goal = { targetDate: '2026-02-02', totalWeeksPlanned: 16 } as Parameters<typeof computeRacePhase>[0];
    expect(computeRacePhase(goal, now)?.phase).not.toBe('Taper');
  });

  it('scales taper to 1 week for a short 5-week plan', () => {
    const goal2wk = { targetDate: '2026-01-19', totalWeeksPlanned: 5 } as Parameters<typeof computeRacePhase>[0];
    expect(computeRacePhase(goal2wk, now)?.phase).not.toBe('Taper'); // 2 weeks out, taper=1 → still Build/Peak
    const goal1wk = { targetDate: '2026-01-12', totalWeeksPlanned: 5 } as Parameters<typeof computeRacePhase>[0];
    expect(computeRacePhase(goal1wk, now)?.phase).toBe('Taper'); // 1 week out → Taper
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/__tests__/plan.test.ts -t "taper window"`
Expected: FAIL (16-week/3-out currently computes progress 14/16=0.875 → Peak, not Taper).

- [ ] **Step 3: Implement** — replace the phase-selection block in `computeRacePhase`:

```ts
  const progress = currentWeekNumber / totalWeeks;

  // Taper is the blueprint's final block (docs/coaching/_index.md:19), scaled to
  // plan length: ~3 weeks for a full build, fewer for short plans. Drive it by
  // weeksRemaining so it's always the true final N weeks, not a fixed % that
  // under-tapers long plans (audit-reports/2026-07-10-audit.md:44).
  const taperWeeks = totalWeeks <= 6 ? 1 : totalWeeks <= 10 ? 2 : 3;

  let phase: RacePhaseName;
  if (weeksRemaining <= taperWeeks) phase = 'Taper';
  else if (progress <= 0.4) phase = 'Base';
  else if (progress <= 0.75) phase = 'Build';
  else phase = 'Peak';

  return { weeksRemaining, currentWeekNumber, totalWeeks, phase };
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd OSPREY-app && npx jest src/services/__tests__/plan.test.ts`
Expected: PASS (all, including the earlier computeRacePhase tests).

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/plan.ts OSPREY-app/src/services/__tests__/plan.test.ts
git commit -m "fix(coaching): scale taper to the true final weeks in computeRacePhase"
```

---

### Task 2: Periodization module (3:1 loading + target weekly load)

**Files:**
- Create: `OSPREY-app/src/services/coaching/periodization.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/periodization.test.ts`

**Interfaces:**
- Consumes: `applyVolumeCut`, `maxWeeklyProgression` from `@/services/calculators/shared`.
- Produces:
  - `type Phase = 'Base' | 'Build' | 'Peak' | 'Taper'`
  - `loadingWeek(weekNumber: number): 1 | 2 | 3 | 4` — 3:1 position (weeks 1–3 build, 4 recovery, repeating).
  - `targetWeeklyLoad(input: { baselineLoad: number; phase: Phase; weekNumber: number; prevWeekLoad: number | null }): number`

- [ ] **Step 1: Write the failing test**

```ts
import { loadingWeek, targetWeeklyLoad } from '@/services/coaching/periodization';

describe('loadingWeek (3:1)', () => {
  it('cycles build/build/build/recovery', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(loadingWeek)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });
});

describe('targetWeeklyLoad', () => {
  const base = 100;

  it('caps week-over-week growth at 10%', () => {
    const load = targetWeeklyLoad({ baselineLoad: base, phase: 'Build', weekNumber: 2, prevWeekLoad: 100 });
    expect(load).toBeLessThanOrEqual(110);
  });

  it('cuts a recovery week (loadingWeek 4) below the build weeks', () => {
    const build = targetWeeklyLoad({ baselineLoad: base, phase: 'Build', weekNumber: 3, prevWeekLoad: 100 });
    const recovery = targetWeeklyLoad({ baselineLoad: base, phase: 'Build', weekNumber: 4, prevWeekLoad: build });
    expect(recovery).toBeLessThan(build);
  });

  it('tapers hard in Taper phase', () => {
    const peak = targetWeeklyLoad({ baselineLoad: base, phase: 'Peak', weekNumber: 10, prevWeekLoad: 120 });
    const taper = targetWeeklyLoad({ baselineLoad: base, phase: 'Taper', weekNumber: 11, prevWeekLoad: peak });
    expect(taper).toBeLessThan(peak * 0.8);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/periodization.test.ts`
Expected: FAIL — "Cannot find module '@/services/coaching/periodization'".

- [ ] **Step 3: Implement**

```ts
// OSPREY-app/src/services/coaching/periodization.ts
import { applyVolumeCut, maxWeeklyProgression } from '@/services/calculators/shared';

export type Phase = 'Base' | 'Build' | 'Peak' | 'Taper';

/** Position in the repeating 3:1 loading cycle (docs/coaching/_index.md:18). */
export function loadingWeek(weekNumber: number): 1 | 2 | 3 | 4 {
  return (((weekNumber - 1) % 4) + 1) as 1 | 2 | 3 | 4;
}

/** Relative volume multiplier by macrocycle phase. */
const PHASE_FACTOR: Record<Phase, number> = { Base: 0.85, Build: 1.0, Peak: 1.1, Taper: 0.55 };

export function targetWeeklyLoad(input: {
  baselineLoad: number;
  phase: Phase;
  weekNumber: number;
  prevWeekLoad: number | null;
}): number {
  const { baselineLoad, phase, weekNumber, prevWeekLoad } = input;

  if (phase === 'Taper') {
    // Cut volume, keep intensity (handled by zones). 45% off the prior week.
    return applyVolumeCut(prevWeekLoad ?? baselineLoad, 0.45);
  }

  let target = baselineLoad * PHASE_FACTOR[phase];
  if (loadingWeek(weekNumber) === 4) target = applyVolumeCut(target, 0.3); // recovery week

  // Never grow more than 10%/week vs the prior week (3:1 progression cap).
  if (prevWeekLoad != null) target = Math.min(target, maxWeeklyProgression(prevWeekLoad, 0.1));
  return Math.round(target);
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/periodization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/periodization.ts OSPREY-app/src/services/coaching/__tests__/periodization.test.ts
git commit -m "feat(coaching): periodization module — 3:1 loading + target weekly load"
```

---

### Task 3: Running threshold anchor resolution

**Files:**
- Create: `OSPREY-app/src/services/coaching/anchor.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/anchor.test.ts`

**Interfaces:**
- Consumes: `riegelPredict` from `@/services/performance`.
- Produces:
  - `interface RunningAnchor { thresholdSecPerMile: number; source: 'derived' | 'estimate' }`
  - `resolveRunningAnchor(input: { bestRunMiles: number | null; bestRunTimeS: number | null; fitnessLevel: string }): RunningAnchor`

- [ ] **Step 1: Write the failing test**

```ts
import { resolveRunningAnchor } from '@/services/coaching/anchor';

describe('resolveRunningAnchor', () => {
  it('derives threshold pace from a logged effort (a 20:00 5K → sane T pace)', () => {
    // 5K = 3.107 mi in 1200s → ~6:26/mi race pace; threshold (~1hr pace) is slower.
    const a = resolveRunningAnchor({ bestRunMiles: 3.107, bestRunTimeS: 1200, fitnessLevel: 'intermediate' });
    expect(a.source).toBe('derived');
    // Threshold pace must be slower (bigger sec/mile) than 5K race pace (~386 s/mi) and realistic (< 12 min/mi).
    expect(a.thresholdSecPerMile).toBeGreaterThan(386);
    expect(a.thresholdSecPerMile).toBeLessThan(720);
  });

  it('falls back to an experience-tier estimate with no logged data', () => {
    const a = resolveRunningAnchor({ bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'beginner' });
    expect(a.source).toBe('estimate');
    expect(a.thresholdSecPerMile).toBeGreaterThan(0);
  });

  it('estimates a faster threshold for advanced than beginner', () => {
    const adv = resolveRunningAnchor({ bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'advanced' });
    const beg = resolveRunningAnchor({ bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'beginner' });
    expect(adv.thresholdSecPerMile).toBeLessThan(beg.thresholdSecPerMile);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/anchor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// OSPREY-app/src/services/coaching/anchor.ts
import { riegelPredict } from '@/services/performance';

export interface RunningAnchor {
  thresholdSecPerMile: number;
  source: 'derived' | 'estimate';
}

// Threshold (Daniels T) ≈ pace you could race for ~1 hour (docs/coaching/running.md).
const ONE_HOUR_S = 3600;

// Coarse cold-start estimates (sec/mile) when there is no logged effort yet.
const TIER_ESTIMATE_SEC_PER_MILE: Record<string, number> = {
  advanced: 360, // 6:00/mi
  intermediate: 450, // 7:30/mi
  beginner: 570, // 9:30/mi
};

export function resolveRunningAnchor(input: {
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  fitnessLevel: string;
}): RunningAnchor {
  const { bestRunMiles, bestRunTimeS, fitnessLevel } = input;

  if (bestRunMiles != null && bestRunTimeS != null && bestRunMiles >= 1 && bestRunTimeS > 0) {
    // Find the distance this athlete would cover in ~1 hour at Riegel-scaled effort,
    // then threshold pace = that 1-hour pace.
    let miles = bestRunMiles;
    for (let i = 0; i < 40; i++) {
      const t = riegelPredict(bestRunMiles, bestRunTimeS, miles);
      if (Math.abs(t - ONE_HOUR_S) < 5) break;
      miles *= ONE_HOUR_S / t;
    }
    return { thresholdSecPerMile: Math.round(ONE_HOUR_S / miles), source: 'derived' };
  }

  const estimate = TIER_ESTIMATE_SEC_PER_MILE[fitnessLevel] ?? TIER_ESTIMATE_SEC_PER_MILE.beginner;
  return { thresholdSecPerMile: estimate, source: 'estimate' };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/anchor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/anchor.ts OSPREY-app/src/services/coaching/__tests__/anchor.test.ts
git commit -m "feat(coaching): running threshold anchor (Riegel-derived + tier estimate)"
```

---

### Task 4: Running fuel targets

**Files:**
- Create: `OSPREY-app/src/services/coaching/fuel.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/fuel.test.ts`

**Interfaces:**
- Consumes: `runningDailyCarbGrams`, `runningRaceFuelGPerHour` from `@/services/calculators/running`; `Range` from `@/services/calculators/types`.
- Produces:
  - `interface FuelTargets { dailyCarbG: Range; proteinG: Range; longSessionCarbGPerHour: number }`
  - `computeRunningFuel(input: { bodyWeightKg: number; hardWeek: boolean }): FuelTargets`

- [ ] **Step 1: Write the failing test**

```ts
import { computeRunningFuel } from '@/services/coaching/fuel';

describe('computeRunningFuel', () => {
  it('scales daily carbs and protein with bodyweight', () => {
    const f = computeRunningFuel({ bodyWeightKg: 70, hardWeek: true });
    expect(f.dailyCarbG.min).toBeGreaterThan(0);
    expect(f.proteinG.min).toBeCloseTo(70 * 1.6, 0);
    expect(f.proteinG.max).toBeCloseTo(70 * 2.2, 0);
  });

  it('prescribes in-session carbs for long runs', () => {
    const f = computeRunningFuel({ bodyWeightKg: 70, hardWeek: true });
    expect(f.longSessionCarbGPerHour).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/fuel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// OSPREY-app/src/services/coaching/fuel.ts
import { runningDailyCarbGrams, runningRaceFuelGPerHour } from '@/services/calculators/running';
import { midpoint, Range } from '@/services/calculators/types';

export interface FuelTargets {
  dailyCarbG: Range;
  proteinG: Range;
  longSessionCarbGPerHour: number;
}

export function computeRunningFuel(input: { bodyWeightKg: number; hardWeek: boolean }): FuelTargets {
  const { bodyWeightKg, hardWeek } = input;
  const carbRange = runningRaceFuelGPerHour('marathon'); // 60–90 g/hr for long efforts
  return {
    dailyCarbG: runningDailyCarbGrams(hardWeek ? 'high' : 'moderate', bodyWeightKg),
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.2) },
    longSessionCarbGPerHour: Math.round(midpoint(carbRange) ?? 60),
  };
}
```

> Note: confirm `runningRaceFuelGPerHour('marathon')` returns a `Range` (it does per `running.ts:55`). If its arg enum differs, adjust the literal.

- [ ] **Step 4: Run and watch it pass**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/fuel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/fuel.ts OSPREY-app/src/services/coaching/__tests__/fuel.test.ts
git commit -m "feat(coaching): running fuel targets (daily carbs, protein, in-session)"
```

---

### Task 5: `CoachingEnvelope` type + `computeEnvelope`

**Files:**
- Create: `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts`

**Interfaces:**
- Consumes: `Phase`, `loadingWeek`, `targetWeeklyLoad` (Task 2); `resolveRunningAnchor` (Task 3); `computeRunningFuel`, `FuelTargets` (Task 4); `runningPaceZones`, `RunningPaceZones` from `@/services/calculators/running`.
- Produces:
  - `interface CoachingEnvelope { sport: string; phase: Phase; weekNumber: number; totalWeeks: number; targetWeeklyLoad: number; hardSessionShareMax: number; runZones: RunningPaceZones | null; fuel: FuelTargets }`
  - `computeEnvelope(input: EnvelopeInput): CoachingEnvelope` where
    `EnvelopeInput = { sport: string; phase: Phase; weekNumber: number; totalWeeks: number; baselineLoad: number; prevWeekLoad: number | null; bestRunMiles: number | null; bestRunTimeS: number | null; fitnessLevel: string; bodyWeightKg: number }`

- [ ] **Step 1: Write the failing test**

```ts
import { computeEnvelope } from '@/services/coaching/envelope';

const baseInput = {
  sport: 'run', phase: 'Build' as const, weekNumber: 5, totalWeeks: 16,
  baselineLoad: 300, prevWeekLoad: 300, bestRunMiles: 3.107, bestRunTimeS: 1200,
  fitnessLevel: 'intermediate', bodyWeightKg: 70,
};

describe('computeEnvelope', () => {
  it('produces run zones from the derived anchor for a running plan', () => {
    const env = computeEnvelope(baseInput);
    expect(env.runZones).not.toBeNull();
    expect(env.runZones!.easy.min).toBeGreaterThan(env.runZones!.thresholdSecPerMile); // easy is slower
  });

  it('carries a phase-appropriate target load and fuel', () => {
    const env = computeEnvelope(baseInput);
    expect(env.targetWeeklyLoad).toBeGreaterThan(0);
    expect(env.fuel.proteinG.min).toBeGreaterThan(0);
    expect(env.hardSessionShareMax).toBeCloseTo(0.2, 1);
  });

  it('omits run zones for a non-running sport', () => {
    expect(computeEnvelope({ ...baseInput, sport: 'cycling' }).runZones).toBeNull();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/envelope.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// OSPREY-app/src/services/coaching/envelope.ts
import { runningPaceZones, RunningPaceZones } from '@/services/calculators/running';
import { Phase, loadingWeek, targetWeeklyLoad } from './periodization';
import { resolveRunningAnchor } from './anchor';
import { computeRunningFuel, FuelTargets } from './fuel';

export interface CoachingEnvelope {
  sport: string;
  phase: Phase;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number; // polarization cap (docs/coaching/_index.md:16)
  runZones: RunningPaceZones | null;
  fuel: FuelTargets;
}

export interface EnvelopeInput {
  sport: string;
  phase: Phase;
  weekNumber: number;
  totalWeeks: number;
  baselineLoad: number;
  prevWeekLoad: number | null;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  fitnessLevel: string;
  bodyWeightKg: number;
}

export function computeEnvelope(input: EnvelopeInput): CoachingEnvelope {
  const load = targetWeeklyLoad({
    baselineLoad: input.baselineLoad,
    phase: input.phase,
    weekNumber: input.weekNumber,
    prevWeekLoad: input.prevWeekLoad,
  });

  const isRun = input.sport === 'run' || input.sport === 'hybrid';
  const runZones = isRun
    ? runningPaceZones(
        resolveRunningAnchor({
          bestRunMiles: input.bestRunMiles,
          bestRunTimeS: input.bestRunTimeS,
          fitnessLevel: input.fitnessLevel,
        }).thresholdSecPerMile,
      )
    : null;

  const hardWeek = loadingWeek(input.weekNumber) !== 4 && input.phase !== 'Taper';

  return {
    sport: input.sport,
    phase: input.phase,
    weekNumber: input.weekNumber,
    totalWeeks: input.totalWeeks,
    targetWeeklyLoad: load,
    hardSessionShareMax: 0.2,
    runZones,
    fuel: computeRunningFuel({ bodyWeightKg: input.bodyWeightKg, hardWeek }),
  };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd OSPREY-app && npx jest src/services/coaching && npx tsc --noEmit`
Expected: PASS + typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "feat(coaching): CoachingEnvelope + computeEnvelope (running zones + periodization + fuel)"
```

---

### Task 6: Migrations — anchor storage + session fuel

**Files:**
- Create: `supabase/migrations/20260714000002_coaching_envelope_columns.sql`

**Interfaces:**
- Produces: `user_goals.threshold_anchor JSONB`, `training_sessions.fuel JSONB` (both nullable).

- [ ] **Step 1: Write the migration file**

```sql
-- Phase 1 coaching-engine fidelity: store the athlete's derived/entered threshold
-- anchor, and per-session fuel targets emitted by the envelope.
ALTER TABLE user_goals        ADD COLUMN IF NOT EXISTS threshold_anchor JSONB;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS fuel JSONB;
```

- [ ] **Step 2: Apply via MCP (not `db push`)**

Use the Supabase MCP `apply_migration` tool: `project_id: jslbutpmgoushkzcghtg`, `name: coaching_envelope_columns`, `query:` the SQL above.

- [ ] **Step 3: Verify**

Use MCP `execute_sql` on `jslbutpmgoushkzcghtg`:
```sql
SELECT column_name FROM information_schema.columns
WHERE (table_name='user_goals' AND column_name='threshold_anchor')
   OR (table_name='training_sessions' AND column_name='fuel');
```
Expected: 2 rows.

- [ ] **Step 4: Commit** (the migration file only — it's already applied on remote)

```bash
git add supabase/migrations/20260714000002_coaching_envelope_columns.sql
git commit -m "feat(db): threshold_anchor + session fuel columns (applied via MCP)"
```

---

### Task 7: Client envelope builder + wire the 4 invoke sites

**Files:**
- Create: `OSPREY-app/src/services/coaching/build-envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts`
- Modify: `OSPREY-app/src/services/daily-summary.ts:371`, `OSPREY-app/src/services/onboarding.ts:35`, `OSPREY-app/app/race-event.tsx:148`, `OSPREY-app/app/preferences.tsx:157`

**Interfaces:**
- Consumes: `computeEnvelope` (Task 5); `computeRacePhase` (`@/services/plan`); `supabase`.
- Produces: `invokeGeneratePlan(extraBody?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>` — fetches the athlete's inputs, computes the envelope, and invokes `ozzie-generate-plan` with `{ ...extraBody, envelope }`.

- [ ] **Step 1: Write the failing test** (pure envelope-assembly branch — mock supabase):

```ts
jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { envelopeFromInputs } from '@/services/coaching/build-envelope';

describe('envelopeFromInputs', () => {
  it('defaults a no-history athlete to a Base maintenance envelope', () => {
    const env = envelopeFromInputs({
      sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
      baselineLoad: 0, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
    });
    expect(env.phase).toBe('Base');
    expect(env.runZones).not.toBeNull(); // estimate anchor still yields zones
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/build-envelope.test.ts`
Expected: FAIL — `envelopeFromInputs` not found.

- [ ] **Step 3: Implement** — the pure assembler + the async fetcher/invoker:

```ts
// OSPREY-app/src/services/coaching/build-envelope.ts
import { supabase } from '@/services/supabase';
import { computeRacePhase } from '@/services/plan';
import { computeEnvelope, CoachingEnvelope } from './envelope';

interface EnvelopeInputs {
  sport: string;
  race: { targetDate: string; totalWeeksPlanned: number } | null;
  fitnessLevel: string;
  bodyWeightKg: number;
  baselineLoad: number;
  prevWeekLoad: number | null;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
}

// Pure: inputs → envelope. No-race plans run a Base maintenance macrocycle.
export function envelopeFromInputs(i: EnvelopeInputs): CoachingEnvelope {
  const phaseInfo = i.race
    ? computeRacePhase({ targetDate: i.race.targetDate, totalWeeksPlanned: i.race.totalWeeksPlanned } as never)
    : null;
  return computeEnvelope({
    sport: i.sport,
    phase: phaseInfo?.phase ?? 'Base',
    weekNumber: phaseInfo?.currentWeekNumber ?? 1,
    totalWeeks: phaseInfo?.totalWeeks ?? 8,
    baselineLoad: i.baselineLoad || 200,
    prevWeekLoad: i.prevWeekLoad,
    bestRunMiles: i.bestRunMiles,
    bestRunTimeS: i.bestRunTimeS,
    fitnessLevel: i.fitnessLevel,
    bodyWeightKg: i.bodyWeightKg,
  });
}

// Async: gather the athlete's inputs, then invoke generation with the envelope.
export async function invokeGeneratePlan(extraBody: Record<string, unknown> = {}) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  let inputs: EnvelopeInputs = {
    sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
    baselineLoad: 200, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
  };

  if (userId) {
    const [goalsRes, weightRes, bestRes] = await Promise.all([
      supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned').eq('user_id', userId).maybeSingle(),
      supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).order('total_distance_km', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const g = goalsRes.data;
    inputs = {
      sport: g?.primary_goal ?? 'run',
      race: g?.target_date && g?.total_weeks_planned ? { targetDate: g.target_date, totalWeeksPlanned: g.total_weeks_planned } : null,
      fitnessLevel: g?.fitness_level ?? 'beginner',
      bodyWeightKg: weightRes.data?.weight_kg ?? 70,
      baselineLoad: 200,          // Phase 2 will thread real CTL; Base default for now
      prevWeekLoad: null,
      bestRunMiles: bestRes.data?.total_distance_km ? bestRes.data.total_distance_km * 0.621371 : null,
      bestRunTimeS: bestRes.data?.total_duration_s ?? null,
    };
  }

  const envelope = envelopeFromInputs(inputs);
  return supabase.functions.invoke('ozzie-generate-plan', {
    method: 'POST',
    body: { ...extraBody, envelope },
  });
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd OSPREY-app && npx jest src/services/coaching/__tests__/build-envelope.test.ts`
Expected: PASS.

- [ ] **Step 5: Route the 4 invoke sites through the wrapper.** Replace each raw `supabase.functions.invoke('ozzie-generate-plan', …)` with `invokeGeneratePlan(...)`, preserving each site's existing body:
  - `daily-summary.ts:371`: `await invokeGeneratePlan();`
  - `onboarding.ts:35`: `const { error } = await invokeGeneratePlan();`
  - `race-event.tsx:148`: `const { data, error } = await invokeGeneratePlan({ raceTarget: {...existing...}, force: true });` (keep the existing body fields it passed)
  - `preferences.tsx:157`: `const { data, error } = await invokeGeneratePlan({ preferences: {...existing...} });`
  Add `import { invokeGeneratePlan } from '@/services/coaching/build-envelope';` to each; remove now-unused direct `supabase.functions.invoke` where applicable.

- [ ] **Step 6: Verify + commit**

Run: `cd OSPREY-app && npx tsc --noEmit && npx jest && npx eslint src --ext .ts,.tsx`
Expected: typecheck clean, tests pass, 0 lint errors.
```bash
git add OSPREY-app/src/services/coaching/build-envelope.ts OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts OSPREY-app/src/services/daily-summary.ts OSPREY-app/src/services/onboarding.ts OSPREY-app/app/race-event.tsx OSPREY-app/app/preferences.tsx
git commit -m "feat(coaching): build + pass the CoachingEnvelope from all generate-plan call sites"
```

---

### Task 8: Edge function — accept the envelope and inject it into the prompt

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` (`generateWeekDays` sig + user message; body parse at :319-320 already exposes `body`).

**Interfaces:**
- Consumes: `body.envelope` (the `CoachingEnvelope` JSON from Task 5/7).
- Produces: `generateWeekDays(goals, trainingLoad, envelope?)` — envelope numbers added to the user message. Backward-compatible when `envelope` is undefined.

- [ ] **Step 1: Add an `Envelope` type near `GoalsContext`** (index.ts ~:54):

```ts
interface Envelope {
  sport: string;
  phase: string;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number;
  runZones: { thresholdSecPerMile: number; easy: { min: number; max: number }; marathonPace: { min: number; max: number }; tenKPace: { min: number; max: number }; fiveKPace: { min: number; max: number }; intervalPace: { min: number; max: number } } | null;
  fuel: { dailyCarbG: { min: number | null; max: number | null }; proteinG: { min: number; max: number }; longSessionCarbGPerHour: number };
}
```

- [ ] **Step 2: Thread the envelope into `generateWeekDays`** — change the signature and append to the user message:

```ts
async function generateWeekDays(goals: GoalsContext, trainingLoad: TrainingLoad, envelope?: Envelope) {
  const envelopeGuidance = envelope
    ? ` COACHING ENVELOPE (hard constraints — stay inside these): phase=${envelope.phase}, week ${envelope.weekNumber}/${envelope.totalWeeks}, target weekly load ≈ ${envelope.targetWeeklyLoad} TSS, at most ${Math.round(envelope.hardSessionShareMax * 100)}% of sessions hard.` +
      (envelope.runZones
        ? ` Run pace bands (sec/mile): easy ${envelope.runZones.easy.min}-${envelope.runZones.easy.max}, threshold ~${envelope.runZones.thresholdSecPerMile}, 10K ${envelope.runZones.tenKPace.min}-${envelope.runZones.tenKPace.max}, 5K/interval ${envelope.runZones.fiveKPace.min}-${envelope.runZones.fiveKPace.max}. Choose distances/durations so implied pace matches the band for each session's intensity.`
        : '') +
      ` Daily carbs ${envelope.fuel.dailyCarbG.min}-${envelope.fuel.dailyCarbG.max} g; long-session fuel ~${envelope.fuel.longSessionCarbGPerHour} g/hr.`
    : '';
```
Then append `${envelopeGuidance}` to the existing user `content` template string.

- [ ] **Step 3: Pass the envelope at the call site** (index.ts:585):

```ts
    const days = await generateWeekDays(goals, trainingLoad, (body.envelope as Envelope | undefined));
```

- [ ] **Step 4: Verify** — no app test covers the edge fn; syntax-check by eye and confirm the app still builds:

Run: `cd OSPREY-app && npx tsc --noEmit`
Expected: clean (edge fn is Deno, excluded from app tsc; this just confirms no app-side break).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/index.ts
git commit -m "feat(edge): accept CoachingEnvelope and prompt the LLM with it"
```

---

### Task 9: Edge function — the validate/clamp layer (Deno-tested)

**Files:**
- Create: `supabase/functions/ozzie-generate-plan/validate.ts`
- Test: `supabase/functions/ozzie-generate-plan/validate.test.ts`

**Interfaces:**
- Produces:
  - `type PlanDay = { dayOffset: number; session_type: string; intensity: string; planned_minutes: number | null; planned_distance_km: number | null; [k: string]: unknown }`
  - `validateAndClamp(days: PlanDay[], envelope: Envelope): { days: PlanDay[]; changed: string[] }`
- Clamp rules (Phase 1): (a) run sessions labeled `interval`/`threshold`/`easy` whose implied pace falls outside the matching band get `planned_distance_km` scaled to bring the implied pace to the nearest band edge; (b) if hard-labeled sessions exceed `hardSessionShareMax`, demote the excess to `easy`; (c) attach `fuel` to each non-rest session from the envelope.

- [ ] **Step 1: Install Deno** (edge-function runtime; not yet installed locally):

Run: `curl -fsSL https://deno.land/install.sh | sh` (or `brew install deno`), then confirm `deno --version`.

- [ ] **Step 2: Write the failing test**

```ts
// supabase/functions/ozzie-generate-plan/validate.test.ts
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateAndClamp } from './validate.ts';

const envelope = {
  sport: 'run', phase: 'Build', weekNumber: 5, totalWeeks: 16,
  targetWeeklyLoad: 300, hardSessionShareMax: 0.2,
  runZones: { thresholdSecPerMile: 450, easy: { min: 510, max: 570 }, marathonPace: { min: 465, max: 480 }, tenKPace: { min: 435, max: 445 }, fiveKPace: { min: 420, max: 430 }, intervalPace: { min: 430, max: 440 } },
  fuel: { dailyCarbG: { min: 350, max: 490 }, proteinG: { min: 112, max: 154 }, longSessionCarbGPerHour: 75 },
};

Deno.test('clamps an easy run that is implied too fast into the easy band', () => {
  // 10 km in 40 min => 240 s/km => ~386 s/mi, way faster than easy (510-570).
  const day = { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 10 };
  const { days, changed } = validateAndClamp([day], envelope as never);
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 0.621371); // s/mi
  assert(implied >= 510 && implied <= 571, `implied ${implied} not in easy band`);
  assert(changed.length > 0);
});

Deno.test('attaches fuel to non-rest sessions', () => {
  const day = { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 6 };
  const { days } = validateAndClamp([day], envelope as never);
  assertEquals((days[0] as Record<string, unknown>).fuel !== undefined, true);
});

Deno.test('demotes excess hard sessions to easy', () => {
  const hard = (o: number) => ({ dayOffset: o, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 8 });
  const { days } = validateAndClamp([hard(0), hard(1), hard(2), hard(3), hard(4)], envelope as never);
  const hardCount = days.filter((d) => d.intensity === 'interval' || d.intensity === 'threshold').length;
  assert(hardCount <= Math.ceil(5 * 0.2) + 0); // ≤ 1 of 5
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `cd supabase/functions/ozzie-generate-plan && deno test --allow-none validate.test.ts`
Expected: FAIL — cannot find `./validate.ts`.

- [ ] **Step 4: Implement**

```ts
// supabase/functions/ozzie-generate-plan/validate.ts
export type PlanDay = {
  dayOffset: number;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  [k: string]: unknown;
};

type Band = { min: number; max: number };
interface EnvelopeLike {
  hardSessionShareMax: number;
  runZones: { easy: Band; tenKPace: Band; fiveKPace: Band; intervalPace: Band; marathonPace: Band } | null;
  fuel: unknown;
}

const KM_TO_MI = 0.621371;
const HARD = new Set(['interval', 'threshold']);

function bandFor(intensity: string, z: NonNullable<EnvelopeLike['runZones']>): Band | null {
  if (intensity === 'easy') return z.easy;
  if (intensity === 'moderate') return z.marathonPace;
  if (intensity === 'threshold') return z.tenKPace;
  if (intensity === 'interval') return z.fiveKPace;
  return null;
}

export function validateAndClamp(days: PlanDay[], envelope: EnvelopeLike): { days: PlanDay[]; changed: string[] } {
  const changed: string[] = [];
  const z = envelope.runZones;

  // (a) clamp run pace into the band by scaling distance for the fixed duration.
  let out = days.map((d) => {
    if (z && d.session_type === 'run' && d.planned_minutes && d.planned_distance_km) {
      const band = bandFor(d.intensity, z);
      if (band) {
        const impliedSecPerMi = (d.planned_minutes * 60) / (d.planned_distance_km * KM_TO_MI);
        const target = Math.min(band.max, Math.max(band.min, impliedSecPerMi));
        if (target !== impliedSecPerMi) {
          const newKm = (d.planned_minutes * 60) / (target * KM_TO_MI);
          changed.push(`day${d.dayOffset}: pace ${Math.round(impliedSecPerMi)}→${Math.round(target)} s/mi`);
          return { ...d, planned_distance_km: Math.round(newKm * 10) / 10 };
        }
      }
    }
    return d;
  });

  // (b) polarization: demote excess hard sessions (keep the earliest ones).
  const maxHard = Math.ceil(out.length * envelope.hardSessionShareMax);
  let seen = 0;
  out = out.map((d) => {
    if (HARD.has(d.intensity)) {
      seen += 1;
      if (seen > maxHard) {
        changed.push(`day${d.dayOffset}: ${d.intensity}→easy (polarization)`);
        return { ...d, intensity: 'easy', interval_prescription: null };
      }
    }
    return d;
  });

  // (c) attach envelope fuel to every non-rest session.
  out = out.map((d) => (d.session_type === 'rest' ? d : { ...d, fuel: envelope.fuel }));

  return { days: out, changed };
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `cd supabase/functions/ozzie-generate-plan && deno test --allow-none validate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/validate.ts supabase/functions/ozzie-generate-plan/validate.test.ts
git commit -m "feat(edge): pure validate/clamp layer for coaching envelope (deno-tested)"
```

---

### Task 10: Edge function — apply the clamp and persist phase/target/fuel

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` — call `validateAndClamp`; set `training_weeks.week_number/focus/tss_target` from the envelope (currently hardcoded at :576-577); write `training_sessions.fuel`.

**Interfaces:**
- Consumes: `validateAndClamp` (Task 9), `Envelope` (Task 8).

- [ ] **Step 1: Import the validator** (top of index.ts):

```ts
import { validateAndClamp } from './validate.ts';
```

- [ ] **Step 2: Clamp the LLM output** — right after `const days = await generateWeekDays(...)` (:585):

```ts
    const envelope = body.envelope as Envelope | undefined;
    const clamped = envelope
      ? validateAndClamp(days as never, envelope as never)
      : { days, changed: [] as string[] };
    if (clamped.changed.length) console.log('envelope clamp', clamped.changed);
    const finalDays = clamped.days;
```
Use `finalDays` in place of `days` when building `sessionRows`.

- [ ] **Step 3: Persist phase + target on the week** — replace the hardcoded `week_number`/`focus` in the `training_weeks` insert (:576-577):

```ts
        week_number: (body.envelope as Envelope | undefined)?.weekNumber ?? 1,
        focus: (body.envelope as Envelope | undefined)?.phase ?? 'Base building',
        tss_target: (body.envelope as Envelope | undefined)?.targetWeeklyLoad ?? null,
```

- [ ] **Step 4: Write per-session fuel** — in the `sessionRows` map (:585-609), add `fuel: (d as { fuel?: unknown }).fuel ?? null,` to each inserted row (requires the `training_sessions.fuel` column from Task 6).

- [ ] **Step 5: Deploy + smoke-test**

- Deploy: `supabase functions deploy ozzie-generate-plan --project-ref jslbutpmgoushkzcghtg`
- Smoke: from the app (or a manual invoke with a run envelope), generate a plan and confirm via MCP `execute_sql`:
```sql
SELECT tw.week_number, tw.focus, tw.tss_target,
       ts.session_type, ts.intensity, ts.planned_distance_km, ts.fuel
FROM training_weeks tw JOIN training_sessions ts ON ts.week_id = tw.id
WHERE tw.plan_id = (SELECT id FROM training_plans WHERE user_id = '<test-user>' AND status='active' ORDER BY created_at DESC LIMIT 1)
ORDER BY ts.session_date;
```
Expected: `focus` = a phase name, `tss_target` non-null, run sessions carry `fuel`, and easy-run implied pace sits in the easy band.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/index.ts
git commit -m "feat(edge): clamp plan to envelope + persist phase/target/fuel"
```

---

## Self-Review

- **Spec coverage:** §3 architecture → Tasks 5,7,8,9,10. §4 envelope → Task 5. §5 anchor (running, derived+estimate; storage) → Tasks 3,6. §6 periodization/taper → Tasks 1,2. §7 fuel → Tasks 4,10. §8 clamp → Task 9. §9 data model/API → Tasks 6,8. §10 testing → every task (Jest) + Task 9 (Deno). §11 Phase 1 boundary respected: **running zones only**; cycling/swim/rowing/tri/PL/hyrox/crossfit/ultra zones + the onboarding Baseline step + real CTL baseline are **Phase 2/3** (explicitly deferred — `baselineLoad` uses a Base default here). ✓
- **Placeholder scan:** none — every code step has runnable code and an exact command.
- **Type consistency:** `CoachingEnvelope`/`Envelope` fields (`phase`, `weekNumber`, `totalWeeks`, `targetWeeklyLoad`, `hardSessionShareMax`, `runZones`, `fuel`) match across Tasks 5/7/8/9/10; `RunningPaceZones` band names (`easy`, `marathonPace`, `tenKPace`, `fiveKPace`, `intervalPace`, `thresholdSecPerMile`) match `running.ts`; `resolveRunningAnchor`/`computeRunningFuel`/`targetWeeklyLoad`/`loadingWeek` signatures consistent with their definitions.

## Known Phase-1 simplifications (documented, not placeholders)
- `baselineLoad` defaults to a constant; real CTL threading is Phase 2 (noted in Task 7).
- Clamp validates run pace only; cycling/swim/etc. bands arrive with their zones in Phase 2/3.
- `body.envelope` typing in the edge fn uses light casts (Deno + untyped JSON body) — acceptable at the trust boundary; the app is the typed source.
