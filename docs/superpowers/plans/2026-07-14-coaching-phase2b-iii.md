# Coaching-Engine Phase 2b-iii — HR-Fallback Zones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a universal, prompt-only HR zone system to the coaching envelope so cross-training cardio (pace-sport athletes) and primary cardio (weight_loss / general_fitness, who get no zones today) are structured by heart rate.

**Architecture:** A NEW `hrZones` field on `CoachingEnvelope`, coexisting with `zones` (not a `ZoneSet` variant). `computeEnvelope` populates it universally from a resolved max HR (observed, sanity-bounded, else a conservative default); `build-envelope` supplies the observed max. The edge fn mirrors the field and appends HR guidance to the prompt. **`validate.ts` is untouched** — `hrZones` is prompt-only and never a `zones.kind`, so the pace-clamp can't see it.

**Tech Stack:** TypeScript, Jest (`TZ=Asia/Kolkata jest`), Deno edge functions (`deno test`, std assert 0.224.0). Reuses the tested `ultraHRZones` calculator.

## Global Constraints

- **TDD throughout.** App: `npm test` from `OSPREY-app/`. Edge fn: `deno test <file>`.
- **`computeEnvelope`'s existing `zones`/`fuel`/etc. output must be byte-identical** — `hrZones` is purely additive. Regression tests assert `env.zones` specifically, not the whole envelope.
- **`validate.ts` MUST NOT change.** Its Deno suite must stay green and untouched — that is the proof HR guidance can't perturb clamping.
- **No migration.** Reads the existing `workout_logs.max_heart_rate`.
- **App + edge-fn deploy together** (new envelope field + prompt) — joins the 2a/2b-i go-live redeploy coupling. Backward-compatible: an old app build simply sends no `hrZones`, and the edge fn treats it as absent.
- **Max-HR resolution:** accept observed only if `120 ≤ v ≤ 220`; else `DEFAULT_MAX_HR = 190`, flagged `source: 'estimated'`.
- **Path alias** `@/` → `OSPREY-app/src`. Deno assert: `import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';`. Lint `no-restricted-syntax` clean.

---

## File Structure

**New files:**
- `OSPREY-app/src/services/coaching/hr.ts` — `HRZones` type alias, `resolveMaxHR`, `DEFAULT_MAX_HR`, `ultraHRZones` re-export.
- `OSPREY-app/src/services/coaching/__tests__/hr.test.ts`
- `supabase/functions/ozzie-generate-plan/guidance.ts` — `HrZoneInfo`/`HRZones` mirror + pure `hrGuidance()`.
- `supabase/functions/ozzie-generate-plan/guidance.test.ts`

**Modified files:**
- `OSPREY-app/src/services/coaching/envelope.ts` — `CoachingEnvelope.hrZones`, `HrZoneInfo`, `EnvelopeInput.maxHR`, populate in `computeEnvelope`.
- `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` — population + regression tests.
- `OSPREY-app/src/services/coaching/build-envelope.ts` — max-HR query + thread `maxHR`.
- `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts` — threading test.
- `supabase/functions/ozzie-generate-plan/index.ts` — `Envelope.hrZones` mirror, append `hrGuidance`, prompt rule.

---

### Task 1: `hr.ts` — max-HR resolution + `HRZones` alias

**Files:**
- Create: `OSPREY-app/src/services/coaching/hr.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/hr.test.ts`

**Interfaces:**
- Consumes: `ultraHRZones`, `UltraHRZones` (`@/services/calculators/ultra`).
- Produces: `type HRZones = UltraHRZones`, `DEFAULT_MAX_HR`, `resolveMaxHR(observed: number | null): { maxHR: number; source: 'observed' | 'estimated' }`, and a re-export of `ultraHRZones`. Tasks 2 consumes all.

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/services/coaching/__tests__/hr.test.ts`:

```typescript
import { resolveMaxHR, DEFAULT_MAX_HR, ultraHRZones } from '@/services/coaching/hr';

describe('resolveMaxHR', () => {
  it('accepts a physiologically plausible observed max', () => {
    expect(resolveMaxHR(180)).toEqual({ maxHR: 180, source: 'observed' });
    expect(resolveMaxHR(120)).toEqual({ maxHR: 120, source: 'observed' });
    expect(resolveMaxHR(220)).toEqual({ maxHR: 220, source: 'observed' });
  });
  it('falls to the conservative default for null / out-of-range / spurious values', () => {
    expect(resolveMaxHR(null)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
    expect(resolveMaxHR(0)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
    expect(resolveMaxHR(119)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
    expect(resolveMaxHR(240)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
  });
  it('DEFAULT_MAX_HR is 190', () => {
    expect(DEFAULT_MAX_HR).toBe(190);
  });
});

describe('ultraHRZones re-export (HR band math)', () => {
  it('produces %-max-HR bands', () => {
    // 180 → Z2 70-80% = 126-144, Z4 87-92% = 157-166
    const z = ultraHRZones(180);
    expect(z.z2Endurance).toEqual({ min: 126, max: 144 });
    expect(z.z4Threshold).toEqual({ min: 157, max: 166 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/coaching/__tests__/hr.test.ts`
Expected: FAIL — `@/services/coaching/hr` does not exist.

- [ ] **Step 3: Implement `hr.ts`**

Create `OSPREY-app/src/services/coaching/hr.ts`:

```typescript
import { ultraHRZones, UltraHRZones } from '@/services/calculators/ultra';

// HR-based training zones (%-of-max-HR). The math is `ultraHRZones` — the "ultra"
// name is legacy; the 5-zone model is generic. Aliased here so the coaching layer
// reads semantically without forking the calculator.
export type HRZones = UltraHRZones;
export { ultraHRZones };

export const DEFAULT_MAX_HR = 190;

// Resolve a working max HR from an observed value. Accept only physiologically
// plausible readings (120-220 bpm) — this rejects a spurious sensor spike or a
// zero; otherwise fall back to a conservative default, flagged low-confidence.
export function resolveMaxHR(observed: number | null): { maxHR: number; source: 'observed' | 'estimated' } {
  if (observed != null && observed >= 120 && observed <= 220) {
    return { maxHR: observed, source: 'observed' };
  }
  return { maxHR: DEFAULT_MAX_HR, source: 'estimated' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/coaching/__tests__/hr.test.ts`
Expected: PASS. (If the `ultraHRZones` band fixture is off, read `calculators/ultra.ts` — the pct rounding is authoritative; match it.)

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/hr.ts OSPREY-app/src/services/coaching/__tests__/hr.test.ts
git commit -m "feat(coaching): max-HR resolution + HRZones alias (2b-iii)"
```

---

### Task 2: `computeEnvelope` — populate the `hrZones` field

**Files:**
- Modify: `OSPREY-app/src/services/coaching/envelope.ts` (`CoachingEnvelope` `:10`, `EnvelopeInput` `:21`, `computeEnvelope` return `:68`)
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts`

**Interfaces:**
- Consumes: `resolveMaxHR`, `ultraHRZones`, `HRZones` (Task 1).
- Produces: `CoachingEnvelope.hrZones: HrZoneInfo`, `interface HrZoneInfo { maxHR: number; source: 'observed' | 'estimated'; bands: HRZones }`, `EnvelopeInput.maxHR?: number | null`. Task 3 supplies `maxHR`; the edge fn (Task 5) mirrors `HrZoneInfo`.

- [ ] **Step 1: Write the failing test**

Add to `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` (keep existing tests):

```typescript
import { computeEnvelope, EnvelopeInput } from '@/services/coaching/envelope';
import { ultraHRZones } from '@/services/coaching/hr';

const hrBase: EnvelopeInput = {
  sport: 'run', phase: 'Base', weekNumber: 1, totalWeeks: 8,
  baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
  fitnessLevel: 'beginner', bodyWeightKg: 70,
};

describe('computeEnvelope hrZones (universal HR fallback)', () => {
  it('populates hrZones from a plausible observed max', () => {
    const env = computeEnvelope({ ...hrBase, maxHR: 180 });
    expect(env.hrZones).toEqual({ maxHR: 180, source: 'observed', bands: ultraHRZones(180) });
  });
  it('uses the conservative default when maxHR is null', () => {
    const env = computeEnvelope({ ...hrBase, maxHR: null });
    expect(env.hrZones.maxHR).toBe(190);
    expect(env.hrZones.source).toBe('estimated');
  });
  it('populates hrZones even for a non-pace goal (weight_loss: zones null, hrZones set)', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'weight_loss', maxHR: 175 });
    expect(env.zones).toBeNull();
    expect(env.hrZones.maxHR).toBe(175);
  });
  it('leaves pace zones byte-identical (hrZones is additive)', () => {
    const withHr = computeEnvelope({ ...hrBase, sport: 'run', bestRunMiles: 6.2, bestRunTimeS: 3000, maxHR: 180 });
    const noHr = computeEnvelope({ ...hrBase, sport: 'run', bestRunMiles: 6.2, bestRunTimeS: 3000 });
    expect(withHr.zones).toEqual(noHr.zones);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/coaching/__tests__/envelope.test.ts`
Expected: FAIL — `hrZones` is not on the envelope / `maxHR` not on `EnvelopeInput`.

- [ ] **Step 3: Add the field, type, input, and population**

In `envelope.ts`:

Add the import (with the other `./` imports):
```typescript
import { resolveMaxHR, ultraHRZones, HRZones } from './hr';
```

Add the `HrZoneInfo` interface (above `CoachingEnvelope`):
```typescript
export interface HrZoneInfo {
  maxHR: number;
  source: 'observed' | 'estimated';
  bands: HRZones;
}
```

Add the field to `CoachingEnvelope` (after `zones`):
```typescript
  zones: ZoneSet | null;
  hrZones: HrZoneInfo; // universal HR fallback (prompt-only); always populated
  fuel: FuelTargets;
```

Add to `EnvelopeInput` (after `selfReportAnchor`):
```typescript
  selfReportAnchor?: SelfReportAnchor | null;
  maxHR?: number | null;
```

In `computeEnvelope`, build `hrZones` before the `return` (after the `hardWeek` line):
```typescript
  const hardWeek = loadingWeek(input.weekNumber) !== 4 && input.phase !== 'Taper';

  const hr = resolveMaxHR(input.maxHR ?? null);
  const hrZones: HrZoneInfo = { maxHR: hr.maxHR, source: hr.source, bands: ultraHRZones(hr.maxHR) };
```

Add `hrZones` to the returned object (after `zones`):
```typescript
    zones,
    hrZones,
    fuel: computeRunningFuel({ bodyWeightKg: input.bodyWeightKg, hardWeek }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/coaching/__tests__/envelope.test.ts`
Expected: PASS (population + regression). Then `npm run typecheck`.

Note: `npm run typecheck` may now flag `build-envelope.ts`'s `envelopeFromInputs` if it constructs `EnvelopeInput` without `maxHR` — but `maxHR?` is OPTIONAL, so it won't. It's threaded in Task 3. If any OTHER `CoachingEnvelope` consumer destructures it exhaustively, it only gained a field (additive), so no break.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "feat(coaching): computeEnvelope populates a universal hrZones field (2b-iii)"
```

---

### Task 3: `build-envelope` — observed max-HR query + thread

**Files:**
- Modify: `OSPREY-app/src/services/coaching/build-envelope.ts` (`EnvelopeInputs`, `envelopeFromInputs`, default inputs, the `Promise.all` query block, inputs assembly)
- Test: `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts`

**Interfaces:**
- Consumes: `EnvelopeInput.maxHR` (Task 2).
- Produces: `EnvelopeInputs.maxHR` threaded through `envelopeFromInputs`.

- [ ] **Step 1: Write the failing test**

Add to `OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts` (keep existing):

```typescript
import { envelopeFromInputs } from '@/services/coaching/build-envelope';

it('threads observed maxHR into hrZones', () => {
  const env = envelopeFromInputs({
    sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
    baselineLoad: 200, prevWeekLoad: null,
    bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
    selfReportAnchor: null, maxHR: 185,
  });
  expect(env.hrZones).toMatchObject({ maxHR: 185, source: 'observed' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/coaching/__tests__/build-envelope.test.ts`
Expected: FAIL — `maxHR` is not on `EnvelopeInputs`.

- [ ] **Step 3: Add the field, thread it, add the query**

In `build-envelope.ts`:

Add to the `EnvelopeInputs` interface (after `selfReportAnchor`):
```typescript
  selfReportAnchor: SelfReportAnchor | null;
  maxHR: number | null;
```

In `envelopeFromInputs`, pass it to `computeEnvelope` (after `selfReportAnchor: i.selfReportAnchor,`):
```typescript
    selfReportAnchor: i.selfReportAnchor,
    maxHR: i.maxHR,
```

In the default `inputs` literal, add `maxHR: null,`:
```typescript
    rowingSplitSecPer500: null, selfReportAnchor: null, maxHR: null,
```

Add a query to the `Promise.all` array (alongside the runs/rowing queries) — the single highest observed max HR across recent logs, any session type:
```typescript
      supabase.from('workout_logs').select('max_heart_rate').eq('user_id', userId).is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).not('max_heart_rate', 'is', null).order('max_heart_rate', { ascending: false }).limit(1).maybeSingle(),
```
Capture it as the next destructured result — update the destructuring to include `maxHrRes`:
```typescript
    const [goalsRes, weightRes, runsRes, rowsRes, maxHrRes] = await Promise.all([
```
and add its error log beside the others:
```typescript
    if (maxHrRes.error) console.warn('[build-envelope] workout_logs (maxHR) query failed:', maxHrRes.error.message);
```

In the populated `inputs = { … }` assembly, add (after `selfReportAnchor: …,`):
```typescript
      selfReportAnchor: toSelfReportAnchor(g?.threshold_anchor as ThresholdAnchorMap | null),
      maxHR: (maxHrRes.data?.max_heart_rate as number | null) ?? null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/coaching/__tests__/build-envelope.test.ts`
Expected: PASS. Then `npm run typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/src/services/coaching/build-envelope.ts OSPREY-app/src/services/coaching/__tests__/build-envelope.test.ts
git commit -m "feat(coaching): build-envelope supplies observed max HR (2b-iii)"
```

---

### Task 4: `guidance.ts` — pure HR prompt-string builder (edge fn)

**Files:**
- Create: `supabase/functions/ozzie-generate-plan/guidance.ts`
- Test: `supabase/functions/ozzie-generate-plan/guidance.test.ts`

**Interfaces:**
- Produces: `interface HrZoneInfo` (edge-fn mirror), `hrGuidance(hr: HrZoneInfo | null | undefined): string`. Task 5 (`index.ts`) imports both.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/ozzie-generate-plan/guidance.test.ts`:

```typescript
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hrGuidance, type HrZoneInfo } from './guidance.ts';

const hr180: HrZoneInfo = {
  maxHR: 180,
  source: 'observed',
  bands: {
    maxHR: 180,
    z1Recovery: { min: null, max: 126 },
    z2Endurance: { min: 126, max: 144 },
    z3SteadyMarathon: { min: 144, max: 157 },
    z4Threshold: { min: 157, max: 166 },
    z5Vo2Hills: { min: 166, max: null },
  },
};

Deno.test('hrGuidance returns empty for null/undefined', () => {
  assertEquals(hrGuidance(null), '');
  assertEquals(hrGuidance(undefined), '');
});

Deno.test('hrGuidance emits Z2 + Z4 bpm from an observed max', () => {
  const s = hrGuidance(hr180);
  assertEquals(s.includes('Z2 126-144 bpm'), true);
  assertEquals(s.includes('Z4 157-166 bpm'), true);
  assertEquals(s.includes('~180 bpm'), true);
  assertEquals(s.includes('estimated'), false);
});

Deno.test('hrGuidance flags an estimated max as approximate', () => {
  const s = hrGuidance({ ...hr180, source: 'estimated' });
  assertEquals(s.includes('estimated'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/ozzie-generate-plan/guidance.test.ts`
Expected: FAIL — `./guidance.ts` does not exist.

- [ ] **Step 3: Implement `guidance.ts`**

Create `supabase/functions/ozzie-generate-plan/guidance.ts`:

```typescript
// Pure prompt-guidance builders. Hand-narrowed mirror of the app's HR zone shape
// (OSPREY-app/src/services/coaching/hr.ts + calculators/ultra.ts UltraHRZones).
// Keep in sync if those change.
interface Range {
  min: number | null;
  max: number | null;
}

interface HRZones {
  maxHR: number;
  z1Recovery: Range;
  z2Endurance: Range;
  z3SteadyMarathon: Range;
  z4Threshold: Range;
  z5Vo2Hills: Range;
}

export interface HrZoneInfo {
  maxHR: number;
  source: 'observed' | 'estimated';
  bands: HRZones;
}

// Prompt-only HR guidance for cross-training / non-pace cardio. Never clamps.
export function hrGuidance(hr: HrZoneInfo | null | undefined): string {
  if (!hr) return '';
  const approx = hr.source === 'estimated' ? ' (estimated — treat as approximate)' : '';
  const z2 = hr.bands.z2Endurance;
  const z4 = hr.bands.z4Threshold;
  return (
    ` HR zones from max HR ~${hr.maxHR} bpm${approx}: keep easy / cross-training cardio in Z2 ${z2.min}-${z2.max} bpm,` +
    ` one harder Z4 session ${z4.min}-${z4.max} bpm. Use HR zones (not pace) for bike/cross/easy-cardio sessions,` +
    ` and for all cardio when no pace bands are given.`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/ozzie-generate-plan/guidance.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/guidance.ts supabase/functions/ozzie-generate-plan/guidance.test.ts
git commit -m "feat(edge): pure HR prompt-guidance builder (2b-iii)"
```

---

### Task 5: Wire `hrZones` into the edge fn (`index.ts`)

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` — import from `./guidance.ts`, `Envelope.hrZones` (`:108`), append `hrGuidance` to `envelopeGuidance` (`:313`), a `PLAN_SYSTEM_PROMPT` rule (`:27-38`).

**Interfaces:**
- Consumes: `hrGuidance`, `HrZoneInfo` from `./guidance.ts` (Task 4).
- Produces: nothing downstream — terminal integration.

This is integration wiring; `index.ts` is not unit-tested (DB/network). Verification: `deno test` (guidance + the UNCHANGED validate suite) green + `deno check` introduces no new errors. **Do not edit `validate.ts`.**

- [ ] **Step 1: Import the helper + mirror the field**

At the top of `index.ts`, beside `import { routeDisciplineDays, … } from './goals.ts';`, add:
```typescript
import { hrGuidance, type HrZoneInfo } from './guidance.ts';
```

Add `hrZones` to the `Envelope` interface (after `zones`, `:115`) — nullable/optional for backward-compat with app builds that predate 2b-iii:
```typescript
  zones: ZoneSet | null;
  hrZones?: HrZoneInfo | null;
  fuel: { dailyCarbG: { min: number | null; max: number | null }; proteinG: { min: number; max: number }; longSessionCarbGPerHour: number };
```

- [ ] **Step 2: Append HR guidance to the envelope guidance**

In `generateWeekDays`, extend the `envelopeGuidance` concatenation (`:313-316`) to append `hrGuidance`:
```typescript
  const envelopeGuidance = envelope
    ? ` COACHING ENVELOPE (hard constraints — stay inside these): phase=${envelope.phase}, week ${envelope.weekNumber}/${envelope.totalWeeks}, target weekly load ≈ ${envelope.targetWeeklyLoad} TSS, at most ${Math.round(envelope.hardSessionShareMax * 100)}% of sessions hard.` +
      zoneGuidance +
      hrGuidance(envelope.hrZones) +
      ` Daily carbs ${envelope.fuel.dailyCarbG.min}-${envelope.fuel.dailyCarbG.max} g; long-session fuel ~${envelope.fuel.longSessionCarbGPerHour} g/hr.`
    : '';
```

- [ ] **Step 3: Add the prompt rule**

In `PLAN_SYSTEM_PROMPT`, add one rule to the `Rules:` list (after the `interval_prescription` rule, `:37`) clarifying the two zone systems:
```
- Zone guidance: apply the pace bands (if given) ONLY to the athlete's primary-sport sessions (run/swim/rowing). For bike, cross, and easy-cardio / cross-training sessions — and for ALL cardio when no pace bands are given (e.g. weight-loss or general-fitness plans) — target the HR zones instead. Never pace-clamp a cross-training session.
```

- [ ] **Step 4: Verify the pure suites (incl. the UNCHANGED validate suite)**

Run: `deno test supabase/functions/ozzie-generate-plan/`
Expected: PASS — `guidance.test.ts` (3), `goals.test.ts` (7), and `validate.test.ts` (9) all green. `validate.ts`/`validate.test.ts` must be unmodified (confirm with `git status`).

- [ ] **Step 5: Typecheck the edge function (no NEW errors)**

Run: `deno check supabase/functions/ozzie-generate-plan/index.ts`
Expected: only the ~26 pre-existing `@supabase/supabase-js` typing errors (documented in the 2a roll-up) — no new error mentioning `hrGuidance`, `HrZoneInfo`, or `hrZones`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/index.ts
git commit -m "feat(edge): mirror hrZones + append HR prompt guidance (2b-iii)"
```

---

## Post-implementation
App + edge fn deploy together at go-live (new `hrZones` envelope field + prompt); `validate.ts` untouched; no migration. Add nothing new to the deploy runbook beyond the existing `ozzie-generate-plan` redeploy already recorded there. Backward-compatible: an old app build sends no `hrZones` → `hrGuidance` returns `''`.

## Self-Review

**Spec coverage** (against `2026-07-14-coaching-engine-phase2b-iii-design.md`):
- §2 separate `hrZones` field coexisting with `zones`; `validate.ts` untouched → Tasks 2 + 5 (and the Global Constraint / Task 5 Step 4 guard). ✅
- §3 max-HR resolution (120–220, default 190, source) → Task 1. ✅
- §4 `computeEnvelope` universal population + additive/regression + `build-envelope` query → Tasks 2 + 3. ✅
- §5 `index.ts` mirror + `hrGuidance` + prompt rule; `validate.ts` unchanged → Tasks 4 + 5. ✅
- §6 `HRZones = UltraHRZones` alias + call `ultraHRZones` directly → Task 1. ✅
- §7 TDD (resolveMaxHR, hrZones population + regression, threading, pure hrGuidance, validate stays green) → Tasks 1–5. ✅

**Placeholder scan:** none — every step has complete code. The two reconciliation notes (ultra fixture; deno-check baseline) are explicit instructions.

**Type consistency:** `HrZoneInfo` is defined app-side in `envelope.ts` (Task 2) and mirrored edge-side in `guidance.ts` (Task 4) with the SAME field names (`maxHR`/`source`/`bands`) — the hand-copy is deliberate (Deno can't import `@/`). `HRZones` = `UltraHRZones` alias (Task 1) consumed by Task 2. `resolveMaxHR` return `{ maxHR, source }` matches its use in `computeEnvelope`. `EnvelopeInput.maxHR?` (Task 2, optional) ← `EnvelopeInputs.maxHR` (Task 3, required, always supplied). The edge `Envelope.hrZones?` is optional (backward-compat) and `hrGuidance` accepts `null | undefined`.
