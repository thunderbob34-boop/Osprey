# Coaching-Engine Phase 3 Follow-ups — Design

**Date:** 2026-07-15
**Status:** Approved (design) — ready for implementation plan
**Origin:** The two fast-follows filed during the powerlifting slice's final review
(`.superpowers/sdd/progress.md`; roadmap `docs/superpowers/specs/2026-07-14-coaching-engine-fidelity-design.md` §11).

Two independent, pre-diagnosed defects in the "Expert Coach" engine, bundled into one
slice because they share the coaching-engine deploy coupling and are each small:

1. **Goal-switch stale envelope** — a plan-builder goal *switcher's* first generation
   builds the client envelope against the previous `primary_goal`. Cross-sport correctness.
2. **Paramless-lift 0 kg** — a powerlifter who skips the 1RM form gets a plan built on
   0 kg competition lifts. Graceful degradation on the flagship strength feature.

---

## Global Constraints

- **Non-lift and single-sport plans MUST stay byte-identical.** Every existing
  `validate.ts` polarization / pace-clamp / fuel-attach test and every non-switching
  envelope test must remain green, unchanged.
- **NO database migration.** No enum, column, or schema change. (`primary_goal_enum`
  already carries all sport values; `goal_params` already exists.)
- **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test` (Jest). The `TZ` is
  mandatory — date-phase math is timezone-sensitive.
- **Edge tests:** `deno test supabase/functions/ozzie-generate-plan/` (Deno).
- **Mirror, don't share.** There is no shared package between the app (TS/Jest) and the
  edge fn (Deno). Pure logic duplicated across the boundary is pinned by a unit test on
  each side, matching the existing `webapp/tests/zone-parity.test.ts` convention.
- **TDD.** Every change lands as: failing test reproducing the defect → minimal fix →
  green, per the powerlifting/ultra slices.

---

## Fix #1 — Goal-switch stale envelope

### Problem

An already-onboarded athlete who switches to a new goal in the plan-builder
(`app/preferences.tsx`, e.g. hybrid → "Strength Focus", or → Ultra) gets **one**
generation whose envelope — `sport`, `strength`, `zones`, `fuel` — is built for the
**old** goal. The sport-specific coaching (%1RM / Prilepin for lift; taper / distance
scaling for ultra; per-sport fuel) is silently absent that once. It self-corrects on the
next weekly regeneration.

Day **counts** are already correct (the edge computes them from the POSTed
`preferences.primaryGoal`). Only the client-computed **envelope** is stale.

Latent since the envelope was introduced in Phase 2a; affects **all** goal switches
(ultra, powerlifting, and every endurance sport). The onboarding path is unaffected.

### Mechanism

`invokeGeneratePlan` (`OSPREY-app/src/services/coaching/build-envelope.ts`) builds the
envelope entirely from a **fresh DB read** of `user_goals.primary_goal`:

- `sport: g?.primary_goal ?? 'run'` (build-envelope.ts:104)
- `ultraParams: g?.primary_goal === 'ultra' ? … : null` (build-envelope.ts:115)
- `strengthParams: g?.primary_goal === 'lift' ? … : null` (build-envelope.ts:116)

`handleGenerate` (`app/preferences.tsx`) persists only `goal_params` before calling
`invokeGeneratePlan` — it never writes `primary_goal`. The edge function's `user_goals`
upsert that *does* fix `primary_goal` runs **after** the client has already built and
POSTed the envelope. So the read at build-envelope.ts:104–116 sees the stale value.

**Caller inventory** (only preference-passing callers are affected; the DB-read fallback
is correct for the rest):

| Caller | Body passed | Effect of fix |
|---|---|---|
| `app/preferences.tsx:243` | `{ preferences, force }` | **The bug.** Uses posted goal — fixed. |
| `src/services/onboarding.ts:45` (`generateInitialPlan`) | `{ preferences: buildPlanPreferences(draft), force }` | Posted goal **agrees** with the `primary_goal` `completeOnboarding` already wrote → identical result. |
| `src/services/daily-summary.ts:372` (weekly regen) | *(none)* | No preferences → DB read fallback → unchanged. |
| `app/race-event.tsx:149` | `{ raceTarget, force }` | No preferences → DB read fallback → unchanged. |

### Approach — client goal override at the source (chosen)

Have `invokeGeneratePlan` **prefer a POSTed just-picked goal** over the DB read when
present. One code path, fixes every sport at once, zero call-site changes.

1. **New module `OSPREY-app/src/services/coaching/goal-map.ts`.** Defines the client
   mirror of the edge's `PRIMARY_GOAL_MAP` (`index.ts:495`), translating a plan-builder
   `TrainingGoal` to the DB `primary_goal_enum` string that the envelope build gates on:

   ```ts
   // Mirror of ozzie-generate-plan/index.ts PRIMARY_GOAL_MAP. The DB primary_goal_enum
   // superset — note it includes 'triathlon', which the onboarding PrimaryGoal TS union
   // (@/types/onboarding) does NOT. Keep in sync with that map + the *_primary_goal
   // migrations.
   export type PrimaryGoalEnum =
     | 'run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness'
     | 'triathlon' | 'swim' | 'rowing' | 'hyrox' | 'cycling' | 'ultra';

   export const TRAINING_GOAL_TO_PRIMARY_GOAL: Record<TrainingGoal, PrimaryGoalEnum> = {
     hybrid: 'hybrid',
     run_performance: 'run',
     strength: 'lift',
     weight_loss: 'weight_loss',
     general: 'general_fitness',
     triathlon: 'triathlon',
     swim: 'swim',
     rowing: 'rowing',
     hyrox: 'hyrox',
     cycling: 'cycling',
     ultra: 'ultra',
   };

   export function primaryGoalFromTrainingGoal(g: TrainingGoal): PrimaryGoalEnum {
     return TRAINING_GOAL_TO_PRIMARY_GOAL[g];
   }
   ```

   **Why its own module (not colocated in `onboarding.ts` beside its inverse):**
   `onboarding.ts` imports `invokeGeneratePlan` from `build-envelope.ts`; having
   `build-envelope.ts` import the map back from `onboarding.ts` would create a circular
   import. `goal-map.ts` imports only types, so nothing cycles.

2. **Override in `invokeGeneratePlan`.** Read the posted preferences' goal and, when
   present, use its mapped enum as the **effective goal** — for `sport` and for the
   `=== 'ultra'` / `=== 'lift'` param gating — overriding `g?.primary_goal`. When no
   preferences are posted (regen, race-event), fall back to the DB read exactly as today.

   ```ts
   const posted = (extraBody.preferences as UserPreferences | undefined)?.primaryGoal;
   const effectiveGoal = posted ? primaryGoalFromTrainingGoal(posted) : (g?.primary_goal ?? 'run');
   // …then: sport: effectiveGoal, ultraParams gated on effectiveGoal === 'ultra',
   //        strengthParams gated on effectiveGoal === 'lift'.
   ```

   The `goal_params` read stays as-is: a switcher's `handleGenerate` already persists
   `goal_params` before generating (the ultra/powerlifting persist-before-generate
   lesson), so the freshly-read `goal_params` matches the newly-chosen sport.

### Safety — onboarding round-trip is identity

`buildPlanPreferences` sets `primaryGoal = ONBOARDING_GOAL_TO_PREFERENCES[draft.primaryGoal]`
(enum → `TrainingGoal`). The override then maps that back (`TrainingGoal` → enum). For
onboarding to stay unaffected, this round-trip must be the identity over every
`PrimaryGoal`. A unit test pins it:

- **Inverse pin:** for every `p` in `PrimaryGoal` (10 values),
  `TRAINING_GOAL_TO_PRIMARY_GOAL[ONBOARDING_GOAL_TO_PREFERENCES[p]] === p`.
- **Exhaustiveness:** `TRAINING_GOAL_TO_PRIMARY_GOAL` has a key for all 11 `TrainingGoal`
  values (the extra `triathlon → 'triathlon'` has no onboarding inverse — expected, since
  `PrimaryGoal` omits `triathlon`).
- **Edge parity:** the map's entries are pinned to the exact `PRIMARY_GOAL_MAP` literal
  (the Deno source can't be imported into Jest; a comment cross-references it).

### Regression scope

Build an envelope via a POSTed goal for **ultra / triathlon / swim / rowing / lift** and
assert the sport-specific envelope is present on the **first** generation (e.g. switching
to `strength` yields a non-null `strength`; to `ultra` yields the ultra-shaped taper/fuel).
Assert the no-preferences path still uses the DB read.

### Surface

App-only: `build-envelope.ts` + new `goal-map.ts`. **No edge change, no redeploy
dependency, no migration.**

---

## Fix #2 — Paramless-lift 0 kg

### Problem & decision

A powerlifter who taps **"Skip — estimate for me"** on the onboarding 1RM form (no logged
lift history) ends up with a plan whose competition lifts are **0 kg**. Non-crashing, but
it breaks the "estimate for me" promise on the flagship strength feature.

**Decision (approved):** a paramless lifter falls back to the **general structured
strength plan** (library exercises, sets/reps/RPE) — *not* a %1RM block with 0 kg loads.
The numbers-anchored block appears the moment they enter a 1RM. Synthesizing a default
1RM from bodyweight + experience tier is explicitly **out of scope** (see Non-goals).

### Mechanism

- Onboarding skip → `user_goals.goal_params` is null → `toStrengthParams(null)` yields
  all-null maxes → `buildStrengthPrescription` (`strength.ts:22`) defaults `oneRepMaxKg`
  to `{ squat: 0, bench: 0, deadlift: 0 }` → the edge `strengthGuidance` emits
  "squat 0 kg, bench 0 kg, deadlift 0 kg", and `validate.ts` step (d) clamps any comp-lift
  load into `[0, 0]`.
- `parseStrengthParams` requires **at least one** 1RM (`strength-params.ts:47`), so a
  *plan-builder* lifter always has ≥1 max. But a **partial** provide (one lift filled,
  others blank) is reachable there and produces a per-lift 0 for the blank lifts.

### Part A — flagship skip path (app-only)

`buildStrengthPrescription` returns `null` when all three 1RMs are 0:

```ts
if (orm.squat === 0 && orm.bench === 0 && orm.deadlift === 0) return null;
```

→ `envelope.strength` is `null` (already a valid value — it is null for every non-lift
sport). The edge's `strengthGuidance` block and `validate.ts` step (d) are both already
guarded on `envelope.strength` being present, so the plan cleanly falls back to the
general strength prompt. **No edge change needed for the skip path.**

### Part B — partial-provide coherence (edge)

For a lifter who fills only some lifts, a real training day for a blank lift must not be
described as, or clamped to, 0 kg. Two small defensive tweaks:

- **`validate.ts` step (d):** skip the guardrail for any comp lift whose `oneRepMaxKg`
  for that lift is `≤ 0` (extend the early-return at validate.ts:171) — don't clamp a real
  day into `[0, 0]`.
- **`index.ts` `strengthGuidance`:** omit the per-lift load line for a lift whose
  `oneRepMaxKg` is `≤ 0` instead of printing "0 kg", so the LLM is never told to program a
  0 kg day.

Part B touches the edge fn but adds **no new migration and no new deploy step** — it rides
the coaching engine's already-pending atomic redeploy (`docs/DEPLOY-CHECKLIST.md` §2).

### Surface

App (`strength.ts`) + edge (`validate.ts`, `index.ts`). Non-lift plans unaffected
(`buildStrengthPrescription` still returns `null` for `sport !== 'lift'` before any of
this); a fully-specified lifter (all three maxes > 0) is unaffected (no branch taken).

---

## Non-goals (out of scope)

- **Synthesized default 1RM** from bodyweight + experience tier (the "nicer" Fix #2
  option). Needs new bodyweight-ratio strength-standard math per
  `docs/coaching/powerlifting.md`; deferred to its own slice.
- The other open follow-ups (ultra `vertGainM` consumption; plan-builder first-visit
  pre-seed from `user_goals.goal_params`; `Sport` union for `fuel.ts`; triathlon
  day-split alignment) are untouched here.

---

## File-by-file change map

**App (`OSPREY-app/`):**
- `src/services/coaching/goal-map.ts` — **new.** `PrimaryGoalEnum`,
  `TRAINING_GOAL_TO_PRIMARY_GOAL`, `primaryGoalFromTrainingGoal`.
- `src/services/coaching/build-envelope.ts` — compute `effectiveGoal` from the posted
  preferences (fallback to the DB read); use it for `sport` + ultra/strength gating.
- `src/services/coaching/strength.ts` — return `null` when all three maxes are 0 (Part A).
- `src/services/coaching/__tests__/…` — goal-map inverse/exhaustiveness pin;
  invokeGeneratePlan override per sport; buildStrengthPrescription all-null → null.

**Edge (`supabase/functions/ozzie-generate-plan/`):**
- `validate.ts` — step (d) skips a comp lift whose `orm ≤ 0` (Part B).
- `index.ts` — `strengthGuidance` omits the load line for a `≤ 0`-orm lift (Part B).
- `*_test.ts` — guardrail leaves an `orm = 0` lift untouched; strengthGuidance omits
  0-orm lines; **all existing clamp/polarization/fuel tests stay green.**

---

## Acceptance criteria

1. Switching goal in the plan-builder yields the **new** sport's envelope on the **first**
   generation (verified for ultra / triathlon / swim / rowing / lift).
2. Background regen and race-event paths (no posted preferences) are **unchanged** —
   still driven by the DB read.
3. Onboarding is **unchanged** — the enum → TrainingGoal → enum round-trip is identity.
4. A paramless lifter (onboarding skip) gets the **general strength plan**, no "0 kg".
5. A partial-provide lifter's blank lifts are neither described as nor clamped to 0 kg.
6. **Non-lift and single-sport plans are byte-identical** — full Jest + Deno suites green.
7. No migration; Fix #2's edge tweak joins the existing pending redeploy bundle.
