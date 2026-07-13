# Plan 001: Include today's training in the ATL/CTL/TSB load series

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e36c9c..HEAD -- OSPREY-app/src/services/performance.ts`
> If `src/services/performance.ts` changed since this plan was written, compare
> the "Current state" excerpt against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e36c9c`, 2026-07-13

## Why this matters

`fetchPerformanceData` builds the daily-load window as `[today-84 … today-1]` —
the loop that fills the buckets stops at **yesterday**. A workout the athlete
logs *today* is fetched from the database and placed into `tssMap[today]`, but
that bucket is never read back into `dailyLoads`, so today's training is
silently dropped from ATL, CTL, and TSB. The consequence: the readiness metric
the whole app reacts to is always a day stale, and a session you complete this
morning does not move your fitness/fatigue numbers until the calendar rolls
over. For a coaching app whose core promise is same-day adaptation, this is a
correctness bug. After this plan, the load window ends on **today**, inclusive.

## Current state

All paths below are relative to the `OSPREY-app/` directory (run commands from
there).

- `src/services/performance.ts` — the TSB engine. The bug is in
  `fetchPerformanceData`, which fetches workout rows and builds the per-day TSS
  series consumed by `computeAtlCtlTsb`.

The window is derived from `since` (lines ~228-229) and filled by a loop (lines
~277-284):

```ts
// src/services/performance.ts:228-229
const since = new Date();
since.setDate(since.getDate() - days);
```

```ts
// src/services/performance.ts:277-284
// Fill every day in the window (0 TSS on rest days)
const dailyLoads: DailyLoad[] = [];
for (let i = 0; i < days; i++) {
  const d = new Date(since);
  d.setDate(d.getDate() + i);
  const dateStr = d.toISOString().slice(0, 10);
  dailyLoads.push({ date: dateStr, tss: tssMap[dateStr] ?? 0 });
}
```

With `days = 84`: `since = today - 84`, and the loop produces `i = 0..83` →
dates `today-84 … today-1`. **Today is never emitted.** Any `tssMap[today]`
entry (built at lines ~257-260 from rows the query already returned) is orphaned.

The `tssMap` keys come from `row.started_at.slice(0, 10)` (line ~258), i.e. the
UTC calendar date of the stored timestamp. The bucket dates use
`d.toISOString().slice(0, 10)`, also UTC — so the two are consistent. **Do not
change the timezone behavior in this plan**; keep both on the same UTC basis.
(A separate cleanups plan, 005, addresses a timezone mismatch elsewhere.)

### Repo conventions to follow

- Pure functions in this file are plain `export function` declarations with a
  short `// ──` banner comment above each section — match that style.
- Tests live in `src/services/__tests__/performance.test.ts` and mock supabase
  at module level: `jest.mock('@/services/supabase', () => ({ supabase: {} }))`.
  The pure math is tested directly with a local `days(tssValues: number[])`
  helper; `fetchPerformanceData` itself is not unit-tested because it hits
  supabase. This plan extracts the date-bucketing into a **pure, testable**
  helper so the fix can be covered without mocking the query builder.

## Commands you will need

Run from the `OSPREY-app/` directory.

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Install   | `npm install`               | exit 0              |
| Typecheck | `npm run typecheck`         | exit 0, no errors   |
| Tests     | `npm test -- performance`   | all pass            |
| Lint      | `npm run lint`              | exit 0              |

> NOTE: `node_modules` may not be installed in a fresh checkout. If
> `npm run typecheck` fails with "jest-expo preset not found" or a missing
> binary, run `npm install` first. If `npm install` itself fails, that is a
> STOP condition — report it, do not attempt to work around it.

## Scope

**In scope** (the only files you should modify):
- `src/services/performance.ts`
- `src/services/__tests__/performance.test.ts`

**Out of scope** (do NOT touch):
- `src/hooks/usePerformance.ts` — it consumes `dailyLoads` and slices the last
  28/84; the window shifting forward by one day is transparent to it.
- Any timezone / UTC-vs-local handling — deliberately preserved here.
- `computeAtlCtlTsb` — its math is correct; only the input window is wrong.

## Git workflow

- Branch: `advisor/001-include-today-in-load-series`
- Commit style follows the repo's conventional-commit history (see
  `git log --oneline`, e.g. `fix(security): …`). Use
  `fix(performance): include today's training in ATL/CTL/TSB window`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract a pure date-bucketing helper

Add an exported pure function that builds the load window ending on a given
end date, **inclusive**. Place it directly above `fetchPerformanceData`
(after the `estimateTss` helper, near line 210). Target shape:

```ts
/**
 * Builds a contiguous daily-load window of `days` entries ending on `endDate`
 * (inclusive), pulling per-day totals from `tssMap` (0 on days with no
 * training). Dates use the UTC calendar day, matching how tssMap keys are
 * derived from stored timestamps.
 */
export function buildLoadWindow(
  tssMap: Record<string, number>,
  endDate: Date,
  days: number,
): DailyLoad[] {
  const loads: DailyLoad[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    loads.push({ date: dateStr, tss: tssMap[dateStr] ?? 0 });
  }
  return loads;
}
```

This produces dates `endDate-(days-1) … endDate`, i.e. exactly `days` buckets
ending on `endDate` inclusive.

**Verify**: `npm run typecheck` → exit 0, no errors.

### Step 2: Use the helper in `fetchPerformanceData`

Replace the inline fill loop (lines ~277-284) with a call to the new helper,
passing **today** as the end date. Keep `since` — it is still needed for the
supabase `.gte('started_at', since.toISOString())` filter at line ~239.

Replace:

```ts
// Fill every day in the window (0 TSS on rest days)
const dailyLoads: DailyLoad[] = [];
for (let i = 0; i < days; i++) {
  const d = new Date(since);
  d.setDate(d.getDate() + i);
  const dateStr = d.toISOString().slice(0, 10);
  dailyLoads.push({ date: dateStr, tss: tssMap[dateStr] ?? 0 });
}
```

with:

```ts
// Fill every day in the window (0 TSS on rest days), ending today so a
// workout logged today counts toward ATL/CTL/TSB immediately.
const dailyLoads = buildLoadWindow(tssMap, new Date(), days);
```

Leave the `since` declaration and the `.gte('started_at', since.toISOString())`
query filter unchanged — fetching one extra day of history at the far edge is
harmless (that bucket simply falls outside the window).

**Verify**: `npm run typecheck` → exit 0, no errors.

### Step 3: Add unit tests for `buildLoadWindow`

In `src/services/__tests__/performance.test.ts`, add `buildLoadWindow` to the
import list from `@/services/performance`, then add a `describe` block. Use a
fixed end date to keep the test deterministic (the file already constructs
dates from fixed strings — follow that pattern):

```ts
describe('buildLoadWindow', () => {
  const end = new Date('2026-03-10T12:00:00Z'); // fixed for determinism

  it('includes the end date (today) as the last entry', () => {
    const w = buildLoadWindow({}, end, 5);
    expect(w[w.length - 1].date).toBe('2026-03-10');
  });

  it('returns exactly `days` chronological entries', () => {
    const w = buildLoadWindow({}, end, 5);
    expect(w).toHaveLength(5);
    expect(w.map((d) => d.date)).toEqual([
      '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
    ]);
  });

  it('zero-fills days with no training and passes through mapped totals', () => {
    const w = buildLoadWindow({ '2026-03-10': 90 }, end, 3);
    expect(w[w.length - 1].tss).toBe(90);
    expect(w[0].tss).toBe(0);
  });
});
```

**Verify**: `npm test -- performance` → all pass, including the 3 new
`buildLoadWindow` tests; the existing `computeAtlCtlTsb` / `computeInjuryRisk`
suites still pass unchanged.

## Test plan

- New tests: the `buildLoadWindow` block above in
  `src/services/__tests__/performance.test.ts` (3 `it`s), modelled structurally
  on the existing `computeAtlCtlTsb` describe block.
- Regression covered: "today's bucket is present and carries its TSS" — the
  exact defect this plan fixes.
- Verification: `npm test -- performance` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test -- performance` exits 0; new `buildLoadWindow` tests exist and pass
- [ ] `grep -n "for (let i = 0; i < days" src/services/performance.ts` returns
      no matches (the old fill loop is gone)
- [ ] `grep -n "buildLoadWindow" src/services/performance.ts` shows both the
      definition and its use in `fetchPerformanceData`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `fetchPerformanceData` doesn't match the "Current state" excerpts
  (the file drifted since this plan was written).
- `npm install` fails, or tests cannot run after a reasonable install attempt.
- Removing the old loop appears to require changing `usePerformance.ts` or any
  other consumer — it should not; the return type is unchanged.
- You find another caller of `fetchPerformanceData` that relies on the window
  *excluding* today (search: `grep -rn "fetchPerformanceData" src`). If so,
  report before proceeding.

## Maintenance notes

- The load buckets and `tssMap` keys are both on the **UTC** calendar day. This
  is internally consistent but means "today" flips at UTC midnight, not the
  athlete's local midnight. Making the whole engine local-timezone-aware is a
  larger, separate change — do not fold it in here.
- If a future change makes `days` configurable per caller, `buildLoadWindow`
  already takes it as a parameter — no further work needed.
- Reviewer should confirm the window stays `days` long but shifts forward by
  one day to end on today (it does not grow to `days+1`).
