# Webapp All-Sports Coverage — sport-aware calendar + full-parity editable zones — Design

**Date:** 2026-07-16
**Status:** Approved (design) — ready for implementation plan
**Origin:** First slice of the "make the webapp a real product" program (verify → build → deploy). The webapp is the **analyst surface** (`docs/MASTER-PLAN.md`); today it is endurance/running-centric. This slice makes it coherent for all 9 sports the mobile coaching engine now supports (run, swim, bike, rowing, triathlon, ultra, powerlifting/lift, hyrox, crossfit).

The runner-assumption lives in exactly two places, confirmed by reading the code:
1. **Calendar** — the Race Predictor card (`webapp/src/routes/_authed/calendar.tsx:144-162`) is always rendered and only understands runs; a powerlifter permanently sees *"Log a completed run…"*.
2. **Zones card** — `TrainingZonesCard.tsx` only offers run/swim/row/bike; lift/crossfit/hyrox athletes have no anchors/loads view.

Session tiles + the detail pane already render every sport (they read `session_type` generically), so they are untouched.

---

## Global Constraints

- **Scoped to `webapp/`.** No edge-function change, **no new migration** — every column read/written already exists (`user_goals.primary_goal`, `goal_params`, `target_race`, `target_date`, `total_weeks_planned`; writes reuse the existing `user_goals` UPDATE the endurance card already performs). **One optional 1-line change in `OSPREY-app`** (export three currently-private phase-percent consts — see §2), no behaviour change.
- **Endurance behaviour stays byte-identical.** All strength/hybrid logic is additive and gated on `primary_goal`. The existing **91 webapp tests stay green, unchanged.**
- **Full parity.** The ported strength/crossfit/hyrox math must equal the `OSPREY-app` originals, pinned by parity tests that mirror `webapp/tests/zone-parity.test.ts`. The webapp cannot import `OSPREY-app` code (separate build), so ported modules copy the math verbatim under a "keep in sync with OSPREY-app — see <path>" header, exactly as `webapp/src/lib/training-zones.ts` already does for endurance.
- **Merge-preserving writes.** Editing a 1RM/Fran/division reads the current `goal_params` JSONB, sets the one nested field, and writes back — never clobbering keys the mobile app owns (`competing`, `franSec`, other sports' params).
- **Commands:** tests `cd webapp && npm test` (vitest, `TZ=America/New_York` per `package.json`); typecheck `npm run typecheck`; build `npm run build`.
- **TDD** for all pure logic (ported math, phase, merge helpers, validation). The card + calendar wiring are typecheck + build + preview.

---

## 1. Sport awareness (the enabling foundation)

The webapp reads `user_goals` today but never `primary_goal` or `goal_params`. Add:

- A `PrimaryGoal` type in the webapp mirroring `OSPREY-app/src/types/onboarding.ts` (the plan pins the exact union). The webapp only branches on `lift`/`crossfit`/`hyrox` (strength section) and `run`/`ultra`/`triathlon` (predictor gate); every other value falls through to today's endurance behaviour.
- A consolidated read `useUserGoal(userId)` (in `settings/queries.ts`) selecting `primary_goal, goal_params, target_race, target_date, total_weeks_planned, threshold_anchor` from `user_goals` in one `maybeSingle()` — so the card and calendar each add at most one query. Derived hooks (`usePrimaryGoal`, `useRaceGoal`, `useGoalParams`) may wrap it or select narrowly; the plan decides.

## 2. Ported coaching math (`webapp/src/lib/`) + parity tests

Each module is a verbatim port of the cited `OSPREY-app` source, pure, with the sync header:

- **`race-phase.ts`** ← `OSPREY-app/src/services/plan.ts:8-74`. Ports `RaceGoal`, `RacePhaseInfo`, `RacePhaseName`, and `computeRacePhase(goal, now?)` — endurance periodization (Base 0–40% / Build 40–75% / Peak 75–90% / Taper = final 1–3 weeks by plan length). Returns `null` when `targetDate` or `totalWeeksPlanned` is absent; **the display layer treats null as `Base`** (general-prep fallback for an undated goal).
- **`strength-loads.ts`** ← `calculators/powerlifting.ts:30,38` (`INTENSITY_ZONES`, `intensityZoneForPercent1RM`) + `coaching/strength.ts:17` (`STRENGTH_PHASE_PERCENT = {Base:80, Build:88, Peak:95, Taper:90}`). Exposes `strengthWorkingLoads(oneRepMaxKg, phase)` → per-lift working kg `= Math.round(oneRepMax × pct/100)` plus the zone label from `intensityZoneForPercent1RM(pct)`.
- **`crossfit-zones.ts`** ← `coaching/crossfit.ts:8` (`CROSSFIT_PHASE_PERCENT = {Base:78, Build:84, Peak:88, Taper:80}`, `BENCHMARK_BY_PHASE`) + `calculators/crossfit.ts:10,43,52` (`ENERGY_SYSTEM_ZONES`, `CROSSFIT_BENCHMARKS`, `franTier`). Reuses `intensityZoneForPercent1RM` from `strength-loads.ts`.
- **`hyrox-loads.ts`** ← `coaching/hyrox.ts:11-32`. Compromised-run split (`predictCompromisedRunSplit` from the athlete's threshold sec/mi → sec/km) + `stationWeights` by division. The run anchor reuses the existing Run row.
- **Parity tests** (`tests/{strength,crossfit,hyrox,race-phase}-parity.test.ts`): pin the ported constants + representative outputs to the `OSPREY-app` originals' known values — the mobile tests already assert these (`coaching/__tests__/strength.test.ts` → 80, `crossfit.test.ts` → 78, `envelope.test.ts:243` → 84). Because the webapp can't import mobile code, the expected values are hardcoded and annotated with the source `file:line`. **This is the keep-in-sync cost the "full parity" choice accepts.**
- **Optional (`OSPREY-app`, 1 line each):** change `STRENGTH_PHASE_PERCENT`, `CROSSFIT_PHASE_PERCENT`, `BENCHMARK_BY_PHASE` from module-private `const` to `export const`, so the canonical values are greppable from the parity tests' comments. No behaviour change.

## 3. Calendar sport-awareness

- **Gate the Race Predictor** (`calendar.tsx:144-162`) to running-race goals — render only when `primary_goal ∈ {run, ultra, triathlon}` (a run-time prediction is meaningless for swim/bike/row/lift/crossfit/hyrox). This removes the permanent *"Log a completed run…"* card for every non-running-race athlete (a deliberate, correct behaviour change for swim/bike/row/weight_loss/general too).
- **Add a Phase chip** to the aside: *"Phase · Build — week 4 of 12"*, from `computeRacePhase(useRaceGoal(...))`. Rendered only when a dated plan yields a non-null phase; omitted for undated goals. Sport-agnostic — every dated plan gets it.
- Session tiles + detail pane: unchanged.

## 4. Zones card — full-parity, editable strength/hybrid section

- Endurance rows (`run/swim/row/bike`) unchanged.
- Add a strength/hybrid section, rendered for the athlete's `primary_goal`:
  - **lift** — squat/bench/deadlift 1RM inputs (editable) → `strengthWorkingLoads(phase)`: per-lift working kg + working %, and a 70/80/90% reference ladder.
  - **crossfit** — backSquat/deadlift/press 1RMs + Fran (mm:ss) + competing toggle (editable) → phase strength loads, the `ENERGY_SYSTEM_ZONES` work:rest table, and `BENCHMARK_BY_PHASE[phase]` + the `franTier` read.
  - **hyrox** — division select (editable) → compromised-run pace + station weights (its run anchor is the existing Run row).
- Phase resolved via `computeRacePhase(useRaceGoal)`, **Base fallback** when undated, labelled (*"Base — general prep"*).
- Values respect `useUnits` (imperial/metric); stored metric.
- **Edit → `goal_params` merge-write:** new `webapp/src/lib/goal-params.ts` (zod schemas + `setGoalParamsField`-style merge helpers, mirroring `webapp/src/lib/threshold-anchor.ts`) + `useGoalParams`/`useUpdateGoalParams` in `settings/queries.ts`. The update reads current `goal_params`, merges one nested field, writes back via the `user_goals` UPDATE, reusing the empty-result guard from `useUpdateThresholdAnchor` (`queries.ts:66-79`). Per-sport validation mirrors the mobile bounds: 1RM kg `0 < x ≤ 600`; `franSec 0 < x ≤ 3600`; division ∈ the hyrox enum.

## Data model — reads & writes

- **Reads:** `user_goals.{primary_goal, goal_params, target_race, target_date, total_weeks_planned}` (+ `threshold_anchor` already read).
- **Writes:** `user_goals.goal_params` only, via the existing `user_goals` UPDATE grant. **No migration, no new grant.**

## Error handling / edge cases

- No `goal_params` for the sport → the "not set — enter to personalize" prompt (like the endurance empty state at `TrainingZonesCard.tsx:78`).
- Partial 1RMs → derive loads for the lifts present, prompt for the rest.
- Undated goal → `Base` fallback for card loads; no phase chip on the calendar.
- Merge-write against a missing `user_goals` row → the same surfaced error the endurance card already throws.
- Invalid input → inline error, no write.

## Non-goals (out of scope)

Deploy/go-live; plan editing; home dashboard; Ozzie chat; plan generation/regeneration from the web; onboarding; any change to the coaching math itself (pure port); endurance-row changes; any migration or edge-function change. `weight_loss`/`general` get no strength section (and, correctly, lose the run predictor via the §3 gate).

---

## File-by-file change map

**Webapp (`webapp/`):**
- `src/lib/race-phase.ts` — **new.** Port of `computeRacePhase` + types.
- `src/lib/strength-loads.ts` — **new.** Port: intensity zones + `STRENGTH_PHASE_PERCENT` + `strengthWorkingLoads`.
- `src/lib/crossfit-zones.ts` — **new.** Port: `CROSSFIT_PHASE_PERCENT`, energy systems, benchmarks, `franTier`.
- `src/lib/hyrox-loads.ts` — **new.** Port: compromised split + station weights.
- `src/lib/goal-params.ts` — **new.** Zod schemas per sport + merge helpers.
- `src/lib/sports.ts` (or extend `schemas.ts`) — `PrimaryGoal` type/enum mirroring the mobile union.
- `src/features/settings/queries.ts` — `useUserGoal` + `useGoalParams` + `useUpdateGoalParams` (merge-write).
- `src/features/settings/TrainingZonesCard.tsx` — add the strength/hybrid section (likely a `StrengthZones` subcomponent).
- `src/features/calendar/queries.ts` — expose `primary_goal` + `RaceGoal` (or reuse `useUserGoal`).
- `src/routes/_authed/calendar.tsx` — gate the predictor + render the phase chip.
- `tests/{strength,crossfit,hyrox,race-phase}-parity.test.ts`, `tests/goal-params.test.ts` — **new.**

**OSPREY-app (optional, non-blocking):**
- `src/services/coaching/{strength,crossfit}.ts` — `export` the three phase-percent consts.

---

## Testing & acceptance criteria

1. **Parity:** the ported strength/crossfit/hyrox/phase functions equal the `OSPREY-app` originals across representative inputs — working percents (Base 80/78, Build 88/84, Peak 95/88, Taper 90/80), `franTier` buckets, compromised split, energy-system table — parity tests green.
2. **Phase:** a dated goal's phase/week matches `computeRacePhase`; an undated goal falls back to `Base` for card loads and shows **no** calendar chip.
3. **Calendar:** the Race Predictor renders only for `run`/`ultra`/`triathlon`; the phase chip renders on dated plans; endurance + session rendering otherwise unchanged.
4. **Zones card:** the strength/hybrid section renders per `primary_goal`; edits merge-write to `goal_params` **preserving sibling keys**; validation bounds enforced; endurance rows unchanged.
5. **Regression:** the existing **91 webapp tests stay green**; `npm run typecheck` and `npm run build` clean.
6. **No backend change:** no migration, no edge change; `goal_params` writes go through the existing grant.
