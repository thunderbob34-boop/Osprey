# Plan 002: Unify the TSB → readiness thresholds into one source of truth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 6e36c9c..HEAD -- OSPREY-app/src/services/performance.ts OSPREY-app/src/hooks/usePlanAdaptation.ts OSPREY-app/src/services/daily-summary.ts`
> If any listed file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt (correctness/coherence)
- **Planned at**: commit `6e36c9c`, 2026-07-13

## Why this matters

Three separate functions map TSB → a human-facing readiness state, each with
**different thresholds and different vocabulary**:

| Source | Thresholds | Labels |
|---|---|---|
| `readinessFromTsb` (performance.ts) | >15 / >5 / ≥-5 / ≥-15 / ≥-25 / else | Peak Fresh, Fresh, Ready, Carrying Load, Fatigued, Overreached |
| `usePlanAdaptation` (hook) | <-20 / <-10 / >15 | (warning/info/positive alerts) |
| `loadLabelFromTsb` (daily-summary.ts) | >5 / ≥-10 / else | Fresh, Moderate, Fatigued |

At `tsb = -12` the app tells the same athlete, on different screens, that they
are "Carrying Load" (performance), "Fatigued" (daily summary), **and** that
"Moderate fatigue detected — your next plan will auto-reduce intensity"
(adaptation alert). The boundaries don't line up (-10 vs -15; -20 vs -25), so
the copy contradicts itself and there is no single place to tune the model. This
plan introduces one shared TSB-zone function and routes all three consumers
through it, so the thresholds are defined once and the screens agree.

## Current state

All paths relative to `OSPREY-app/`. Read each excerpt in the live file before
editing.

**1. `src/services/performance.ts:418-441`** — the canonical, most granular
ladder:

```ts
export function readinessFromTsb(tsb: number, ctl: number): TrainingReadiness {
  let label: string;
  let color: string;
  if (tsb > 15) {            // Peak Fresh
    label = 'Peak Fresh'; color = Colors.teal;
  } else if (tsb > 5) {      // Fresh
    label = 'Fresh'; color = Colors.green;
  } else if (tsb >= -5) {    // Ready
    label = 'Ready'; color = Colors.teal;
  } else if (tsb >= -15) {   // Carrying Load
    label = 'Carrying Load'; color = Colors.amber;
  } else if (tsb >= -25) {   // Fatigued
    label = 'Fatigued'; color = Colors.amber;
  } else {                   // Overreached
    label = 'Overreached'; color = Colors.red;
  }
  return { tsb: Math.round(tsb * 10) / 10, ctl: Math.round(ctl * 10) / 10, label, color };
}
```

**2. `src/hooks/usePlanAdaptation.ts:9-42`** — alert copy keyed off TSB:

```ts
export function usePlanAdaptation(): PlanAdaptationAlert | null {
  const { data, isLoading } = usePerformance();
  if (isLoading || !data) return null;
  if (data.ctl < 5) return null;
  const { tsb } = data;
  if (tsb < -20) { /* warning: "carrying heavy load … rebuild around recovery" */ }
  if (tsb < -10) { /* info: "Moderate fatigue … auto-reduce intensity" */ }
  if (tsb > 15)  { /* positive: "fresh and fit … push harder" */ }
  return null;
}
```

**3. `src/services/daily-summary.ts:66-71`** — compact label for the brief:

```ts
function loadLabelFromTsb(tsb: number | null): string {
  if (tsb == null) return '—';
  if (tsb > 5) return 'Fresh';
  if (tsb >= -10) return 'Moderate';
  return 'Fatigued';
}
```

Note: in `daily-summary.ts` the `tsb` value passed to `loadLabelFromTsb` comes
from a database view row (`row.tsb` at line ~346), **not** from
`computeAtlCtlTsb`. This plan does **not** change where that value comes from —
only how a TSB number is mapped to a label. Reconciling the two TSB
*computations* (view vs `computeAtlCtlTsb`) is explicitly out of scope.

**Type**: `TrainingReadiness` is defined in `src/types/daily-summary.ts` —
open it and confirm its shape (`{ tsb: number; ctl: number; label: string;
color: string }`) before reusing it.

### Design decision to preserve

`readinessFromTsb`'s six-zone ladder is the richest and is already unit-tested
(`performance.test.ts` → `describe('readinessFromTsb')`). **Treat its
boundaries as the canonical zone definition.** The other two consumers are
coarser views of the same zones; map them onto the canonical zones rather than
inventing a fourth set of numbers.

## Commands you will need

Run from `OSPREY-app/`.

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `npm install`                            | exit 0              |
| Typecheck | `npm run typecheck`                      | exit 0, no errors   |
| Tests     | `npm test -- performance`                | all pass            |
| Lint      | `npm run lint`                           | exit 0              |

> If typecheck/tests fail with "jest-expo preset not found", run `npm install`
> first. If `npm install` fails, STOP and report.

## Scope

**In scope**:
- `src/services/performance.ts` (add the shared zone function; refactor
  `readinessFromTsb` to use it)
- `src/hooks/usePlanAdaptation.ts` (route through the shared zones)
- `src/services/daily-summary.ts` (route `loadLabelFromTsb` through shared zones)
- `src/services/__tests__/performance.test.ts` (tests for the new function)

**Out of scope** (do NOT touch):
- The source of `row.tsb` in `daily-summary.ts` / the `v_daily_summary` DB view.
- `Colors` constants in `src/constants/colors.ts`.
- The alert *copy strings* in `usePlanAdaptation` — keep the exact wording;
  only the threshold each string fires at changes to match the canonical zones.
- Anything touching `computeAtlCtlTsb`'s math.

## Git workflow

- Branch: `advisor/002-unify-tsb-thresholds`
- Commit: `refactor(performance): single source of truth for TSB readiness zones`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a canonical TSB-zone function

In `src/services/performance.ts`, above `readinessFromTsb`, add a zone enum and
a single classifier that encodes the canonical boundaries exactly as
`readinessFromTsb` uses them today. Target shape:

```ts
export type TsbZone =
  | 'peak-fresh'    // tsb > 15
  | 'fresh'         // 5 < tsb <= 15
  | 'ready'         // -5 <= tsb <= 5
  | 'carrying-load' // -15 <= tsb < -5
  | 'fatigued'      // -25 <= tsb < -15
  | 'overreached';  // tsb < -25

export function tsbZone(tsb: number): TsbZone {
  if (tsb > 15) return 'peak-fresh';
  if (tsb > 5) return 'fresh';
  if (tsb >= -5) return 'ready';
  if (tsb >= -15) return 'carrying-load';
  if (tsb >= -25) return 'fatigued';
  return 'overreached';
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Refactor `readinessFromTsb` to use `tsbZone`

Rewrite the body of `readinessFromTsb` as a switch on `tsbZone(tsb)` that
produces the **same** `{ label, color }` pairs it produces today (Peak Fresh →
teal, Fresh → green, Ready → teal, Carrying Load → amber, Fatigued → amber,
Overreached → red). The public return value must be byte-for-byte identical to
before — the existing `readinessFromTsb` tests must pass unchanged.

**Verify**: `npm test -- performance` → the existing `describe('readinessFromTsb')`
cases still pass (no edits to those tests).

### Step 3: Route `loadLabelFromTsb` through the zones

In `src/services/daily-summary.ts`, import `tsbZone` from
`@/services/performance` and rewrite `loadLabelFromTsb` to derive its 3-way
label from the canonical zone instead of its own thresholds:

```ts
function loadLabelFromTsb(tsb: number | null): string {
  if (tsb == null) return '—';
  switch (tsbZone(tsb)) {
    case 'peak-fresh':
    case 'fresh':
      return 'Fresh';
    case 'ready':
    case 'carrying-load':
      return 'Moderate';
    default:               // fatigued, overreached
      return 'Fatigued';
  }
}
```

Note this **changes the boundaries** of the daily-summary label so they align
with the canonical zones (e.g. `tsb = -12` now reads "Moderate", consistent with
`readinessFromTsb`'s "Carrying Load", instead of the old "Fatigued"). That
alignment is the point of this plan.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Route `usePlanAdaptation` through the zones

In `src/hooks/usePlanAdaptation.ts`, import `tsbZone` and fire each alert on a
canonical zone boundary instead of its own `-10 / -20` cutoffs. Keep the alert
copy strings and `severity` values exactly as they are; only change the
conditions:

- `overreached` → the existing **warning** alert ("carrying heavy load …").
- `fatigued` → the existing **info** alert ("Moderate fatigue …").
- `peak-fresh` → the existing **positive** alert ("fresh and fit …").
- all other zones → `null` (no alert).

Keep the `if (data.ctl < 5) return null;` guard exactly as-is.

Target shape:

```ts
const zone = tsbZone(tsb);
if (zone === 'overreached') return { message: /* existing warning copy */, severity: 'warning', tsb };
if (zone === 'fatigued')    return { message: /* existing info copy */,    severity: 'info',    tsb };
if (zone === 'peak-fresh')  return { message: /* existing positive copy */,severity: 'positive',tsb };
return null;
```

**Verify**: `npm run typecheck` → exit 0.

### Step 5: Add unit tests for `tsbZone`

In `src/services/__tests__/performance.test.ts`, import `tsbZone` and add a
`describe` block with a boundary table (test each threshold and each side of it):

```ts
describe('tsbZone', () => {
  it.each([
    [16, 'peak-fresh'], [15, 'fresh'], [6, 'fresh'], [5, 'ready'],
    [0, 'ready'], [-5, 'ready'], [-6, 'carrying-load'], [-15, 'carrying-load'],
    [-16, 'fatigued'], [-25, 'fatigued'], [-26, 'overreached'],
  ])('classifies tsb %d as %s', (tsb, zone) => {
    expect(tsbZone(tsb)).toBe(zone);
  });
});
```

**Verify**: `npm test -- performance` → all pass, including the new `tsbZone`
block and the unchanged `readinessFromTsb` block.

## Test plan

- New: `describe('tsbZone')` boundary table (above).
- Unchanged and must still pass: `describe('readinessFromTsb')` — proves the
  refactor preserved public behavior.
- No new test is added for `loadLabelFromTsb` / `usePlanAdaptation` (they are
  thin adapters over `tsbZone`, which is directly tested); if you want coverage,
  a small pure test of `loadLabelFromTsb` is welcome but not required.
- Verification: `npm test -- performance` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test -- performance` exits 0; new `tsbZone` tests pass; existing
      `readinessFromTsb` tests pass unchanged
- [ ] `grep -n "tsb >" src/services/daily-summary.ts` returns no matches
      (the old inline thresholds in `loadLabelFromTsb` are gone)
- [ ] `grep -n "tsb < -20\|tsb < -10" src/hooks/usePlanAdaptation.ts` returns
      no matches (routed through zones)
- [ ] `grep -rn "tsbZone" src` shows the definition plus 3 consumers
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live code.
- Making `readinessFromTsb` use `tsbZone` breaks its existing tests — that means
  the zone boundaries were transcribed wrong; fix the boundaries, do not edit
  the tests.
- `usePlanAdaptation`'s alert copy strings are not where the excerpt says — do
  not invent new copy; report and stop.
- You discover a fourth consumer of raw TSB thresholds
  (`grep -rn "tsb >" src && grep -rn "tsb <" src`). Fold obvious ones in only if
  they are a TSB→label mapping; otherwise report.

## Maintenance notes

- After this lands, the **only** place TSB zone boundaries are defined is
  `tsbZone`. Any future tuning of readiness thresholds happens there and
  propagates to all three screens automatically — call this out in the PR.
- There remain **two** TSB *computations* in the app: `computeAtlCtlTsb` (from
  `workout_logs`) feeds `readinessFromTsb`/`usePlanAdaptation`, while
  `daily-summary.ts` reads `row.tsb` from the `v_daily_summary` DB view. This
  plan makes the *labels* consistent but not the *underlying numbers*. If the
  daily brief and the performance chart still disagree numerically, that is the
  separate view-vs-code reconciliation noted in the audit — a follow-up, not
  part of this plan.
- Plan 004 (cold-start CTL) adds a gate in front of the `peak-fresh` positive
  alert; if both land, sequence 002 before 004 to avoid conflicts in
  `usePlanAdaptation.ts`.
