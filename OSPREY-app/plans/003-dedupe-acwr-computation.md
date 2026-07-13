# Plan 003: Single source of truth for the ACWR value

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 6e36c9c..HEAD -- OSPREY-app/src/services/performance.ts OSPREY-app/src/hooks/usePerformance.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code first; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (correctness) / tech-debt
- **Planned at**: commit `6e36c9c`, 2026-07-13

## Why this matters

The acute:chronic workload ratio (ACWR) is computed in **two** places with
**different guards**, so the two can disagree for the same athlete on the same
day:

- `computeInjuryRisk` (performance.ts) returns `acwr: 0` and level
  `undertrained` whenever `chronicAvg < 5`.
- `usePerformance` recomputes ACWR inline as `chronicAvg > 0 ? acuteAvg /
  chronicAvg : 0`.

For an athlete with `chronicAvg = 3, acuteAvg = 6`, the UI's headline `acwr`
(from `usePerformance`) shows **2.0**, while the risk message (from
`computeInjuryRisk`) says ACWR is effectively 0 / "not enough training to
assess." The number the user sees and the number the coaching copy quotes
contradict each other. This plan makes `computeInjuryRisk` the single source of
the ACWR value and has `usePerformance` read it from there, deleting the
duplicate inline formula.

## Current state

All paths relative to `OSPREY-app/`.

**1. `src/services/performance.ts:65-101`** — `computeInjuryRisk` already
computes ACWR and returns it on the `InjuryRisk` object:

```ts
export function computeInjuryRisk(dailyLoads: DailyLoad[]): InjuryRisk {
  const recent = dailyLoads.slice(-28);
  const acute = recent.slice(-7);
  const acuteAvg = acute.reduce((s, d) => s + d.tss, 0) / Math.max(1, acute.length);
  const chronicAvg = recent.reduce((s, d) => s + d.tss, 0) / Math.max(1, recent.length);
  if (chronicAvg < 5) {
    return { level: 'undertrained', acwr: 0, message: 'Not enough recent training to assess load.' };
  }
  const acwr = acuteAvg / chronicAvg;
  // …thresholds… returns { level, acwr, message }
}
```

`InjuryRisk` (lines 32-36) is `{ level; acwr: number; message: string }`.

**2. `src/hooks/usePerformance.ts:34, 45-50`** — the duplicate:

```ts
const injuryRisk = computeInjuryRisk(dailyLoads);   // line 34 — already called!
// …
// ACWR: acute (7-day avg) / chronic (28-day avg)
const last28 = dailyLoads.slice(-28);
const last7 = dailyLoads.slice(-7);
const chronicAvg = last28.reduce((s, d) => s + d.tss, 0) / Math.max(1, last28.length);
const acuteAvg = last7.reduce((s, d) => s + d.tss, 0) / Math.max(1, last7.length);
const acwr = chronicAvg > 0 ? acuteAvg / chronicAvg : 0;
```

The hook then returns `acwr` (line ~62) and `injuryRisk` separately. Note
`injuryRisk` is **already computed** at line 34 from the same `dailyLoads` — the
inline block just recomputes the same windows with a weaker guard.

### Design note

`computeInjuryRisk`'s guard (`chronicAvg < 5 → acwr 0`) is the intended,
tested behavior (`performance.test.ts` → "guards against insufficient history").
Make **that** the single definition; the inline hook formula is the accidental
divergence to delete.

## Commands you will need

Run from `OSPREY-app/`.

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Install   | `npm install`               | exit 0              |
| Typecheck | `npm run typecheck`         | exit 0, no errors   |
| Tests     | `npm test -- performance`   | all pass            |
| Lint      | `npm run lint`              | exit 0              |

> If typecheck/tests fail with "jest-expo preset not found", run `npm install`.
> If `npm install` fails, STOP and report.

## Scope

**In scope**:
- `src/hooks/usePerformance.ts`

**Out of scope** (do NOT touch):
- `src/services/performance.ts` — `computeInjuryRisk` is already correct and is
  the value you will reuse; do not change its math or return shape.
- The `acwr` field name/type in the returned `PerformanceMetrics` — it stays a
  `number` so consumers are unaffected.

## Git workflow

- Branch: `advisor/003-dedupe-acwr`
- Commit: `fix(performance): use single ACWR source, drop divergent inline calc`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reuse `injuryRisk.acwr` in `usePerformance`

In `src/hooks/usePerformance.ts`, delete the inline ACWR block (the
`last28`/`last7`/`chronicAvg`/`acuteAvg`/`acwr` lines, ~45-50) and set the
returned `acwr` to the value already on `injuryRisk`:

```ts
// ACWR comes from computeInjuryRisk (single source of truth — see performance.ts).
const acwr = injuryRisk.acwr;
```

`injuryRisk` is already declared at line 34, so no new computation is added.
Confirm the object returned by the hook still has `acwr` and `injuryRisk`
fields with the same types.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Confirm no consumer relied on the divergent value

Search for readers of the hook's `acwr` field:

```
grep -rn "\.acwr" src
```

Confirm the consumers (e.g. performance screen) only display or compare the
number — none depend on the old behavior where `acwr` stayed nonzero while
`chronicAvg` was between 0 and 5. If any does, note it in your report.

**Verify**: `npm run lint` → exit 0.

## Test plan

- No new unit test is strictly required: `computeInjuryRisk`'s ACWR (now the
  only source) is already covered by `performance.test.ts`
  (`describe('computeInjuryRisk')`). Run the suite to confirm nothing broke.
- Optional but recommended: add one assertion to the existing
  `describe('computeInjuryRisk')` that pins the tie between the returned `acwr`
  and the `undertrained` guard, e.g. `chronicAvg` just under 5 → `acwr === 0`.
- Verification: `npm test -- performance` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test -- performance` exits 0
- [ ] `grep -n "chronicAvg > 0 ? acuteAvg" src/hooks/usePerformance.ts` returns
      no matches (inline formula removed)
- [ ] `grep -n "injuryRisk.acwr" src/hooks/usePerformance.ts` shows the reused value
- [ ] `npm run lint` exits 0 (no unused-variable warnings from the deleted block)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 003 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The inline ACWR block in `usePerformance.ts` doesn't match the excerpt.
- A consumer of the hook's `acwr` field depends on the old (guardless) value in
  the 0 < chronicAvg < 5 range.
- Deleting the block leaves `last28`/`last7` referenced elsewhere in the hook
  (they should not be — check before deleting).

## Maintenance notes

- ACWR is now defined once, inside `computeInjuryRisk`. If the acute/chronic
  window lengths (7/28) ever change, they change there only.
- `computeAcwrTrend` (performance.ts) also calls `computeInjuryRisk` internally,
  so it automatically stays consistent with the displayed ACWR — no action
  needed, but the reviewer should be aware the three ACWR-consuming paths
  (display, injury message, trend) now share one implementation.
