# Plan 005: Two low-risk cleanups in the TSB engine (timezone + dead param)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`. This plan bundles two **independent** cleanups (A and
> B); you may commit them separately.
>
> **Drift check (run first)**:
> `git diff --stat 6e36c9c..HEAD -- OSPREY-app/src/services/performance.ts OSPREY-app/src/services/plan.ts OSPREY-app/src/hooks/usePlanDeload.ts OSPREY-app/src/hooks/usePerformance.ts`
> If any listed file changed since this plan was written, compare the "Current
> state" excerpts against the live code first; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (A: timezone edge case) / tech-debt (B: dead code)
- **Planned at**: commit `6e36c9c`, 2026-07-13

## Why this matters

Two small, self-contained issues in the TSB engine:

- **A — Timezone mismatch in de-load candidate selection.** `usePlanDeload`
  computes "today" with `new Date().toISOString().slice(0, 10)` (a **UTC**
  date), then filters upcoming sessions with `s.session_date >= today`. For an
  athlete behind UTC in the evening (e.g. US Eastern at 8pm = 1am UTC the next
  day), the UTC date is already *tomorrow*, so today's remaining sessions are
  filtered out and the de-load suggestion silently skips them. The rest of the
  plan logic keys off the athlete's **local** calendar day. This aligns "today"
  to the local day.
- **B — Dead parameter.** `buildRacePredictor(dailyLoads, bestRunMiles,
  bestRunTimeS)` never references `dailyLoads` in its body. It's misleading dead
  weight in the signature.

Neither is high-severity; both are cheap correctness/clarity wins in code the
higher-priority plans also touch.

## Current state

All paths relative to `OSPREY-app/`.

**A — `src/hooks/usePlanDeload.ts:75-77`:**

```ts
const today = new Date().toISOString().slice(0, 10);
const upcoming = sessions.filter((s) => s.session_date >= today && s.session_type !== 'rest');
const candidate = upcoming.find((s) => HARD_INTENSITIES.has(s.intensity)) ?? upcoming[0];
```

For comparison, `src/services/plan.ts:91-98` (`currentWeekStartDate`) derives
its date from **local** getters (`now.getDay()`, `now.getDate()`), so the two
functions disagree on what "now" means at the UTC boundary.

**B — `src/services/performance.ts:176-194`:**

```ts
export function buildRacePredictor(
  dailyLoads: DailyLoad[],   // ← never used in the body
  bestRunMiles: number,
  bestRunTimeS: number,
): RacePredictor | null {
  if (bestRunMiles < 1 || bestRunTimeS <= 0) return null;
  const paceSecPerMile = bestRunTimeS / bestRunMiles;
  const predictions = RACE_DISTANCES.filter(/* … */).map(/* … */);
  return { baseMiles: bestRunMiles, basePaceSecPerMile: paceSecPerMile, predictions };
}
```

Callers/tests to update when the param is removed:
- `src/hooks/usePerformance.ts:35` — `buildRacePredictor(dailyLoads, bestRunMiles, bestRunTimeS)`
- `src/services/__tests__/performance.test.ts` — `buildRacePredictor([], 0.8, 600)`,
  `buildRacePredictor([], 5, 0)`, `buildRacePredictor([], 10, 5400)`,
  `buildRacePredictor([], 3.107, 1200)` (the `[]` first arg at each call site).

## Commands you will need

Run from `OSPREY-app/`.

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Install   | `npm install`               | exit 0              |
| Typecheck | `npm run typecheck`         | exit 0, no errors   |
| Tests     | `npm test -- performance`   | all pass            |
| Tests (plan) | `npm test -- plan`       | all pass            |
| Lint      | `npm run lint`              | exit 0              |

> If typecheck/tests fail with "jest-expo preset not found", run `npm install`.
> If `npm install` fails, STOP and report.

## Scope

**In scope**:
- `src/services/plan.ts` (A: add a local-date helper)
- `src/hooks/usePlanDeload.ts` (A: use the helper for `today`)
- `src/services/performance.ts` (B: drop the dead param)
- `src/hooks/usePerformance.ts` (B: update the one call site)
- `src/services/__tests__/performance.test.ts` (B: update call sites)
- `src/services/__tests__/plan.test.ts` (A: create if absent — test the helper)

**Out of scope** (do NOT touch):
- `currentWeekStartDate`'s own internal date math — it has a separate,
  pre-existing edge for UTC-*ahead* timezones; fixing that is a larger change,
  not this cleanup. Only make `usePlanDeload`'s `today` use the local calendar.
- The `RacePredictor` return shape and the Riegel math.

## Git workflow

- Branch: `advisor/005-tsb-engine-cleanups`
- Commits (separate is fine):
  - `fix(plan): use local calendar day for de-load candidate filtering`
  - `refactor(performance): drop unused dailyLoads param from buildRacePredictor`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Cleanup A

#### Step A1: Add a local-date helper in `plan.ts`

In `src/services/plan.ts`, add an exported pure helper (place it next to
`currentWeekStartDate`, ~line 90):

```ts
/** Today's date (YYYY-MM-DD) in the athlete's local timezone. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

**Verify**: `npm run typecheck` → exit 0.

#### Step A2: Use it in `usePlanDeload`

In `src/hooks/usePlanDeload.ts`, import `localDateString` from
`@/services/plan` (add it to the existing import from that module, lines 8-14)
and replace the UTC `today`:

```ts
const today = localDateString();
```

Leave the rest of the `upcoming`/`candidate` logic unchanged.

**Verify**: `npm run typecheck` → exit 0.

#### Step A3: Test the helper

Create `src/services/__tests__/plan.test.ts` if it does not exist. Because
`localDateString` reads local getters off a locally-constructed `Date`, a test
built with `new Date(year, monthIndex, day, hour, …)` is deterministic across
timezones (the local components round-trip):

```ts
import { localDateString } from '@/services/plan';

jest.mock('@/services/supabase', () => ({ supabase: {} }));

describe('localDateString', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    // 23:00 local on 2026-03-10 — must be 2026-03-10, not the UTC-rolled date.
    expect(localDateString(new Date(2026, 2, 10, 23, 0, 0))).toBe('2026-03-10');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateString(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05');
  });
});
```

> If `plan.ts` has module-level imports that break under jest without the
> supabase mock, the `jest.mock` line above (mirroring `performance.test.ts`)
> handles it. If other imports fail, STOP and report rather than stubbing more.

**Verify**: `npm test -- plan` → the 2 new tests pass.

### Cleanup B

#### Step B1: Remove the dead parameter

In `src/services/performance.ts`, change `buildRacePredictor`'s signature to
drop `dailyLoads`:

```ts
export function buildRacePredictor(
  bestRunMiles: number,
  bestRunTimeS: number,
): RacePredictor | null {
```

The body is unchanged (it never used `dailyLoads`).

**Verify**: `npm run typecheck` → will FAIL until Step B2/B3 update callers.
That is expected; proceed to B2.

#### Step B2: Update the call site in `usePerformance`

In `src/hooks/usePerformance.ts` (line ~35), change:

```ts
const racePredictor = buildRacePredictor(dailyLoads, bestRunMiles, bestRunTimeS);
```

to:

```ts
const racePredictor = buildRacePredictor(bestRunMiles, bestRunTimeS);
```

Do not otherwise change the hook; `dailyLoads` is still used elsewhere in it.

**Verify**: `npm run typecheck` → exit 0 (after B3 too).

#### Step B3: Update the test call sites

In `src/services/__tests__/performance.test.ts`, remove the leading `[]`
argument from every `buildRacePredictor` call (4 call sites listed in "Current
state"): e.g. `buildRacePredictor([], 0.8, 600)` → `buildRacePredictor(0.8, 600)`.

**Verify**: `npm test -- performance` → all pass; `npm run typecheck` → exit 0.

## Test plan

- A: new `describe('localDateString')` in `plan.test.ts` (2 cases: evening
  local day does not roll to UTC-next-day; zero-padding).
- B: no new tests — the existing `describe('buildRacePredictor')` cases prove
  behavior is unchanged; they just lose the unused first argument.
- Verification: `npm test -- performance` and `npm test -- plan` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test -- performance` exits 0; `npm test -- plan` exits 0
- [ ] `grep -n "toISOString().slice(0, 10)" src/hooks/usePlanDeload.ts` returns
      no matches (UTC `today` replaced)
- [ ] `grep -n "localDateString" src/services/plan.ts src/hooks/usePlanDeload.ts`
      shows definition + use
- [ ] `grep -n "dailyLoads" src/services/performance.ts` shows no reference
      inside `buildRacePredictor`'s signature (search the function)
- [ ] `grep -rn "buildRacePredictor(\[\]" src` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 005 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live code.
- `usePlanDeload` imports `today` or `session_date` from an unexpected place, or
  `session_date` turns out to be stored as a full timestamp (not `YYYY-MM-DD`) —
  the string comparison assumption would need revisiting; report first.
- Removing the `buildRacePredictor` param reveals a caller other than
  `usePerformance` and the tests (`grep -rn "buildRacePredictor" src`).
- Creating `plan.test.ts` triggers import errors beyond the supabase mock.

## Maintenance notes

- `localDateString` is the reusable primitive for "the athlete's local day."
  Prefer it over `new Date().toISOString().slice(0,10)` anywhere a *local*
  calendar day is meant. `currentWeekStartDate` still has a latent UTC-ahead
  edge (out of scope here) — a future timezone pass should route it through the
  same local-date basis.
- After B, `buildRacePredictor` takes only the two values it uses; if a future
  feature genuinely needs load history in the predictor, add it back
  intentionally with a use, not as a placeholder.
