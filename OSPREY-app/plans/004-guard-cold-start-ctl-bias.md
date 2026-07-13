# Plan 004: Stop calling undertrained athletes "Peak Fresh" (cold-start CTL guard)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 6e36c9c..HEAD -- OSPREY-app/src/services/performance.ts OSPREY-app/src/hooks/usePlanAdaptation.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code first; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-unify-tsb-threshold-ladders.md` (build on the
  shared `tsbZone`; do 002 first). If 002 has NOT landed, see the "If 002 is not
  present" note in Step 2.
- **Category**: bug (correctness / athlete-safety edge case)
- **Planned at**: commit `6e36c9c`, 2026-07-13

## Why this matters

ATL and CTL are exponentially-weighted averages seeded at **0**, and
`fetchPerformanceData` zero-fills rest days. For an athlete with only a few
weeks of logged history, CTL has not had time to ramp up, so it sits
artificially low — which makes **TSB (= CTL − ATL) artificially high**. The
model then reports a brand-new or lightly-training athlete as "Peak Fresh," and
`usePlanAdaptation` tells them "You're fresh and fit. Ozzie can push harder in
your next plan." That is exactly backwards: a low-CTL athlete is *undertrained*,
not *fresh*, and pushing harder is the wrong advice.

The discriminator between the two is CTL magnitude: a genuinely fresh athlete
(tapering after a real training block) has a **high** CTL with positive TSB,
whereas a cold-start/undertrained athlete has a **low** CTL with positive TSB.
The existing guards only reject `ctl < 5`, which is far below a real fitness
base. This plan gates the *optimistic* readings ("Peak Fresh" / "push harder")
on a meaningful CTL floor, so positive TSB on a thin training base reads as
"Building Base" instead.

## Current state

All paths relative to `OSPREY-app/`.

**1. `src/services/performance.ts:46-61`** — the EWA seeded at 0 (this is the
*cause*, but we are **not** changing the math — see design note):

```ts
let atl = 0;
let ctl = 0;
return dailyLoads.map(({ date, tss }) => {
  atl = atl + (tss - atl) / TAU_ATL;   // TAU_ATL = 7
  ctl = ctl + (tss - ctl) / TAU_CTL;   // TAU_CTL = 42
  const tsb = ctl - atl;
  return { date, atl: …, ctl: …, tsb: … };
});
```

**2. `src/services/performance.ts` — `readinessFromTsb(tsb, ctl)`** (after plan
002, a switch over `tsbZone(tsb)`; it already receives `ctl` but currently only
echoes it in the payload, never using it for the label).

**3. `src/hooks/usePlanAdaptation.ts`** — the positive-alert path (after plan
002, `if (zone === 'peak-fresh') return { …positive… }`), guarded only by
`if (data.ctl < 5) return null;`.

### Design note — do NOT re-seed the EWA

The tempting "fix" is to seed CTL/ATL from a warm-up estimate. **Do not.** That
changes every existing user's numbers and breaks the `computeAtlCtlTsb` tests
(`performance.test.ts` asserts the exact closed-form values for a zero-seeded
EWA). Instead, treat low CTL as "insufficient fitness base" at the *readiness
interpretation* layer, which is contained and testable. Keep `computeAtlCtlTsb`
untouched.

### The threshold (a decision this plan makes)

Define `MIN_CTL_FOR_FRESH = 20`. Rationale: CTL is an EWA of daily TSS; a CTL
around 20 corresponds to roughly a sustained ~20 TSS/day base (about 3–4
moderate sessions a week held for over a month) — enough accumulated load that
positive TSB genuinely means "rested," not "never trained." This is a coaching
parameter; it lives as a named constant so it can be tuned. If
`OSPREY/docs/coaching/` specifies a different fitness-base threshold, use that
value instead and cite it in a comment (see STOP conditions).

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
- `src/services/performance.ts` (add `MIN_CTL_FOR_FRESH`; gate the fresh labels
  in `readinessFromTsb`)
- `src/hooks/usePlanAdaptation.ts` (gate the positive alert on the CTL floor)
- `src/services/__tests__/performance.test.ts` (tests for the gated readiness)

**Out of scope** (do NOT touch):
- `computeAtlCtlTsb` and its `TAU_ATL`/`TAU_CTL` — the EWA math stays as-is.
- `fetchPerformanceData` zero-filling — unchanged.
- The `tsbZone` boundaries from plan 002 — reused, not modified.

## Git workflow

- Branch: `advisor/004-cold-start-ctl-guard`
- Commit: `fix(performance): gate "fresh" readiness on a real fitness base (CTL)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the fitness-base constant

In `src/services/performance.ts`, near the top of the readiness section (above
`readinessFromTsb`), add:

```ts
/**
 * Minimum CTL before positive TSB is interpreted as "fresh" rather than
 * "undertrained". CTL is EWA-seeded at 0, so athletes with only a few weeks of
 * history show artificially low CTL and thus artificially high TSB; without
 * this floor they'd be labeled "Peak Fresh" and told to push harder. Tunable
 * coaching parameter — see plans/004.
 */
export const MIN_CTL_FOR_FRESH = 20;
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Gate the fresh labels in `readinessFromTsb`

`readinessFromTsb(tsb, ctl)` already receives `ctl`. When the zone is
`peak-fresh` or `fresh` **but** `ctl < MIN_CTL_FOR_FRESH`, return a neutral
"Building Base" readiness instead of the optimistic label. Target shape (this
assumes plan 002's `tsbZone` switch is in place):

```ts
export function readinessFromTsb(tsb: number, ctl: number): TrainingReadiness {
  const zone = tsbZone(tsb);
  let label: string;
  let color: string;

  // Positive TSB on a thin fitness base means undertrained, not rested.
  if ((zone === 'peak-fresh' || zone === 'fresh') && ctl < MIN_CTL_FOR_FRESH) {
    label = 'Building Base';
    color = Colors.teal;
  } else {
    switch (zone) {
      case 'peak-fresh':    label = 'Peak Fresh';    color = Colors.teal;  break;
      case 'fresh':         label = 'Fresh';         color = Colors.green; break;
      case 'ready':         label = 'Ready';         color = Colors.teal;  break;
      case 'carrying-load': label = 'Carrying Load'; color = Colors.amber; break;
      case 'fatigued':      label = 'Fatigued';      color = Colors.amber; break;
      default:              label = 'Overreached';   color = Colors.red;   break;
    }
  }
  return { tsb: Math.round(tsb * 10) / 10, ctl: Math.round(ctl * 10) / 10, label, color };
}
```

Use whatever neutral color the design uses elsewhere for informational states;
`Colors.teal` is a safe default matching "Ready". Confirm the chosen color
exists in `src/constants/colors.ts` before using it.

> **If plan 002 is NOT present** (no `tsbZone` yet): keep the existing
> `if (tsb > 15) … else if (tsb > 5) …` ladder, and add the same guard —
> in the `tsb > 15` and `tsb > 5` branches, when `ctl < MIN_CTL_FOR_FRESH`,
> set `label = 'Building Base'`. Everything else stays identical.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Gate the positive alert in `usePlanAdaptation`

In `src/hooks/usePlanAdaptation.ts`, the positive alert must not fire on a thin
base. Add the CTL floor to its condition (this assumes plan 002's zone routing):

```ts
if (zone === 'peak-fresh' && data.ctl >= MIN_CTL_FOR_FRESH) {
  return { message: /* existing "fresh and fit … push harder" copy */, severity: 'positive', tsb };
}
```

Import `MIN_CTL_FOR_FRESH` from `@/services/performance`. Leave the warning and
info (fatigued/overreached) alerts unchanged — the guard applies only to the
optimistic path.

> **If plan 002 is NOT present**: change `if (tsb > 15)` to
> `if (tsb > 15 && data.ctl >= MIN_CTL_FOR_FRESH)`.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Add tests

In `src/services/__tests__/performance.test.ts`, extend the readiness tests:

```ts
describe('readinessFromTsb cold-start guard', () => {
  it('labels high positive TSB on a thin base as Building Base, not Peak Fresh', () => {
    expect(readinessFromTsb(20, 10).label).toBe('Building Base'); // ctl 10 < 20
  });

  it('still labels high positive TSB as Peak Fresh once CTL clears the floor', () => {
    expect(readinessFromTsb(20, 40).label).toBe('Peak Fresh'); // ctl 40 >= 20
  });

  it('does not gate fatigued/loaded zones (negative TSB) on CTL', () => {
    expect(readinessFromTsb(-20, 10).label).toBe('Fatigued'); // low ctl, still Fatigued
  });
});
```

The existing `describe('readinessFromTsb')` table uses `ctl = 50` (above the
floor), so those cases keep passing unchanged.

**Verify**: `npm test -- performance` → all pass, including the new guard block
and the unchanged existing readiness table.

## Test plan

- New: the `readinessFromTsb cold-start guard` block above (3 cases: gated
  fresh, ungated fresh, ungated fatigued).
- Unchanged and must still pass: existing `describe('readinessFromTsb')`
  (all use `ctl = 50`) and all `computeAtlCtlTsb` tests (math untouched).
- Verification: `npm test -- performance` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test -- performance` exits 0; new cold-start guard tests pass;
      existing readiness + `computeAtlCtlTsb` tests pass unchanged
- [ ] `grep -n "MIN_CTL_FOR_FRESH" src/services/performance.ts src/hooks/usePlanAdaptation.ts`
      shows the constant defined once and imported in the hook
- [ ] `readinessFromTsb(20, 10).label === 'Building Base'` and
      `readinessFromTsb(20, 40).label === 'Peak Fresh'` (covered by tests)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 004 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `computeAtlCtlTsb`'s existing tests fail — that means the EWA math was
  touched; it must not be.
- `OSPREY/docs/coaching/` (repo root, one level above `OSPREY-app/`) defines a
  specific fitness-base / minimum-CTL threshold that differs from 20 — use the
  documented value and cite it, then report the deviation.
- The `Colors` module has no suitable neutral color and the design intent for a
  "Building Base" state is unclear — report and stop rather than guessing a hex.
- Plan 002 is present but `tsbZone` is not where expected — reconcile against
  the actual code or STOP.

## Maintenance notes

- The real root cause (zero-seeded EWA) is deliberately left in place; this plan
  masks its worst *user-facing* symptom. If a future change warms up the CTL
  seed from onboarding fitness data, revisit `MIN_CTL_FOR_FRESH` — it may no
  longer be needed, or the floor may move.
- `MIN_CTL_FOR_FRESH` is the one knob that decides "undertrained vs fresh." A
  reviewer or coach should sanity-check the value against real athlete data
  before launch; it's intentionally a named export so it's easy to find and tune.
- This interacts with plan 002: both edit `usePlanAdaptation.ts` and
  `readinessFromTsb`. Land 002 first so this plan edits the zone-based versions.
