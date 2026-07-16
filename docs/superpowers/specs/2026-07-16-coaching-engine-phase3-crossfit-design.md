# Coaching-Engine Phase 3 — CrossFit (base engine + benchmarks) — Design

**Date:** 2026-07-16
**Status:** Approved (design) — ready for implementation plan
**Origin:** Phase 3 finale — the last sport (roadmap `docs/superpowers/specs/2026-07-14-coaching-engine-fidelity-design.md` §11). Domain SoT `docs/coaching/crossfit.md`.

Make `crossfit` a real, periodized coaching goal with its **3 concurrent modalities** — strength, engine, gymnastics/metcon — **plus benchmark testing**. This is the largest Phase 3 slice and the only genuinely net-new one (crossfit is not a goal anywhere yet).

**Scope = the 3-modality base engine + benchmark testing** (user's choice). **Deferred to follow-on slices** (non-goals here): structured gymnastics skill progressions, Open-week competition-peaking depth, Olympic-lift technical progressions.

---

## Global Constraints

- **Non-crossfit plans MUST stay byte-identical.** All crossfit logic is gated on `sport === 'crossfit'`. Every existing envelope / fuel / validate / routing test stays green, unchanged.
- **ONE new migration** — `ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'crossfit';` (additive, idempotent, mirrors `20260715000002_ultra_primary_goal.sql`). This is the first slice to add a *new* enum value; it **joins the coaching engine's already-pending atomic redeploy bundle** (now 5 migrations) — apply via MCP `apply_migration` **before/with** the `ozzie-generate-plan` redeploy (the fn upserts the value).
- **App + edge deploy atomically.** The `envelope.crossfit` contract and the edge prompt block must agree.
- **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test` (Jest). **Edge tests:** `deno test supabase/functions/ozzie-generate-plan/` (Deno).
- **Mirror, don't share** — the edge fn hand-mirrors the app's `CrossfitPrescription` shape, pinned per side.
- **TDD.** Failing test → minimal code → green.

---

## 1. Goal plumbing (net-new) + the migration

- **Migration** (new): `ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'crossfit';`
- `TrainingGoal` (`types/preferences.ts`) + `PrimaryGoal` (`types/onboarding.ts`) gain `'crossfit'`.
- `goal-map.ts`: `TRAINING_GOAL_TO_PRIMARY_GOAL` + `PrimaryGoalEnum` gain `crossfit: 'crossfit'`; the inverse-pin test covers it. Edge `PRIMARY_GOAL_MAP` (`index.ts`) gains `crossfit: 'crossfit'`.
- **`blueprintSport('crossfit')` needs NO change** — it already returns `null` for unlisted goals, so crossfit gets `zones: null` + the universal `hrZones` for its engine (like weight_loss/general). `computeEnvelope`'s zone dispatch is untouched.
- `routeDisciplineDays` (edge `goals.ts`): a crossfit branch — a strength/lift-anchored mixed-modal split (lift days for the strength anchor + engine days), the prompt programming concurrent modalities within sessions.
- The goal picker on onboarding (`goals.tsx`) + plan-builder (`preferences.tsx`).

## 2. `goal_params` → `CrossfitGoalParams`

New module `src/services/coaching/crossfit-params.ts` (mirroring the other `*-params`):

```ts
export interface CrossfitGoalParams {
  oneRepMaxKg: { backSquat: number | null; deadlift: number | null; press: number | null };
  competing: boolean;         // Open/compete vs general fitness
  franSec: number | null;     // the athlete's Fran PR — seeds the benchmark read
}
export function toCrossfitParams(raw: unknown): CrossfitGoalParams | null;   // null if no valid data
export function parseCrossfitParams(input: {...}): ParseResult<CrossfitGoalParams>;
```

`GoalParams` union (in `strength-params.ts`) gains `| CrossfitGoalParams`. A `competing` athlete with a `target_date` gets Base/Build/Peak/Taper (= CrossFit's Base/Build/Competition/Deload) via the existing `computeRacePhase` — **no new periodization**.

## 3. The 3-modality model → `crossfit: CrossfitPrescription | null` envelope field

A new field parallel to `strength`/`hyrox`, crossfit-gated (non-crossfit → null → byte-identical). It **composes** existing machinery:

- **Strength** — light %1RM by phase for the three lifts, reusing powerlifting's exported `intensityZoneForPercent1RM`. A **crossfit-specific** `CROSSFIT_PHASE_PERCENT` (concurrent strength, lower/broader than powerlifting's peaking curve — e.g. Base ~78 / Build ~85 / Peak ~88 / Taper ~80; tunable). `strengthLoadsKg = round(1RM × pct/100)` per lift (only for lifts with a 1RM).
- **Engine** — `hrZones` (already on every envelope) + the wired `ENERGY_SYSTEM_ZONES` from `calculators/crossfit.ts` (phosphagen/glycolytic/threshold/aerobic-base by time domain + work:rest).
- **Gymnastics + metcon** — prompt-driven (skill work + WODs across the four time domains, keyed to the energy systems and the phase emphasis).

```ts
export interface CrossfitPrescription {
  strengthLoadsKg: { backSquat: number; deadlift: number; press: number };   // 0 for a lift with no 1RM
  workingPercent1RM: number;
  energySystems: EnergySystemZone[];   // the 4 zones (reference for metcon programming)
  benchmark: BenchmarkFocus;           // §4
}
```

`buildCrossfitPrescription(input)` returns null when `sport !== 'crossfit'` **or** `crossfitParams` is absent (onboarding-skip → a generic mixed plan via `hrZones`, the paramless-lift lesson). Otherwise it builds the prescription, with `strengthLoadsKg` 0 for any lift lacking a 1RM (the prompt then programs that lift by RPE) and no Fran tier when `franSec` is null.

## 4. Benchmark testing (the fuller addition)

- **Library** `CROSSFIT_BENCHMARKS` (new, in `calculators/crossfit.ts` or a `crossfit-benchmarks.ts`): the five iconic WODs — **Fran, Grace, Helen, Cindy, Murph** — each with its movements, time domain, and normative score/time by tier (beginner → elite).
- **Focus selection:** the envelope picks a phase-appropriate benchmark to test (e.g. Fran entering Build, a Hero/longer one before Competition) → `BenchmarkFocus = { name, timeDomain, normativeByTier, athleteFranSec, franTier }`.
- **Limiter read (lean):** the athlete's `franSec` is bucketed against the Fran normative tiers → a `franTier`. Surfaced to the prompt as a conditioning signal ("Fran is intermediate — [ahead of / behind] your compete target"), biasing the modality emphasis. (A richer multi-dimensional limiter — strength-tier vs engine-tier vs gymnastics-tier — is deferred.)
- The prompt programs the benchmark WOD at the right phase + the norm-informed emphasis.

## 5. Fuel, prompt, collection
- **Fuel** — `computeFuel` crossfit branch, wiring `crossfitDailyNutrition` (carbs 4–8 g/kg, protein 1.6–2.2), mirroring the lift/hyrox branches; `longSessionCarbGPerHour` a sensible in-session rate.
- **Prompt** — edge `crossfitGuidance` block (in `guidance.ts`) + `Envelope.crossfit` mirror (in `index.ts`): the 3 modalities programmed **concurrently** with the phase emphasis (Base = strength + aerobic base + skill; Build = strength-endurance + threshold + gymnastics volume; Peak/Competition = mixed-modal peaking; Taper/Deload = freshness), the strength loads, the energy-system work:rest for metcons, and the benchmark test + normative read. Gymnastics/metcon movements go in session descriptions/`ozzie_notes` (not the `lift_prescription` whitelist — the powerlifting-slice lesson).
- **Collection UI** — three 1RM inputs (back squat / deadlift / press) + a compete toggle + an optional Fran time, on onboarding baseline + plan-builder; persist-before-generate.

## 6. Envelope-resolution integration
Extend `resolveGoalInputs` (build-envelope.ts) to gate `crossfitParams` on `effectiveGoal === 'crossfit'` (via `toCrossfitParams`) — so a plan-builder goal-switch to crossfit builds the right envelope on the first generation, and `invokeGeneratePlan`'s DB read gates it the same way.

---

## Non-goals (deferred to follow-on slices)

- **Gymnastics skill progressions** (pull-up → C2B → muscle-up, HSPU → handstand walk) — prompt handles skill work generically for now; a structured progression graph is its own slice.
- **Open-week competition peaking depth** (Open-style workouts, redline/pacing, 3-week Open management) — the base gives Base/Build/Competition/Deload periodization; the specialized peaking is deferred.
- **Olympic-lift technical progressions**; a **multi-dimensional benchmark limiter**; benchmarks beyond the five.

---

## File-by-file change map

**App (`OSPREY-app/`):**
- `src/services/coaching/crossfit-params.ts` — **new.** `CrossfitGoalParams`, `toCrossfitParams`, `parseCrossfitParams`.
- `src/services/coaching/strength-params.ts` — `GoalParams` union `| CrossfitGoalParams`.
- `src/services/calculators/crossfit.ts` — **add** `CROSSFIT_BENCHMARKS` library + the tier-bucketing helper (energy-systems + nutrition already exist).
- `src/services/coaching/crossfit.ts` — **new.** `CrossfitPrescription`, `CROSSFIT_PHASE_PERCENT`, `buildCrossfitPrescription`, benchmark-focus selection.
- `src/services/coaching/envelope.ts` — `EnvelopeInput.crossfitParams?`; `CoachingEnvelope.crossfit`; wire `buildCrossfitPrescription`.
- `src/services/coaching/fuel.ts` — crossfit branch.
- `src/services/coaching/build-envelope.ts` — read `crossfitParams` (gated on `crossfit`) + extend `resolveGoalInputs`.
- `src/services/coaching/goal-map.ts` — `crossfit` in the map + type.
- `src/types/preferences.ts` + `src/types/onboarding.ts` — `'crossfit'` in `TrainingGoal`/`PrimaryGoal`.
- `app/(onboarding)/goals.tsx` + `baseline.tsx` + `app/preferences.tsx` — goal option + collection fields.
- `src/services/coaching/__tests__/…` — params, prescription (+ null non-crossfit), fuel, benchmark tiering, goal-map inverse pin.

**Edge (`supabase/functions/ozzie-generate-plan/`):**
- `index.ts` — `PRIMARY_GOAL_MAP` + `Envelope.crossfit` mirror + call `crossfitGuidance`.
- `guidance.ts` — `CrossfitInfo` + `crossfitGuidance`.
- `goals.ts` — `routeDisciplineDays` crossfit branch.
- `*_test.ts` — crossfit guidance present/absent; non-crossfit byte-identical.

**Migration (`supabase/migrations/`):**
- `<ts>_crossfit_primary_goal.sql` — **new.** `ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'crossfit';`

---

## Testing & acceptance criteria

1. `crossfit` is selectable end-to-end (goal-map inverse pin holds; a goal-switch to crossfit builds the crossfit envelope on the first generation via `resolveGoalInputs`).
2. The crossfit envelope carries `crossfit` (strength loads at the phase %1RM; the energy-system zones; the benchmark focus with the athlete's Fran tier); non-crossfit carries `crossfit: null`.
3. Engine = `hrZones` (no ZoneSet change; `blueprintSport`/`computeEnvelope` zone dispatch untouched).
4. Crossfit fuel = 4–8 g/kg carbs + 1.6–2.2 protein; other sports unchanged.
5. The benchmark tiering buckets a Fran time to the right tier; the edge prompt gains the crossfit block only when `envelope.crossfit` is present; gymnastics/metcon work is in descriptions/notes, not the whitelist.
6. A paramless crossfit athlete degrades gracefully (`crossfit: null` → generic mixed plan via hrZones).
7. **Non-crossfit plans byte-identical** — full Jest + Deno suites green. **One new migration** (crossfit enum), joining the pending atomic redeploy.
