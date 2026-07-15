# Coaching-Engine Phase 2c-i-a — Turn Cycling On — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cycling a selectable primary sport that generates bike-focused plans (heart-rate-guided via 2b-iii). Pure sport-selection + day-routing — mirrors 2b-i.

**Architecture:** Add `cycling` to the goal vocab (types + both pickers + the mapping tables + the edge-fn `PRIMARY_GOAL_MAP`), a `primary_goal_enum` migration, and route a cycling athlete's training days to the bike (`routeDisciplineDays`). No zone-math, `ZoneSet`, `computeEnvelope`, or `validate.ts` changes — a cyclist's `zones` stay `null`, so 2b-iii's universal HR zones carry their intensity guidance. Power (FTP) zones are the follow-up, 2c-i-b.

**Tech Stack:** React Native / Expo (app), TypeScript, Jest (`TZ=Asia/Kolkata jest`), Deno edge functions (`deno test`/`deno check`), Supabase Postgres enums.

## Global Constraints

- **TDD.** App: `npm test` from `OSPREY-app/`. Edge fn: `deno test <file>`.
- **`routeDisciplineDays` run/hybrid output byte-identical** — the cycling case is additive; a regression test pins it (like 2b-i).
- **Migrations via MCP, not `db push`** (history drift — see `docs/DEPLOY-CHECKLIST.md`). The migration file is the repo artifact; the controller applies it via `apply_migration` at go-live. `ALTER TYPE … ADD VALUE IF NOT EXISTS` is idempotent + backward-compatible.
- **No `validate.ts`, `ZoneSet`, `computeEnvelope`, or calculator change** — those are all 2c-i-b.
- **Path alias** `@/` → `OSPREY-app/src`. Deno assert: `https://deno.land/std@0.224.0/assert/mod.ts`. Lint `no-restricted-syntax` clean.
- **`session_type_enum` already has `'bike'`** — do NOT add a session_type migration.

---

## File Structure

**New files:**
- `supabase/migrations/20260715000001_cycling_primary_goal.sql`

**Modified files:**
- `OSPREY-app/src/types/onboarding.ts` — `PrimaryGoal += 'cycling'`.
- `OSPREY-app/src/types/preferences.ts` — `TrainingGoal += 'cycling'`.
- `OSPREY-app/src/services/onboarding.ts` — `ONBOARDING_GOAL_TO_PREFERENCES.cycling`.
- `OSPREY-app/src/constants/sports.ts` — `primaryDayLabel` cycling case.
- `OSPREY-app/app/(onboarding)/goals.tsx` — Cycling `GOALS` chip.
- `OSPREY-app/app/preferences.tsx` — Cycling `GOAL_OPTIONS` option.
- `OSPREY-app/src/services/__tests__/onboarding.test.ts` + `OSPREY-app/src/constants/__tests__/sports.test.ts` — assertions.
- `supabase/functions/ozzie-generate-plan/goals.ts` — `EnduranceDiscipline`/`ENDURANCE_PRIMARY`/`routeDisciplineDays` cycling.
- `supabase/functions/ozzie-generate-plan/goals.test.ts` — cycling routing + regression.
- `supabase/functions/ozzie-generate-plan/index.ts` — `PRIMARY_GOAL_MAP.cycling`.

---

### Task 1: Migration — add `cycling` to `primary_goal_enum`

**Files:**
- Create: `supabase/migrations/20260715000001_cycling_primary_goal.sql`

**Interfaces:**
- Produces: the DB can store `primary_goal = 'cycling'` (Tasks 2/3 write it).

DDL migration — no automated test. Verification is SQL correctness + the controller applying via MCP.

- [ ] **Step 1: Write the migration file**

```sql
-- Phase 2c-i-a: make cycling a selectable primary goal.
--
-- Mirrors the swim/rowing/hyrox addition (20260714000003) and the triathlon
-- precedent (20260702000021). session_type_enum already has 'bike'
-- (20260702000015), so bike sessions store fine — only primary_goal_enum needs
-- the new value. ADD VALUE IF NOT EXISTS is idempotent and backward-compatible.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'cycling';
```

- [ ] **Step 2: Verify it matches the established enum-add pattern**

Run: `cat supabase/migrations/20260714000003_sport_primary_goals.sql`
Expected: the new file uses the same `ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS` form.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260715000001_cycling_primary_goal.sql
git commit -m "feat(db): add cycling to primary_goal_enum (2c-i-a)"
```

> **Controller note (not a subagent step):** apply via Supabase MCP `apply_migration` (name `cycling_primary_goal`) at go-live, alongside the pending `20260714000003`. Do NOT `db push`.

---

### Task 2: App-side cycling — goal vocab, mapping, label, pickers

**Files:**
- Modify: `OSPREY-app/src/types/onboarding.ts`, `OSPREY-app/src/types/preferences.ts`, `OSPREY-app/src/services/onboarding.ts`, `OSPREY-app/src/constants/sports.ts`, `OSPREY-app/app/(onboarding)/goals.tsx`, `OSPREY-app/app/preferences.tsx`
- Test: `OSPREY-app/src/services/__tests__/onboarding.test.ts`, `OSPREY-app/src/constants/__tests__/sports.test.ts`

**Interfaces:**
- Produces: `PrimaryGoal`/`TrainingGoal` gain `'cycling'`; `ONBOARDING_GOAL_TO_PREFERENCES.cycling === 'cycling'`; `primaryDayLabel('cycling') === 'Ride days per week'`. Task 3's `PRIMARY_GOAL_MAP` mirrors the same string.

- [ ] **Step 1: Write the failing tests**

Add to `OSPREY-app/src/services/__tests__/onboarding.test.ts` (inside the existing `describe('ONBOARDING_GOAL_TO_PREFERENCES', …)`):

```typescript
  it('maps cycling to the cycling plan-builder goal', () => {
    expect(ONBOARDING_GOAL_TO_PREFERENCES.cycling).toBe('cycling');
  });
```

Add to `OSPREY-app/src/constants/__tests__/sports.test.ts` (inside the existing `describe('primaryDayLabel', …)`):

```typescript
  it('labels cycling as ride days', () => {
    expect(primaryDayLabel('cycling')).toBe('Ride days per week');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/onboarding.test.ts src/constants/__tests__/sports.test.ts`
Expected: FAIL — `.cycling` is `undefined` / not a valid `PrimaryGoal` (ts-jest type error), and `primaryDayLabel('cycling')` returns "Run days per week".

- [ ] **Step 3: Widen the unions**

In `OSPREY-app/src/types/onboarding.ts`, add `| 'cycling'` to `PrimaryGoal` (after `'hyrox'`):
```typescript
  | 'hyrox'
  | 'cycling';
```

In `OSPREY-app/src/types/preferences.ts`, add `| 'cycling'` to `TrainingGoal` (after `'hyrox'`):
```typescript
  | 'hyrox'
  | 'cycling';
```

- [ ] **Step 4: Extend the mapping + label**

In `OSPREY-app/src/services/onboarding.ts`, add to `ONBOARDING_GOAL_TO_PREFERENCES` (the `Record<PrimaryGoal, TrainingGoal>` now requires it):
```typescript
  hyrox: 'hyrox',
  cycling: 'cycling',
};
```

In `OSPREY-app/src/constants/sports.ts`, add the cycling case to `primaryDayLabel` (before the swim/rowing lines is fine; keep the default last):
```typescript
export function primaryDayLabel(goal: PrimaryGoal | null): string {
  if (goal === 'swim') return 'Swim days per week';
  if (goal === 'rowing') return 'Row days per week';
  if (goal === 'cycling') return 'Ride days per week';
  return 'Run days per week';
}
```

- [ ] **Step 5: Add the picker entries**

In `OSPREY-app/app/(onboarding)/goals.tsx`, add a Cycling chip to `GOALS` (before the `weight_loss` entry):
```typescript
  { id: 'hyrox', icon: '🏋️‍♂️', title: 'Hyrox', desc: 'Run + functional strength stations' },
  { id: 'cycling', icon: '🚴', title: 'Ride faster', desc: 'Road or indoor — power & HR zones' },
  { id: 'weight_loss', icon: '⚖️', title: 'Lose weight', desc: 'Performance + body composition' },
```

In `OSPREY-app/app/preferences.tsx`, add a Cycling option to `GOAL_OPTIONS` (after the `hyrox` entry):
```typescript
  { value: 'hyrox', label: '🏋️‍♂️ Hyrox' },
  { value: 'cycling', label: '🚴 Cycling' },
  { value: 'weight_loss', label: '🔥 Weight Loss' },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/onboarding.test.ts src/constants/__tests__/sports.test.ts`
Expected: PASS. Then `npm run typecheck` — clean (the widened unions make the new picker values valid; `ONBOARDING_GOAL_TO_PREFERENCES` is the only `Record<PrimaryGoal,…>`, now satisfied).

- [ ] **Step 7: Commit**

```bash
git add OSPREY-app/src/types/onboarding.ts OSPREY-app/src/types/preferences.ts OSPREY-app/src/services/onboarding.ts OSPREY-app/src/constants/sports.ts "OSPREY-app/app/(onboarding)/goals.tsx" OSPREY-app/app/preferences.tsx OSPREY-app/src/services/__tests__/onboarding.test.ts OSPREY-app/src/constants/__tests__/sports.test.ts
git commit -m "feat(app): add cycling to the goal vocab + pickers + ride-days label (2c-i-a)"
```

---

### Task 3: Edge-fn — route cycling to the bike + map the goal

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/goals.ts` (`EnduranceDiscipline`, `ENDURANCE_PRIMARY`, `routeDisciplineDays`)
- Modify: `supabase/functions/ozzie-generate-plan/index.ts` (`PRIMARY_GOAL_MAP`)
- Test: `supabase/functions/ozzie-generate-plan/goals.test.ts`

**Interfaces:**
- Consumes: `primary_goal = 'cycling'` (Tasks 1/2).
- Produces: a cycling-primary athlete's main day count routes to `weeklyBikeDays`; `PRIMARY_GOAL_MAP.cycling === 'cycling'`.

- [ ] **Step 1: Write the failing test**

Add to `supabase/functions/ozzie-generate-plan/goals.test.ts`:

```typescript
Deno.test('cycling primary routes the primary days to bike, zero run', () => {
  const r = routeDisciplineDays('cycling', 5, 2, false, false);
  assertEquals(r.weeklyBikeDays, 5);
  assertEquals(r.weeklyRunDays, 0);
  assertEquals(r.weeklySwimDays, 0);
  assertEquals(r.weeklyRowDays, 0);
  assertEquals(r.weeklyLiftDays, 2);
});

Deno.test('run/hybrid bike days unchanged by the cycling case (regression)', () => {
  // run primary, no includeBike → bike days still 0
  assertEquals(routeDisciplineDays('run', 3, 2, false, false).weeklyBikeDays, 0);
  // run primary WITH includeBike → still exactly 1 cross-training bike day
  assertEquals(routeDisciplineDays('run', 3, 2, false, true).weeklyBikeDays, 1);
  assertEquals(routeDisciplineDays('run', 3, 2, false, true).weeklyRunDays, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/ozzie-generate-plan/goals.test.ts`
Expected: FAIL — `cycling` isn't in `ENDURANCE_PRIMARY`, so it falls to `'run'` → `weeklyBikeDays` 0 (not 5), `weeklyRunDays` 5 (not 0).

- [ ] **Step 3: Add cycling to the routing**

In `supabase/functions/ozzie-generate-plan/goals.ts`:

Widen `EnduranceDiscipline`:
```typescript
export type EnduranceDiscipline = 'run' | 'swim' | 'rowing' | 'cycling';
```

Add to `ENDURANCE_PRIMARY`:
```typescript
  swim: 'swim',
  rowing: 'rowing',
  cycling: 'cycling',
};
```

Route the bike day count in `routeDisciplineDays` — change the `weeklyBikeDays` line:
```typescript
    weeklyRunDays: discipline === 'run' ? primaryDays : 0,
    weeklyLiftDays: liftDays,
    weeklySwimDays: discipline === 'swim' ? primaryDays : includeSwim ? 1 : 0,
    weeklyBikeDays: discipline === 'cycling' ? primaryDays : includeBike ? 1 : 0,
    weeklyRowDays: discipline === 'rowing' ? primaryDays : 0,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/ozzie-generate-plan/goals.test.ts`
Expected: PASS (cycling routing + the run/hybrid regression).

- [ ] **Step 5: Map the goal in the edge fn**

In `supabase/functions/ozzie-generate-plan/index.ts`, add to `PRIMARY_GOAL_MAP`:
```typescript
      rowing: 'rowing',
      hyrox: 'hyrox',
      cycling: 'cycling',
    };
```

- [ ] **Step 6: Verify the edge-fn suites + typecheck**

Run: `deno test supabase/functions/ozzie-generate-plan/`
Expected: PASS — `goals.test.ts` (now +2), plus `guidance.test.ts` (3) and `validate.test.ts` (9) unchanged/green.

Run: `deno check supabase/functions/ozzie-generate-plan/index.ts`
Expected: only the ~26 pre-existing `@supabase/supabase-js` typing errors — none referencing the `PRIMARY_GOAL_MAP` change.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ozzie-generate-plan/goals.ts supabase/functions/ozzie-generate-plan/goals.test.ts supabase/functions/ozzie-generate-plan/index.ts
git commit -m "feat(edge): route cycling to bike days + map the goal (2c-i-a)"
```

---

## Post-implementation
App + edge fn deploy together at go-live (`PRIMARY_GOAL_MAP` + `routeDisciplineDays`), and apply `20260715000001` via MCP alongside the pending `20260714000003`. All recorded in the existing `docs/DEPLOY-CHECKLIST.md` pending-redeploy note. On-device check: onboard as Cycling, confirm the schedule picker reads "Ride days per week" and the generated plan is bike-focused (bike sessions with HR guidance). `validate.ts` untouched.

## Self-Review

**Spec coverage** (against `2026-07-15-coaching-engine-phase2c-i-a-design.md`):
- §2 sport selection (types, pickers, `ONBOARDING_GOAL_TO_PREFERENCES`, `PRIMARY_GOAL_MAP`) → Tasks 2 + 3. ✅
- §3 migration → Task 1. ✅
- §4 day-routing (`EnduranceDiscipline`/`ENDURANCE_PRIMARY`/`routeDisciplineDays` cycling → bike) → Task 3. ✅
- §5 does NOT touch ZoneSet/validate/computeEnvelope → no such task; the plan adds none. ✅
- §7 TDD (mapping, label, routing + regression) → Tasks 2 + 3. ✅

**Placeholder scan:** none — every step has concrete code/commands. The one `>` note is an explicit controller instruction.

**Type consistency:** `PrimaryGoal`/`TrainingGoal` widened in Task 2 before the pickers use `'cycling'`; `ONBOARDING_GOAL_TO_PREFERENCES` (Record over the widened `PrimaryGoal`) forces the entry; `EnduranceDiscipline` (Task 3) gains `'cycling'` consumed by `ENDURANCE_PRIMARY`/`routeDisciplineDays`. The stored `primary_goal` string `'cycling'` is consistent across the enum (Task 1), `PRIMARY_GOAL_MAP` (Task 3), and `ENDURANCE_PRIMARY` (Task 3).
