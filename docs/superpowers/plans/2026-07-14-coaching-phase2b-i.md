# Coaching-Engine Phase 2b-i — Sport Selection + Edge-fn Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make swim / rowing / hyrox selectable primary goals across onboarding + the plan-builder, and wire the edge function so a selected sport flows through to the (already-built, currently-dormant) 2a zone engine and pace-clamp.

**Architecture:** The app is goal-centric — `user_goals.primary_goal` drives `blueprintSport` → `computeEnvelope` → the per-kind `ZoneSet` + clamp (all shipped in 2a). Today the reachable `primary_goal` set excludes swim/rowing/hyrox, so those branches never fire. This slice adds the three sports to the goal vocab (types + both pickers + the DB enum), and makes the edge-fn day-split **primary-sport-aware** (a swimmer's training days become swim days, not run days) via a new pure `routeDisciplineDays` helper used by both the preferences and background-regeneration paths. No new zone math — 2a already has it.

**Tech Stack:** React Native / Expo (app), TypeScript, Jest (`TZ=Asia/Kolkata jest`), Deno edge functions (`deno test`, std assert 0.224.0), Supabase Postgres enums.

## Global Constraints

- **TDD throughout.** Write the failing test first, watch it fail, then implement. App tests: `npm test` (runs `TZ=Asia/Kolkata jest`). Edge-fn tests: `deno test <file>`.
- **Preserve run/hybrid plan output bit-for-bit.** `routeDisciplineDays('run', …)` and `('hybrid', …)` must produce exactly today's day counts. This is a hard regression guard — the reviewer verifies it.
- **No new npm/deno dependencies.** Reuse existing patterns.
- **Path alias:** `@/(.*)` → `OSPREY-app/src/$1` (jest `moduleNameMapper` + tsconfig).
- **Deno test imports:** `import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';` (match `validate.test.ts` exactly).
- **Migrations via MCP, not `db push`.** The repo migration history has drifted from the live schema (see `docs/DEPLOY-CHECKLIST.md`). The migration file is the repo artifact; the **controller applies it via the Supabase MCP `apply_migration`** after review. `ALTER TYPE … ADD VALUE IF NOT EXISTS` is idempotent + backward-compatible (existing rows/queries unaffected), so it is safe to apply pre-launch.
- **Atomic deploy at go-live.** The edge-fn changes ship with the app build and deploy together (the envelope/goal contract must agree). Pre-launch there are no live clients, so ordering is not operationally sensitive; the edge-fn deploy is bundled into the go-live runbook (same rule as 2a).
- **`session_type_enum` already contains `swim`, `bike`, `rowing`, `hyrox`** (migrations `20260702000015`, `20260707000028`) — do NOT add a session_type migration. Only `primary_goal_enum` needs new values.
- **`weekly_run_days` is reinterpreted as "primary endurance days."** It is only ever *summed* for display (`app/preferences.tsx:118`), never shown as a labeled "runs" count, so routing it by `primary_goal` is safe and needs no new column.

---

## File Structure

**New files:**
- `supabase/migrations/20260714000003_sport_primary_goals.sql` — enum values swim/rowing/hyrox.
- `OSPREY-app/src/constants/sports.ts` — `primaryDayLabel(goal)` (pure onboarding-copy helper).
- `OSPREY-app/src/constants/__tests__/sports.test.ts`
- `OSPREY-app/src/services/__tests__/onboarding.test.ts`
- `supabase/functions/ozzie-generate-plan/goals.ts` — `ENDURANCE_PRIMARY`, `routeDisciplineDays`, `DisciplineDays` (pure day-routing).
- `supabase/functions/ozzie-generate-plan/goals.test.ts`

**Modified files:**
- `OSPREY-app/src/types/onboarding.ts` — widen `PrimaryGoal`.
- `OSPREY-app/src/types/preferences.ts` — widen `TrainingGoal`.
- `OSPREY-app/src/services/onboarding.ts` — extend `ONBOARDING_GOAL_TO_PREFERENCES`.
- `OSPREY-app/app/(onboarding)/goals.tsx` — 3 sport chips + sport-aware schedule label.
- `OSPREY-app/app/preferences.tsx` — 3 plan-builder options.
- `supabase/functions/ozzie-generate-plan/index.ts` — `PRIMARY_GOAL_MAP` entries, `routeDisciplineDays` in both goal paths, `GoalsContext.weeklyRowDays`, user-message row-days, prompt session_type/rules for rowing.

---

### Task 1: Migration — add swim/rowing/hyrox to `primary_goal_enum`

**Files:**
- Create: `supabase/migrations/20260714000003_sport_primary_goals.sql`

**Interfaces:**
- Produces: the DB can store `primary_goal ∈ {swim, rowing, hyrox}` (Tasks 3/5 write these values).

DDL migration — no automated test (there is no unit-test harness for schema). Verification is SQL correctness + the controller applying it via MCP.

- [ ] **Step 1: Write the migration file**

```sql
-- Phase 2b-i: make swim / rowing / hyrox selectable primary goals.
--
-- Phase 2a built training zones for swim (CSS), rowing (2k split), and hyrox
-- (run-threshold) — but they were DORMANT: primary_goal_enum could not hold
-- these values, so blueprintSport() never resolved to them and computeEnvelope
-- never dispatched to those branches. Adding the enum values activates the 2a
-- zone engine + pace-clamp end-to-end.
--
-- Mirrors the triathlon precedent (20260702000021) and the session_type
-- additions (20260702000015 swim/bike, 20260707000028 rowing/hyrox).
-- ADD VALUE IF NOT EXISTS is idempotent and backward-compatible: existing rows
-- and queries are unaffected.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'swim';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'rowing';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'hyrox';
```

- [ ] **Step 2: Verify the file matches the established enum-add pattern**

Run: `cat supabase/migrations/20260702000021_triathlon_goal.sql`
Expected: the new file uses the same `ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS` form (one statement per value, no transaction wrapper).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260714000003_sport_primary_goals.sql
git commit -m "feat(db): add swim/rowing/hyrox to primary_goal_enum (2b-i)"
```

> **Controller note (not a subagent step):** after this task's review, apply via the Supabase MCP `apply_migration` (name `sport_primary_goals`, the SQL above). Do NOT `supabase db push` (history drift). This is safe to run pre-launch.

---

### Task 2: Widen the goal-type unions + extend the onboarding→preferences map

**Files:**
- Modify: `OSPREY-app/src/types/onboarding.ts:1`
- Modify: `OSPREY-app/src/types/preferences.ts` (the `TrainingGoal` union)
- Modify: `OSPREY-app/src/services/onboarding.ts:9-15` (`ONBOARDING_GOAL_TO_PREFERENCES`)
- Test: `OSPREY-app/src/services/__tests__/onboarding.test.ts`

**Interfaces:**
- Produces: `PrimaryGoal` and `TrainingGoal` each gain `'swim' | 'rowing' | 'hyrox'`; `ONBOARDING_GOAL_TO_PREFERENCES` gains `swim→'swim'`, `rowing→'rowing'`, `hyrox→'hyrox'`. Task 3 relies on the widened `PrimaryGoal`; Task 5's edge-fn `PRIMARY_GOAL_MAP` mirrors the same string values (independently, since Deno can't import app types).

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/services/__tests__/onboarding.test.ts`:

```typescript
import { ONBOARDING_GOAL_TO_PREFERENCES } from '@/services/onboarding';

describe('ONBOARDING_GOAL_TO_PREFERENCES', () => {
  it('maps the new sports to matching plan-builder goals', () => {
    expect(ONBOARDING_GOAL_TO_PREFERENCES.swim).toBe('swim');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.rowing).toBe('rowing');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.hyrox).toBe('hyrox');
  });

  it('leaves the existing goal mappings unchanged', () => {
    expect(ONBOARDING_GOAL_TO_PREFERENCES.run).toBe('run_performance');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.lift).toBe('strength');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.hybrid).toBe('hybrid');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.weight_loss).toBe('weight_loss');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.general_fitness).toBe('general');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/__tests__/onboarding.test.ts`
Expected: FAIL — the `.swim`/`.rowing`/`.hyrox` accesses are `undefined` (and/or a ts-jest type error, since those keys aren't on the union yet).

- [ ] **Step 3: Widen `PrimaryGoal`**

In `OSPREY-app/src/types/onboarding.ts:1`, replace:

```typescript
export type PrimaryGoal = 'run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness';
```

with:

```typescript
export type PrimaryGoal =
  | 'run'
  | 'lift'
  | 'hybrid'
  | 'weight_loss'
  | 'general_fitness'
  | 'swim'
  | 'rowing'
  | 'hyrox';
```

- [ ] **Step 4: Widen `TrainingGoal`**

In `OSPREY-app/src/types/preferences.ts`, extend the `TrainingGoal` union to add the three sports:

```typescript
export type TrainingGoal =
  | 'hybrid'
  | 'run_performance'
  | 'strength'
  | 'weight_loss'
  | 'general'
  | 'triathlon'
  | 'swim'
  | 'rowing'
  | 'hyrox';
```

- [ ] **Step 5: Extend the mapping (this is what makes tsc happy again)**

In `OSPREY-app/src/services/onboarding.ts:9`, add the three entries (the `Record<PrimaryGoal, TrainingGoal>` type now *requires* them):

```typescript
export const ONBOARDING_GOAL_TO_PREFERENCES: Record<PrimaryGoal, TrainingGoal> = {
  run: 'run_performance',
  lift: 'strength',
  hybrid: 'hybrid',
  weight_loss: 'weight_loss',
  general_fitness: 'general',
  swim: 'swim',
  rowing: 'rowing',
  hyrox: 'hyrox',
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/services/__tests__/onboarding.test.ts`
Expected: PASS (both cases).

- [ ] **Step 7: Typecheck (the widened Record is exhaustive; nothing else should break)**

Run: `npm run typecheck`
Expected: no new errors. (`ONBOARDING_GOAL_TO_PREFERENCES` is the only `Record<PrimaryGoal,…>` / `Record<TrainingGoal,…>` in the app; there are no exhaustive switches on these unions.)

- [ ] **Step 8: Commit**

```bash
git add OSPREY-app/src/types/onboarding.ts OSPREY-app/src/types/preferences.ts OSPREY-app/src/services/onboarding.ts OSPREY-app/src/services/__tests__/onboarding.test.ts
git commit -m "feat(app): add swim/rowing/hyrox to the goal vocab + onboarding→prefs map (2b-i)"
```

---

### Task 3: Sport chips (onboarding) + sport-aware schedule label + plan-builder options

**Files:**
- Create: `OSPREY-app/src/constants/sports.ts`
- Create: `OSPREY-app/src/constants/__tests__/sports.test.ts`
- Modify: `OSPREY-app/app/(onboarding)/goals.tsx:8-13` (GOALS array) and `:78` (schedule label)
- Modify: `OSPREY-app/app/preferences.tsx` (GOAL_OPTIONS array)

**Interfaces:**
- Consumes: the widened `PrimaryGoal` (Task 2).
- Produces: `primaryDayLabel(goal: PrimaryGoal | null): string`.

The pure label logic is TDD'd; the chip/option array edits are copy verified by typecheck (and on-device per the spec — RN screens have no unit-test harness in this repo).

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/constants/__tests__/sports.test.ts`:

```typescript
import { primaryDayLabel } from '@/constants/sports';

describe('primaryDayLabel', () => {
  it('labels the primary discipline by sport', () => {
    expect(primaryDayLabel('swim')).toBe('Swim days per week');
    expect(primaryDayLabel('rowing')).toBe('Row days per week');
  });

  it('defaults to run days for run-based and non-endurance goals', () => {
    expect(primaryDayLabel('run')).toBe('Run days per week');
    expect(primaryDayLabel('hybrid')).toBe('Run days per week');
    expect(primaryDayLabel('hyrox')).toBe('Run days per week');
    expect(primaryDayLabel('lift')).toBe('Run days per week');
    expect(primaryDayLabel(null)).toBe('Run days per week');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/constants/__tests__/sports.test.ts`
Expected: FAIL — `@/constants/sports` does not exist ("Cannot find module").

- [ ] **Step 3: Create the helper**

Create `OSPREY-app/src/constants/sports.ts`:

```typescript
import type { PrimaryGoal } from '@/types/onboarding';

// Label for the onboarding schedule picker's PRIMARY-discipline row. The store
// field behind it is still `weeklyRunDays` (see onboardingStore), but for a
// swim/row athlete it means "primary endurance days per week" — the edge fn
// routes that count to the correct discipline via the athlete's primary_goal
// (see supabase/functions/ozzie-generate-plan/goals.ts). Only the label varies.
// Hyrox trains via running + strength, so it keeps the "Run days" label.
export function primaryDayLabel(goal: PrimaryGoal | null): string {
  if (goal === 'swim') return 'Swim days per week';
  if (goal === 'rowing') return 'Row days per week';
  return 'Run days per week';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/constants/__tests__/sports.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the three onboarding sport chips**

In `OSPREY-app/app/(onboarding)/goals.tsx:8`, extend `GOALS` (order: run/lift/hybrid, then the new sports, then weight_loss — keeps the two "outcome" goals grouped last):

```typescript
const GOALS: Array<{ id: PrimaryGoal; icon: string; title: string; desc: string }> = [
  { id: 'run', icon: '🏃', title: 'Run better', desc: '5K, 10K, half, full marathon' },
  { id: 'lift', icon: '🏋️', title: 'Get stronger', desc: 'Lift more, build muscle' },
  { id: 'hybrid', icon: '⚡', title: 'Hybrid athlete', desc: 'Run and lift — both matter' },
  { id: 'swim', icon: '🏊', title: 'Swim faster', desc: 'Pool or open water — CSS-paced zones' },
  { id: 'rowing', icon: '🚣', title: 'Row stronger', desc: 'Erg or water — 2k-split zones' },
  { id: 'hyrox', icon: '🏋️‍♂️', title: 'Hyrox', desc: 'Run + functional strength stations' },
  { id: 'weight_loss', icon: '⚖️', title: 'Lose weight', desc: 'Performance + body composition' },
];
```

- [ ] **Step 6: Make the schedule picker label sport-aware**

In `OSPREY-app/app/(onboarding)/goals.tsx`, add the import near the top (with the other `@/` imports):

```typescript
import { primaryDayLabel } from '@/constants/sports';
```

Then replace the primary DayPicker line (`:78`):

```typescript
        <DayPicker label="Run days per week" value={weeklyRunDays} onChange={setWeeklyRunDays} />
```

with:

```typescript
        <DayPicker label={primaryDayLabel(primaryGoal)} value={weeklyRunDays} onChange={setWeeklyRunDays} />
```

(Leave the "Lift days per week" picker unchanged — swim/row/hyrox all pair with strength.)

- [ ] **Step 7: Add the three plan-builder options**

In `OSPREY-app/app/preferences.tsx` (`GOAL_OPTIONS`), add the sports after `triathlon` (grouping the sport-goals together, `weight_loss` stays last):

```typescript
  { value: 'triathlon', label: '🏊 Triathlon / Multisport' },
  { value: 'swim', label: '🏊 Swimming' },
  { value: 'rowing', label: '🚣 Rowing' },
  { value: 'hyrox', label: '🏋️‍♂️ Hyrox' },
  { value: 'weight_loss', label: '🔥 Weight Loss' },
```

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no new errors. (`GOAL_OPTIONS` values are `TrainingGoal`; `GOALS` ids are `PrimaryGoal` — both widened in Task 2.)

- [ ] **Step 9: Commit**

```bash
git add OSPREY-app/src/constants/sports.ts OSPREY-app/src/constants/__tests__/sports.test.ts "OSPREY-app/app/(onboarding)/goals.tsx" OSPREY-app/app/preferences.tsx
git commit -m "feat(app): expose swim/rowing/hyrox in onboarding + plan-builder pickers (2b-i)"
```

---

### Task 4: Pure primary-sport day routing (`goals.ts`, Deno)

**Files:**
- Create: `supabase/functions/ozzie-generate-plan/goals.ts`
- Create: `supabase/functions/ozzie-generate-plan/goals.test.ts`

**Interfaces:**
- Produces:
  - `type EnduranceDiscipline = 'run' | 'swim' | 'rowing'`
  - `const ENDURANCE_PRIMARY: Record<string, EnduranceDiscipline>`
  - `interface DisciplineDays { weeklyRunDays; weeklyLiftDays; weeklySwimDays; weeklyBikeDays; weeklyRowDays }` (all `number`)
  - `function routeDisciplineDays(primaryGoal: string, primaryDays: number, liftDays: number, includeSwim: boolean, includeBike: boolean): DisciplineDays`
- Consumed by: Task 5 (`index.ts`), in both the preferences and background-regen paths.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/ozzie-generate-plan/goals.test.ts`:

```typescript
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { routeDisciplineDays } from './goals.ts';

Deno.test('run primary keeps run days — bit-for-bit legacy behavior', () => {
  const r = routeDisciplineDays('run', 3, 2, false, false);
  assertEquals(r.weeklyRunDays, 3);
  assertEquals(r.weeklyLiftDays, 2);
  assertEquals(r.weeklySwimDays, 0);
  assertEquals(r.weeklyBikeDays, 0);
  assertEquals(r.weeklyRowDays, 0);
});

Deno.test('hybrid primary routes to run', () => {
  assertEquals(routeDisciplineDays('hybrid', 4, 2, false, false).weeklyRunDays, 4);
});

Deno.test('swim primary routes the primary days to swim, zero run/row', () => {
  const r = routeDisciplineDays('swim', 4, 1, false, false);
  assertEquals(r.weeklySwimDays, 4);
  assertEquals(r.weeklyRunDays, 0);
  assertEquals(r.weeklyRowDays, 0);
  assertEquals(r.weeklyLiftDays, 1);
});

Deno.test('rowing primary routes the primary days to rowing, zero run', () => {
  const r = routeDisciplineDays('rowing', 4, 1, false, false);
  assertEquals(r.weeklyRowDays, 4);
  assertEquals(r.weeklyRunDays, 0);
  assertEquals(r.weeklySwimDays, 0);
});

Deno.test('hyrox primary routes to run (run + strength)', () => {
  assertEquals(routeDisciplineDays('hyrox', 3, 2, false, false).weeklyRunDays, 3);
});

Deno.test('cross-training toggles add one day each without stealing primary swim days', () => {
  const runner = routeDisciplineDays('run', 3, 2, true, true);
  assertEquals(runner.weeklySwimDays, 1);
  assertEquals(runner.weeklyBikeDays, 1);
  // A swimmer with includeSwim keeps their full primary swim count, not 1.
  const swimmer = routeDisciplineDays('swim', 4, 1, true, false);
  assertEquals(swimmer.weeklySwimDays, 4);
});

Deno.test('unknown / non-endurance goal falls back to run primary', () => {
  assertEquals(routeDisciplineDays('weight_loss', 3, 2, false, false).weeklyRunDays, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/ozzie-generate-plan/goals.test.ts`
Expected: FAIL — `./goals.ts` does not exist (module-not-found).

- [ ] **Step 3: Implement `goals.ts`**

Create `supabase/functions/ozzie-generate-plan/goals.ts`:

```typescript
// Pure day-count routing for the weekly plan generator.
//
// The athlete's "primary endurance days" count (persisted historically as
// user_goals.weekly_run_days) is routed to whichever discipline their
// primary_goal implies — so a swimmer's training days become SWIM days, not
// run days. Cross-training toggles (includeSwim/includeBike) add one secondary
// day each, but never override a primary swim count.
//
// Invariant: for primaryGoal 'run' and 'hybrid' the output is identical to the
// pre-2b logic (run gets the primary days; swim/bike come only from the
// toggles; row is 0). Do not regress this.

export type EnduranceDiscipline = 'run' | 'swim' | 'rowing';

// Goals whose *primary* training discipline is an endurance sport. Anything not
// listed (lift, weight_loss, general_fitness, triathlon, unknown) falls back to
// 'run', preserving the historical run-weighted split for those goals.
export const ENDURANCE_PRIMARY: Record<string, EnduranceDiscipline> = {
  run: 'run',
  hybrid: 'run',
  hyrox: 'run',
  swim: 'swim',
  rowing: 'rowing',
};

export interface DisciplineDays {
  weeklyRunDays: number;
  weeklyLiftDays: number;
  weeklySwimDays: number;
  weeklyBikeDays: number;
  weeklyRowDays: number;
}

export function routeDisciplineDays(
  primaryGoal: string,
  primaryDays: number,
  liftDays: number,
  includeSwim: boolean,
  includeBike: boolean,
): DisciplineDays {
  const discipline = ENDURANCE_PRIMARY[primaryGoal] ?? 'run';
  return {
    weeklyRunDays: discipline === 'run' ? primaryDays : 0,
    weeklyLiftDays: liftDays,
    weeklySwimDays: discipline === 'swim' ? primaryDays : includeSwim ? 1 : 0,
    weeklyBikeDays: includeBike ? 1 : 0,
    weeklyRowDays: discipline === 'rowing' ? primaryDays : 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/ozzie-generate-plan/goals.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/goals.ts supabase/functions/ozzie-generate-plan/goals.test.ts
git commit -m "feat(edge): pure primary-sport day routing helper (2b-i)"
```

---

### Task 5: Wire the edge function to the sport goals

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` — `GoalsContext` (`:40`), `PLAN_SYSTEM_PROMPT` (`:29,33,37`), user message (`:329`), `PRIMARY_GOAL_MAP` (`:447`), preferences day-split (`:462-514`), background-regen goals (`:540-555`).

**Interfaces:**
- Consumes: `routeDisciplineDays`, `DisciplineDays` from `./goals.ts` (Task 4); the enum values from Task 1.
- Produces: nothing new for later tasks — this is the terminal integration of 2b-i.

This is integration wiring of already-tested pure logic (`goals.ts`) into the request handler. `index.ts` performs DB/network work and is not unit-tested (matching the repo pattern where `validate.ts`/`goals.ts` are pure+tested and `index.ts` is not). Verification: the pure suites stay green, `deno check` introduces no new type errors, and the reviewer confirms the run/hybrid path is byte-identical.

- [ ] **Step 1: Import the helper**

At the top of `index.ts`, beside `import { validateAndClamp } from './validate.ts';` (`:9`), add:

```typescript
import { routeDisciplineDays, type DisciplineDays } from './goals.ts';
```

- [ ] **Step 2: Add `weeklyRowDays` to `GoalsContext`**

In the `GoalsContext` interface (`:40`), add the field beside `weeklyBikeDays`:

```typescript
interface GoalsContext {
  primaryGoal: string | null;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  weeklySwimDays?: number;
  weeklyBikeDays?: number;
  weeklyRowDays?: number;
  triathlonDistance?: string | null;
  fitnessLevel: string;
  targetRace: string | null;
}
```

- [ ] **Step 3: Allow rowing in the prompt**

In `PLAN_SYSTEM_PROMPT`, make three edits:

`:29` — add `rowing` to the session_type list:
```
- session_type must be one of: run, lift, swim, bike, rowing, cross, rest, race.
```

`:33` — add rowing to the distance rule (replace "for run, race, swim, and bike sessions"):
```
- planned_distance_km: for run, race, swim, bike, and rowing sessions — a reasonable distance for the session's duration, intensity, and the athlete's level (e.g. an easy run duration implies roughly a 9-11 min/mile pace, swims are much shorter than runs for the same duration). null for lift, cross, and rest days.
```

`:37` — in the `interval_prescription` rule, add a rowing clause to the segment-unit guidance (after the bike/run segment sentence, before "effort must be one of"):
```
rowing segments use distanceM (e.g. 250/500/1000) for interval pieces or durationS for steady blocks.
```

- [ ] **Step 4: Emit row days in the user message**

In the user-message template (`:329`), add the row-days clause right after the bike-days clause:

```typescript
          content: `Build this week's plan for a ${goals.fitnessLevel} athlete. Goal: ${goals.primaryGoal ?? 'general fitness'}${goals.targetRace ? `, target race: ${goals.targetRace}` : ''}. Weekly run days: ${goals.weeklyRunDays}. Weekly lift days: ${goals.weeklyLiftDays}.${goals.weeklySwimDays ? ` Weekly swim days: ${goals.weeklySwimDays}.` : ''}${goals.weeklyBikeDays ? ` Weekly bike days: ${goals.weeklyBikeDays}.` : ''}${goals.weeklyRowDays ? ` Weekly row days: ${goals.weeklyRowDays}.` : ''}${goals.triathlonDistance ? ` triathlonDistance: ${goals.triathlonDistance}.` : ''} trainingLoad: ${JSON.stringify(trainingLoad)}.${envelopeGuidance}`,
```

- [ ] **Step 5: Add the sport entries to `PRIMARY_GOAL_MAP`**

At `:447`, extend the map (and update its comment to note the new enum values from Task 1):

```typescript
    // Maps preferences.tsx's TrainingGoal values to the DB's primary_goal_enum
    // ('run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness' | 'triathlon'
    //  | 'swim' | 'rowing' | 'hyrox' — the last three added in 20260714000003).
    const PRIMARY_GOAL_MAP: Record<string, string> = {
      hybrid: 'hybrid',
      run_performance: 'run',
      strength: 'lift',
      weight_loss: 'weight_loss',
      general: 'general_fitness',
      triathlon: 'triathlon',
      swim: 'swim',
      rowing: 'rowing',
      hyrox: 'hyrox',
    };
```

- [ ] **Step 6: Route the preferences-path day-split by primary sport**

Replace the preferences branch body (`:466-500`, from `const isTriathlon` through the `goals = { … };` assignment) with the version below. It preserves triathlon exactly, routes everything else via `routeDisciplineDays`, and captures `primaryDaysForStorage` so the upsert persists the *primary* count (not the routed run count, which is 0 for a swimmer):

```typescript
      const isTriathlon = mappedGoal === 'triathlon';

      let routed: DisciplineDays;
      // Persisted to user_goals.weekly_run_days as "primary endurance days";
      // the background-regen path re-routes it by primary_goal (Step 8).
      let primaryDaysForStorage: number;

      if (isTriathlon) {
        // Split days roughly evenly across all four disciplines, each
        // guaranteed at least 1 day whenever the weekly total allows it.
        const total = prefs.daysPerWeek;
        const weeklyBikeDays = Math.max(1, Math.round(total * 0.3));
        const weeklySwimDays = Math.max(1, Math.round(total * 0.2));
        const weeklyLiftDays = Math.max(1, Math.round(total * 0.2));
        const weeklyRunDays = Math.max(1, total - weeklyBikeDays - weeklySwimDays - weeklyLiftDays);
        routed = { weeklyRunDays, weeklyLiftDays, weeklySwimDays, weeklyBikeDays, weeklyRowDays: 0 };
        primaryDaysForStorage = weeklyRunDays;
      } else {
        const primaryDays = prefs.daysPerWeek >= 2 ? Math.ceil(prefs.daysPerWeek * 0.6) : 2;
        const liftDays = prefs.daysPerWeek >= 2 ? Math.floor(prefs.daysPerWeek * 0.4) : 1;
        // includeSwim/includeBike surface as one dedicated secondary day each.
        routed = routeDisciplineDays(mappedGoal, primaryDays, liftDays, !!prefs.includeSwim, !!prefs.includeBike);
        primaryDaysForStorage = primaryDays;
      }

      goals = {
        primaryGoal: mappedGoal,
        weeklyRunDays: routed.weeklyRunDays,
        weeklyLiftDays: routed.weeklyLiftDays,
        weeklySwimDays: routed.weeklySwimDays,
        weeklyBikeDays: routed.weeklyBikeDays,
        weeklyRowDays: routed.weeklyRowDays,
        triathlonDistance: isTriathlon ? prefs.triathlonDistance ?? 'sprint' : null,
        fitnessLevel: prefs.experienceLevel ?? 'beginner',
        targetRace: null,
      };
```

- [ ] **Step 7: Persist the primary day count (not the routed run count)**

In the `user_goals` upsert immediately below (the `weekly_run_days:` line, ~`:508`), change it to store the primary count so a swimmer's days survive background regeneration:

```typescript
          weekly_run_days: primaryDaysForStorage,
          weekly_lift_days: goals.weeklyLiftDays,
```

(For run/hybrid, `primaryDaysForStorage === goals.weeklyRunDays`, so this is unchanged for them.)

- [ ] **Step 8: Route the background-regen path by primary sport**

Replace the fallback `else` branch's `goals = { … }` (`:548-554`) so a stored swim/row goal re-routes its persisted primary days:

```typescript
      const bgGoal = goalsRow?.primary_goal ?? 'hybrid';
      const bgPrimaryDays = goalsRow?.weekly_run_days ?? 3;
      const bgLiftDays = goalsRow?.weekly_lift_days ?? 2;
      const bgRouted = routeDisciplineDays(bgGoal, bgPrimaryDays, bgLiftDays, false, false);

      goals = {
        primaryGoal: bgGoal,
        weeklyRunDays: bgRouted.weeklyRunDays,
        weeklyLiftDays: bgRouted.weeklyLiftDays,
        weeklySwimDays: bgRouted.weeklySwimDays,
        weeklyBikeDays: bgRouted.weeklyBikeDays,
        weeklyRowDays: bgRouted.weeklyRowDays,
        fitnessLevel: goalsRow?.fitness_level ?? 'beginner',
        targetRace: goalsRow?.target_race ?? null,
      };
```

(For run/hybrid, `bgRouted.weeklyRunDays === weekly_run_days` and swim/bike/row are 0 — the user message gates each on truthiness, so the prompt is identical to today for those goals.)

- [ ] **Step 9: Verify the pure suites still pass**

Run: `deno test supabase/functions/ozzie-generate-plan/`
Expected: PASS — `goals.test.ts` (7) and `validate.test.ts` (9) all green.

- [ ] **Step 10: Typecheck the edge function (no NEW errors)**

Run: `deno check supabase/functions/ozzie-generate-plan/index.ts`
Expected: the ONLY errors reported are the ~26 pre-existing `@supabase/supabase-js` client typing errors documented in the 2a final-review roll-up. There must be **no** new error mentioning `goals.ts`, `routeDisciplineDays`, `weeklyRowDays`, `DisciplineDays`, or `primaryDaysForStorage`. If a new one appears, fix it before committing.

- [ ] **Step 11: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/index.ts
git commit -m "feat(edge): route swim/rowing/hyrox goals through the plan generator (2b-i)"
```

---

## Post-implementation (controller)

- Apply `20260714000003_sport_primary_goals.sql` via Supabase MCP `apply_migration` (safe pre-launch; backward-compatible).
- The edge-fn deploy (`ozzie-generate-plan`) is bundled into the go-live runbook (`docs/DEPLOY-CHECKLIST.md`) — deploy app + edge fn together.
- Known limitation to record (not a 2b-i defect): the triathlon background-regen path remains run-collapsed (pre-existing; `ENDURANCE_PRIMARY` has no `triathlon` key, so it defaults to run — unchanged from before this slice). Full triathlon fidelity is 2c.

## Self-Review

**Spec coverage** (against `2026-07-14-coaching-engine-phase2b-design.md` §2 + §9's 2b-i):
- PrimaryGoal type → Task 2. ✅
- Onboarding `goals.tsx` chips → Task 3. ✅ (+ sport-aware schedule label, per the "both surfaces" decision.)
- TrainingGoal + ONBOARDING_GOAL_TO_PREFERENCES → Task 2. ✅
- Plan-builder `preferences.tsx` options → Task 3. ✅
- Edge-fn PRIMARY_GOAL_MAP swim/rowing/hyrox → Task 5 (Step 5). ✅
- GoalsContext.weeklyRowDays + population + user message → Task 5 (Steps 2, 4, 6, 8). ✅
- PLAN_SYSTEM_PROMPT session_type + rules incl. rowing → Task 5 (Step 3). ✅
- **Added beyond §2** (surfaced while planning, confirmed with the human): the `primary_goal_enum` migration (Task 1 — §2 assumed the value was storable; it isn't) and the primary-sport-aware day-split (`goals.ts`, Task 4 — §2 said "mirror weeklySwimDays", which is the cross-training pattern and would give a swimmer a run-heavy plan). Both are necessary for the activation to actually work.

**Placeholder scan:** none — every step has concrete code/commands and expected output.

**Type consistency:** `routeDisciplineDays` / `DisciplineDays` / `ENDURANCE_PRIMARY` signatures match between Task 4 (definition) and Task 5 (use). `PrimaryGoal`/`TrainingGoal` widened in Task 2 before Task 3 consumes them. `GoalsContext.weeklyRowDays?` optional, gated by truthiness everywhere it's read. `primaryDaysForStorage` defined in both branches of the Task 5 Step 6 if/else before use in Step 7.
