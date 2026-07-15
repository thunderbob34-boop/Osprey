# Coaching-Engine Phase 2c-iii — Fuel Per Day-Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each workout's carb target matches its intensity (hard days more, easy days fewer) instead of one weekly target — across every sport. The last coaching-engine slice.

**Architecture:** App: `computeRunningFuel` → `computeFuel(sport, bodyWeightKg)` returning the carb ladder by day-type (via the shared `dailyCarbGrams`) + protein + a per-sport in-session rate; `computeEnvelope.fuel` becomes that `FuelPlan`. Edge: `validate.ts`'s fuel-attach resolves each session's carb range from its post-polarization intensity (the stored per-session `fuel` shape is unchanged); `index.ts` mirrors `FuelPlan` + states the by-day ranges. App + edge only — no new sport, no migration, no webapp/mobile.

**Tech Stack:** TypeScript, Jest (`TZ=Asia/Kolkata jest`), Deno (`deno test`/`check`). Reuses `dailyCarbGrams`/`EnduranceDayType` (shared.ts) + the per-sport carb fns (all exist).

## Global Constraints

- **TDD.** App: `npm test` (from `OSPREY-app/`). Edge: `deno test`.
- **The stored per-session `fuel` shape stays `{ dailyCarbG, proteinG, longSessionCarbGPerHour }`** — only its `dailyCarbG` value now varies by day. Do not rename or restructure it.
- **Regression:** `computeEnvelope`'s `zones`/`hrZones`/periodization output is byte-identical — only `fuel` changes shape/behavior. `validate.ts`'s pace-clamp + polarization stay byte-identical (only the fuel-attach step changes).
- **⚠️ GIT HYGIENE:** each task `git add`s ONLY its own files (never `git add -A`/`git add .`; `git status` before committing — untracked audit-reports/worktree files must stay out).
- **No migration, no webapp, no mobile.** App + edge deploy together (go-live coupling). Deno assert `https://deno.land/std@0.224.0/assert/mod.ts`; `@/` → `OSPREY-app/src`; lint clean.
- **Day-type mapping:** `easy`/`rest`/other → `easy`; `moderate` → `moderate`; `threshold`/`interval` → `high`; `race` → `peak`.

---

## File Structure

**App:** `src/services/coaching/fuel.ts` (+`__tests__/fuel.test.ts`), `src/services/coaching/envelope.ts` (+its test).
**Edge:** `supabase/functions/ozzie-generate-plan/validate.ts` (+`validate.test.ts`), `index.ts`.

---

### Task 1: App — `computeFuel` + envelope wiring

**Files:**
- Modify: `OSPREY-app/src/services/coaching/fuel.ts`, `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/fuel.test.ts`

**Interfaces:**
- Produces: `FuelPlan { dailyCarbGByDayType: Record<EnduranceDayType, Range>; proteinG: Range; longSessionCarbGPerHour: number }`; `computeFuel(sport, bodyWeightKg): FuelPlan`. `CoachingEnvelope.fuel` becomes `FuelPlan`. Tasks 2/3 mirror `FuelPlan` in Deno.

- [ ] **Step 1: Rewrite the failing test** — replace `fuel.test.ts` contents:

```typescript
import { computeFuel } from '@/services/coaching/fuel';
import { dailyCarbGrams } from '@/services/calculators/shared';

describe('computeFuel', () => {
  it('returns the carb ladder by day-type for the given body weight', () => {
    const f = computeFuel('run', 70);
    expect(f.dailyCarbGByDayType.easy).toEqual(dailyCarbGrams('easy', 70));
    expect(f.dailyCarbGByDayType.high).toEqual(dailyCarbGrams('high', 70));
    expect(f.dailyCarbGByDayType.peak).toEqual(dailyCarbGrams('peak', 70));
  });
  it('sets a positive per-sport in-session carb rate + a sane protein range', () => {
    const f = computeFuel('cycling', 70);
    expect(f.longSessionCarbGPerHour).toBeGreaterThan(0);
    expect(f.proteinG.min).toBe(Math.round(70 * 1.6));
    expect(f.proteinG.max).toBe(Math.round(70 * 2.2));
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`computeFuel` doesn't exist).

Run: `npm test -- src/services/coaching/__tests__/fuel.test.ts`

- [ ] **Step 3: Rewrite `fuel.ts`:**

```typescript
import { runningRaceFuelGPerHour } from '@/services/calculators/running';
import { cyclingInRideCarbGPerHour } from '@/services/calculators/cycling';
import { swimMeetDayCarbGPerHour } from '@/services/calculators/swimming';
import { dailyCarbGrams, EnduranceDayType } from '@/services/calculators/shared';
import { midpoint, Range } from '@/services/calculators/types';

export interface FuelPlan {
  dailyCarbGByDayType: Record<EnduranceDayType, Range>; // easy / moderate / high / peak
  proteinG: Range;
  longSessionCarbGPerHour: number; // per-sport in-session rate (name kept for the stored session-fuel shape)
}

// Per-sport in-session carb rate (g/hr), midpoint of the sport's in-ride/race table.
function inSessionCarbGPerHour(sport: string): number {
  if (sport === 'cycling') return Math.round(midpoint(cyclingInRideCarbGPerHour('long_or_hard')) ?? 60);
  if (sport === 'swim') return Math.round(midpoint(swimMeetDayCarbGPerHour(true)) ?? 60);
  return Math.round(midpoint(runningRaceFuelGPerHour('marathon')) ?? 60); // run/hybrid/hyrox/rowing/triathlon/default
}

export function computeFuel(sport: string, bodyWeightKg: number): FuelPlan {
  const carb = (dt: EnduranceDayType) => dailyCarbGrams(dt, bodyWeightKg);
  return {
    dailyCarbGByDayType: { easy: carb('easy'), moderate: carb('moderate'), high: carb('high'), peak: carb('peak') },
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.2) },
    longSessionCarbGPerHour: inSessionCarbGPerHour(sport),
  };
}
```

- [ ] **Step 4: Wire the envelope.** In `envelope.ts`:

Change the import:
```typescript
import { computeFuel, FuelPlan } from './fuel';
```
Retype `CoachingEnvelope.fuel`:
```typescript
  fuel: FuelPlan;
```
In `computeEnvelope`, **delete the `const hardWeek = …` line** and change the return's `fuel`:
```typescript
    fuel: computeFuel(input.sport, input.bodyWeightKg),
```
If `loadingWeek` is now unused in `envelope.ts` (its only use was `hardWeek`), drop it from the `./periodization` import (keep `Phase`, `targetWeeklyLoad`). `npm run typecheck` will flag it if so.

- [ ] **Step 5: Run — expect PASS** (`fuel.test.ts` + the envelope tests — `zones`/`hrZones` unchanged; any envelope test asserting `fuel` shape updates to `FuelPlan`), then `npm run typecheck` clean.

- [ ] **Step 6: Commit** — `git add OSPREY-app/src/services/coaching/fuel.ts OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/fuel.test.ts` (+ `envelope.test.ts` if touched) ; `git commit -m "feat(coaching): computeFuel — carb ladder by day-type (2c-iii)"`

---

### Task 2: Edge — `validate.ts` per-session fuel attach

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/validate.ts`
- Test: `supabase/functions/ozzie-generate-plan/validate.test.ts`

**Interfaces:**
- Consumes: the `FuelPlan` shape (Task 1).
- Produces: each non-rest session's `fuel.dailyCarbG` reflects its post-polarization intensity; the fuel shape stays `{ dailyCarbG, proteinG, longSessionCarbGPerHour }`.

- [ ] **Step 1: Write / update the tests** — in `validate.test.ts`, UPDATE the existing "attaches fuel to non-rest sessions" test and ADD a per-session one (Deno assert style):

```typescript
Deno.test('attaches day-type carbs per session by (post-polarization) intensity', () => {
  const envelope = {
    hardSessionShareMax: 1,  // don't demote — we want to observe both intensities
    zones: null,
    fuel: {
      dailyCarbGByDayType: { easy: { min: 210, max: 350 }, moderate: { min: 350, max: 490 }, high: { min: 560, max: 700 }, peak: { min: 700, max: 840 } },
      proteinG: { min: 112, max: 154 },
      longSessionCarbGPerHour: 75,
    },
  };
  const days = [
    { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 8 },
    { dayOffset: 1, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 10 },
    { dayOffset: 2, session_type: 'rest', intensity: 'rest', planned_minutes: null, planned_distance_km: null },
  ];
  const { days: out } = validateAndClamp(days as any, envelope as any);
  assertEquals((out[0] as any).fuel.dailyCarbG, { min: 210, max: 350 }); // easy → easy carbs
  assertEquals((out[1] as any).fuel.dailyCarbG, { min: 560, max: 700 }); // interval → high carbs
  assertEquals((out[0] as any).fuel.longSessionCarbGPerHour, 75);
  assertEquals((out[2] as any).fuel, undefined);                          // rest → no fuel
});
```
> If a pre-existing fuel test asserted the old single-`dailyCarbG` `envelope.fuel`, update its `envelope.fuel` to the `FuelPlan` shape and its expectation to the resolved per-session value. Do NOT change the pace-clamp/polarization tests.

- [ ] **Step 2: Run — expect FAIL** (the attach still stamps `envelope.fuel` — now the wrong shape).

- [ ] **Step 3: Refactor the fuel-attach.** In `validate.ts`:

Retype `EnvelopeLike.fuel` from `unknown` to the `FuelPlan` mirror (add near the `Band`/`Zones` types):
```typescript
type FuelPlan = {
  dailyCarbGByDayType: { easy: Band; moderate: Band; high: Band; peak: Band };
  proteinG: Band;
  longSessionCarbGPerHour: number;
};
interface EnvelopeLike { hardSessionShareMax: number; zones: Zones | null; fuel: FuelPlan; }
```
Add the day-type mapper (near `paceZoneForSession`):
```typescript
function carbDayType(intensity: string): 'easy' | 'moderate' | 'high' | 'peak' {
  if (intensity === 'moderate') return 'moderate';
  if (intensity === 'threshold' || intensity === 'interval') return 'high';
  if (intensity === 'race') return 'peak';
  return 'easy'; // easy / rest / anything else
}
```
Change step (c) (the fuel-attach `out.map`) to resolve per-session:
```typescript
  // (c) attach the day-type carb range to every non-rest session, keyed off its
  // FINAL (post-polarization) intensity — hard days get high carbs, easy days fewer.
  out = out.map((d) =>
    d.session_type === 'rest'
      ? d
      : {
          ...d,
          fuel: {
            dailyCarbG: envelope.fuel.dailyCarbGByDayType[carbDayType(d.intensity)],
            proteinG: envelope.fuel.proteinG,
            longSessionCarbGPerHour: envelope.fuel.longSessionCarbGPerHour,
          },
        },
  );
```

- [ ] **Step 4: Run — expect PASS**: `deno test supabase/functions/ozzie-generate-plan/validate.test.ts` — the new/updated fuel tests + every pace-clamp/polarization test byte-identical.

- [ ] **Step 5: Commit** — `git add` validate.ts + validate.test.ts ; `git commit -m "feat(edge): attach day-type carbs per session by intensity (2c-iii)"`

---

### Task 3: Edge — `index.ts` FuelPlan mirror + prompt

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts`

**Interfaces:**
- Consumes: the `FuelPlan` shape.
- Produces: the `Envelope.fuel` mirror is `FuelPlan`; the prompt states the by-day carb ranges.

Integration wiring; verified by `deno check` + `deno test` green.

- [ ] **Step 1: Retype the `Envelope.fuel` mirror.** Change the `fuel: { dailyCarbG: …; proteinG: …; longSessionCarbGPerHour }` field of the `Envelope` interface to:
```typescript
  fuel: { dailyCarbGByDayType: { easy: { min: number; max: number }; moderate: { min: number; max: number }; high: { min: number; max: number }; peak: { min: number; max: number } }; proteinG: { min: number; max: number }; longSessionCarbGPerHour: number };
```

- [ ] **Step 2: Update the fuel line in `envelopeGuidance`.** Replace the current `Daily carbs …; long-session fuel …` string with:
```typescript
      ` Daily carbs by day: easy ${envelope.fuel.dailyCarbGByDayType.easy.min}-${envelope.fuel.dailyCarbGByDayType.easy.max} g, hard ${envelope.fuel.dailyCarbGByDayType.high.min}-${envelope.fuel.dailyCarbGByDayType.high.max} g, race ${envelope.fuel.dailyCarbGByDayType.peak.min}-${envelope.fuel.dailyCarbGByDayType.peak.max} g; in-session ~${envelope.fuel.longSessionCarbGPerHour} g/hr.`
```
(Keep the surrounding `COACHING ENVELOPE …` + `zoneGuidance` + `hrGuidance` concatenation intact — only the fuel string changes.)

- [ ] **Step 3: Verify.** `deno test supabase/functions/ozzie-generate-plan/` — all green. `deno check supabase/functions/ozzie-generate-plan/index.ts` — only the ~26 pre-existing `@supabase/supabase-js` errors (grep `ERROR`), none referencing `fuel`/`dailyCarbGByDayType`.

- [ ] **Step 4: Commit** — `git add index.ts` ; `git commit -m "feat(edge): mirror FuelPlan + by-day carb guidance (2c-iii)"`

---

## Post-implementation
App + edge deploy together at go-live (`FuelPlan` envelope shape + per-session attach + by-day prompt) — add a 2c-iii line to `DEPLOY-CHECKLIST.md`. No migration; no webapp/mobile. The stored `training_sessions.fuel` shape is unchanged, so any current/future renderer is unaffected — only the value now varies by the day's intensity. **This completes Phase 1→2c — the whole coaching engine.**

## Self-Review

**Spec coverage** (against `2026-07-15-coaching-engine-phase2c-iii-design.md`):
- §2 `computeFuel` (ladder by day-type + per-sport in-session) → Task 1. ✅
- §3 envelope wiring (`FuelPlan`, `computeFuel`, remove `hardWeek`) → Task 1. ✅
- §4 `validate.ts` per-session attach (`carbDayType`, post-polarization, shape unchanged) → Task 2. ✅
- §5 `index.ts` `FuelPlan` mirror + by-day prompt → Task 3. ✅
- §6 stored session-fuel shape unchanged; envelope wire-shape changes (atomic deploy) → Tasks 2/3 + Post-impl. ✅
- §7 TDD (ladder; per-session-by-intensity attach; regression) → all tasks. ✅

**Placeholder scan:** none — code is complete. The two `>` notes are explicit reconciliations (drop unused `loadingWeek`; update any pre-existing fuel test literal to `FuelPlan`).

**Type consistency:** `FuelPlan` (Task 1, app) is hand-mirrored in `validate.ts` (Task 2) and `index.ts` (Task 3) with matching fields (`dailyCarbGByDayType.{easy,moderate,high,peak}` + `proteinG` + `longSessionCarbGPerHour`). The RESOLVED per-session `fuel` (`{ dailyCarbG, proteinG, longSessionCarbGPerHour }`, Task 2) keeps the old `FuelTargets` shape the app renders. `carbDayType` (Task 2) covers every `intensity` value the plan prompt emits (`easy`/`moderate`/`threshold`/`interval`/`race`/`rest`).
