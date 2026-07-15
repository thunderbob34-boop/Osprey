# Coaching-Engine Phase 3 (Powerlifting) — Design Spec

> Created 2026-07-15. The **second Phase 3 slice**. Turns `lift` ("Get stronger") from a generic bodybuilder-prompt
> stub into a real **powerlifting engine**: capture the athlete's squat/bench/deadlift 1RMs, build a block-periodized
> **%1RM + Prilepin + RPE** prescription (a new `strength` envelope field), rework the LLM prompt off its exercise
> whitelist, fix the run-primary routing bug, add meet peaking + a 9-attempt card, give lifters real nutrition, and
> add a server-side **load guardrail** in `validate.ts`. App + edge fn, **no migration** (the `lift` enum, the
> `goal_params` column, and the meet-date fields all already exist). Wires the dormant `calculators/powerlifting.ts`.
> Grounded in `docs/coaching/powerlifting.md` (the coaching source of truth).

## 1. Why this exists / what it delivers

Today a `lift` athlete's `blueprintSport('lift')` is `null`, so `computeEnvelope` returns `zones: null` and the LLM
gets a generic **bodybuilder** rule: 4–6 exercises from a fixed whitelist, reps as loose strings, **no %1RM, no RPE,
no Prilepin, no load**. `calculators/powerlifting.ts` already encodes the real math — `INTENSITY_ZONES`,
`prilepinRange`, `attemptSelector`, `powerliftingDailyNutrition` — but every symbol is **dead** (zero importers).

This slice makes `lift` a first-class powerlifting sport, per `docs/coaching/powerlifting.md`:
- **1RM capture (hybrid)** — pre-filled from logged sets, athlete confirms/edits (§3).
- **A block-periodized %1RM prescription** — phase → intensity zone + Prilepin caps + actual kg loads (§2/§4).
- **A reworked prompt** — real powerlifting programming instead of the whitelist (§6).
- **Lift-primary routing** — fixes the bug where a strength athlete gets more run than lift days (§7).
- **Meet peaking + a 9-attempt card** — reusing the sport-agnostic phase engine (§5/§8).
- **Real nutrition** — 4–7 g/kg carbs + fat, not the endurance defaults (§9).
- **A server-side load guardrail** — the strength equivalent of the pace-clamp (§10).

**No migration:** `lift` is an original `primary_goal_enum` value; `user_goals.goal_params` (JSONB, ultra added it)
and `target_date`/`total_weeks_planned` (meet date) all exist. The sport-agnostic `computeRacePhase` already yields
Base/Build/Peak/Taper for any dated goal.

## 2. Decisions locked in brainstorming

- **1RM source: HYBRID** — the athlete enters squat/bench/deadlift 1RMs, pre-filled from the logged-set Epley
  estimate (`services/lift-analytics.ts` `estimate1RM`/`bestE1rmKg`) when history exists; solves cold-start.
- **Full scope:** 1RM/goal/meet capture + strength envelope + prompt rework + routing fix + meet attempts +
  nutrition + the `validate.ts` guardrail.
- **Strength is a NEW `strength: StrengthPrescription | null` envelope field** (parallel to `zones`/`hrZones`/`fuel`),
  **not** a `ZoneSet` variant — there's no pace/split/power band to put in a `ZoneSet`. (Hyrox/crossfit can later
  reuse `StrengthPrescription`.)
- **The load guardrail lives in `validate.ts`** (user's explicit choice) — the FIRST `validate.ts` change since the
  2c-ii triathlon refactor. Regression gate: every existing pace-clamp + polarization test stays **byte-identical**.
- **No migration** — reuse `goal_params` + the `lift` enum + `target_date`.

## 3. Inputs + storage (`StrengthGoalParams`)

Stored in `user_goals.goal_params` (the existing JSONB — its shape is sport-specific), flattened into the envelope
exactly like ultra's `UltraGoalParams`:
```ts
type StrengthGoalParams = {
  oneRepMaxKg: { squat: number | null; bench: number | null; deadlift: number | null };
  goalThirdKg?: { squat: number | null; bench: number | null; deadlift: number | null }; // meet target 3rd; defaults to the 1RM
};
```
- **Hybrid capture:** the collection screen pre-fills `oneRepMaxKg` from `lift-analytics.ts` (`bestE1rmKg` per lift)
  when the user has logged working sets; the athlete confirms or overrides. `goalThirdKg` is optional (a competitor's
  target); when unset it defaults to `oneRepMaxKg` (attempt a PR at your current max).
- **Meet date:** reuse `user_goals.target_date` + `total_weeks_planned` (the run-race flow). Collected on the
  plan-builder for `lift` (today that branch hardcodes them `null` — `index.ts` preferences branch).
- **Plumbing mirrors ultra:** new `ultra-params.ts`-style `strength-params.ts` (`toStrengthParams` null-safe,
  `parseStrengthParams` for the form) → `EnvelopeInput.strengthParams` → `build-envelope.ts` reads `goal_params` when
  `primary_goal === 'lift'`. **Persist-before-generate on the plan-builder path, and thread `draft.goalParams` through
  `buildPlanPreferences`** — the two lessons from the ultra Critical (`services/onboarding.ts`), so a lifter's maxes
  aren't nulled on first generation.

## 4. The strength envelope (`StrengthPrescription`)

A new field on `CoachingEnvelope` (parallel to `zones`), populated by a `lift` branch in `computeEnvelope`:
```ts
type StrengthPrescription = {
  oneRepMaxKg: { squat: number; bench: number; deadlift: number };
  workingPercent1RM: number;              // the phase's representative %1RM (drives kg loads = % × 1RM)
  zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
  prilepin: { repsPerSet: [number, number]; totalReps: [number, number] }; // volume cap at workingPercent1RM
  attempts: { squat: AttemptPlan; bench: AttemptPlan; deadlift: AttemptPlan } | null; // Peak/Taper only
};
```
`computeEnvelope`, for `sport === 'lift'`: resolve `oneRepMaxKg` from `input.strengthParams`; map `input.phase` →
`workingPercent1RM` (§5) → `zone = intensityZoneForPercent1RM(pct)` + `prilepin = prilepinRange(pct)`; build
`attempts` only in Peak/Taper (§8). **Export `INTENSITY_ZONES` + `PRILEPIN_TABLE`** (or add accessors) — they're currently
module-private `const`s (`powerlifting.ts:30`/`:8`); the lookup fns are exported but the branch needs the zone rows.

## 5. Phase → intensity (block periodization)

Map the sport-agnostic phase to powerlifting's blocks (`powerlifting.md` §2). One representative working %1RM per
phase drives the zone + Prilepin lookup + the prescribed loads:

| Phase (engine) | Block (doc) | `workingPercent1RM` | Zone (via `intensityZoneForPercent1RM`) |
|---|---|---|---|
| Base | Accumulation | 80 | Strength-Volume (75–85%, RPE 7–8) |
| Build | Intensification | 88 | Max Strength (85–92%, RPE 8–9) |
| Peak | Peak | 95 | Peak/Test (93–100%+, singles) |
| Taper | Taper | 90 | openers only, light volume |

`STRENGTH_PHASE_PERCENT: Record<Phase, number> = { Base: 80, Build: 88, Peak: 95, Taper: 90 }`. A **dateless** lifter
stays in `Base` (a solid Strength-Volume block) — graceful degradation, same as ultra's race date.

## 6. Prompt rework (`index.ts`)

The `PLAN_SYSTEM_PROMPT` `lift_prescription` rule (`index.ts:41`, the bodybuilder whitelist) is reworked so that
**when a `strength` envelope is present**, lift days emit real powerlifting programming: a **comp lift to a top set at
`workingPercent1RM` (= that % × the athlete's 1RM, in kg) at the zone's RPE**, then **back-off volume within the
Prilepin `repsPerSet`/`totalReps` caps**, plus a variation and 2–3 accessories. In Peak/Taper, work toward the
attempt openers. A new `strengthGuidance` section in `envelopeGuidance` (`index.ts:334-339`, parallel to
`zoneGuidance`) carries the numbers (zone %1RM, RPE/RIR, Prilepin caps, the three 1RMs, the daily **protein + fat**
targets, and the attempt card when present). The exercise vocabulary shifts to a powerlifting list (comp lifts + pause/tempo/deficit variations +
accessories). The `Envelope` mirror (`index.ts:121-131`) gains `strength?: StrengthPrescription | null`.

## 7. Day-routing fix — lift-primary

Today `ENDURANCE_PRIMARY` (`goals.ts:18-26`) has no `lift` key → `routeDisciplineDays` defaults `discipline='run'`,
so a strength athlete at 5 days/wk gets **3 run + 2 lift** (`index.ts:514-515`, `ceil(0.6)` run / `floor(0.4)` lift).
Fix: `lift` routes **lift-primary** — the bulk of days are lift, with 1–2 optional easy-cardio days for recovery
(`powerlifting.md` §5, "2–3 easy low-intensity cardio"). Concretely: for `lift`, `weeklyLiftDays = primaryDays`,
`weeklyRunDays = min(2, daysPerWeek - primaryDays)` conditioning. Also fix `primaryDayLabel('lift')` →
`'Lift days per week'` (`sports.ts`, currently "Run days per week"). Apply to BOTH the plan-builder and the
background-regen path (`index.ts:584`).

## 8. Meet peaking + attempts

`attemptSelector(goalThirdKg)` (`powerlifting.ts:53`) → `{ opener ~89-91%, second ~95-96%, third ~100-102% }` of the
goal third. In `computeEnvelope`'s lift branch, when `phase ∈ {Peak, Taper}` and a goal third is available (explicit
`goalThirdKg`, else the `oneRepMaxKg`), build `attempts = { squat, bench, deadlift }` via `attemptSelector` per lift;
otherwise `null`. The prompt surfaces the attempt card in Peak/Taper. Attempt jumps (`attemptJumpRangePercent`) are
included in the guidance text. The phase timing itself is free from `computeRacePhase` (§1).

## 9. Nutrition (`fuel.ts` lift branch)

`computeFuel('lift', bw)` today gives a lifter **endurance** carb periodization + a marathon in-session rate
(`fuel.ts:19`). Add a `lift` branch using `powerliftingDailyNutrition(bw)` (`powerlifting.ts:65`): daily **carbs
4–7 g/kg** mapped across `dailyCarbGByDayType` by training volume (rest/easy at the low end, high-volume days at the
high end), protein at 1.6–2.2 g/kg (already computed by `computeFuel`), and `longSessionCarbGPerHour: 0` (no
endurance in-session fueling). **Fat (0.8–1.5 g/kg)** + creatine/caffeine are surfaced in the `strengthGuidance`
prompt block (fat is not added to `FuelPlan` — keeps the shared fuel shape unchanged).

**Surface protein in the prompt — all sports, not just lift.** `computeFuel` already computes `proteinG` (1.6–2.2
g/kg) for every sport and it rides the envelope, but the shared fuel line in `envelopeGuidance` (`index.ts:338`)
states only carbs — so the LLM is never told the protein target, and generated plans don't coach it. Add the protein
target to that line so **every** generated plan (ultra, the endurance sports, and lift) states it. Additive prompt
text — no computed value or behavior changes, and no test asserts the prompt string. (The universal 1.6–2.2 matches
powerlifting exactly and sits a touch above ultra's doc range of 1.6–2.0 — acceptable; the value isn't re-tuned
here.)

## 10. Load guardrail (`validate.ts`) — the one risky change

Add a `lift`-only guardrail that runs after polarization (parallel to the pace-clamp, which it leaves untouched):
for each `session_type === 'lift'` day, if the LLM's `lift_prescription` names a comp lift (squat/bench/deadlift)
with a load, **clamp that load into the zone's %1RM band** (`zone.percent1RM.min/max × the matching 1RM`) and clamp
reps into the Prilepin `repsPerSet`; log the change to `changed[]`. `EnvelopeLike` (`validate.ts:24`) gains an
optional `strength` mirror. **Regression gate:** the pace-clamp (`paceZoneForSession`/`bandFor`), the carb-attach,
and polarization stay **byte-identical** — every existing `validate.test.ts` test unchanged. The guardrail is a new,
isolated, `lift`-gated function; non-lift plans never enter it. (If a lift day carries no structured load, it passes
through — the guardrail only tightens explicit numbers, never invents them.)

## 11. Compatibility & deploy

- **App + edge fn, NO migration.** `lift` enum + `goal_params` + `target_date` all exist. Joins the go-live atomic
  app+edge redeploy coupling (`DEPLOY-CHECKLIST.md` §2). A new-app lift plan hitting the *old* fn gets the generic
  bodybuilder prompt (soft degrade — no strength field consumed).
- **Non-lift plans byte-identical:** every strength behavior is gated on `sport === 'lift'` (envelope branch, fuel
  branch, day-routing, the guardrail) or `goal === 'lift'`. `zones`/`hrZones`/pace-clamp/polarization untouched.
- `goal_params` is nullable and sport-shaped → backward-compatible.

## 12. Testing (TDD)

- **App (Jest):** `strength-params` parse/flatten (hybrid pre-fill + null-safe); `computeEnvelope('lift')` builds the
  `StrengthPrescription` (phase→zone/percent/Prilepin; attempts only in Peak/Taper; attempts default to 1RM when no
  goal third); `computeFuel('lift')` gives powerlifting carbs + protein 1.6–2.2 g/kg + `longSessionCarbGPerHour: 0`; the lift-primary routing
  (`routeDisciplineDays('lift', …)` → lift-primary + ≤2 cardio); **regression — non-lift envelopes/fuel/routing
  byte-identical**; the `buildPlanPreferences` 1RM-round-trip pin (the ultra-Critical lesson).
- **Edge (Deno):** the `validate.ts` load guardrail (clamps an out-of-band lift load into the `%1RM × 1RM` band + reps
  into Prilepin; a non-lift plan and a structured-load-free lift day pass through untouched); **every existing
  pace-clamp/polarization test byte-identical** (the regression gate for touching `validate.ts`).
- **Shared protein-in-prompt (all sports):** the `envelopeGuidance` fuel line now states the protein target for every
  sport — additive prompt text, so verify via `deno check` + the full Deno suite staying green (no test asserts the
  exact prompt string, so no behavior regression).
- Full Jest + Deno suites green; `no-restricted-syntax`/lint clean.

## 13. Risks & open questions

- **The `validate.ts` guardrail is the highest-risk change** (first since triathlon). Mitigation: a small, isolated,
  `lift`-gated function; the byte-identical regression gate on every existing clamp/polarization test is the hard
  line; single-purpose tests pin the new behavior.
- **The prompt rework is the biggest LLM-facing change** — the model must emit structured loads from the numbers.
  Mitigation: the `strengthGuidance` carries exact %1RM/kg/RPE/Prilepin so the model rarely improvises; the guardrail
  catches drift.
- **Hybrid pre-fill accuracy** — the Epley e1RM is an estimate; the athlete confirms/edits, so it's a starting value,
  not a silent source of truth.
- **`workingPercent1RM` is one representative % per phase** (a simplification of the doc's per-block ranges) — keeps
  the prescription legible; the zone band carries the fuller range for the LLM.
- **The fuel shape** (`FuelPlan`'s endurance-centric `longSessionCarbGPerHour`) is set to 0 for lift + fat lives in
  the prompt — avoids widening the shared type; revisit if a first-class macro shape is wanted later.

## 14. Out of scope

Conjugate/DUP micro-periodization; per-lift individual phase offsets; equipped (geared) lifting; weight-cut/making-
weight logic; a bespoke macro/FuelPlan redesign; auto-updating 1RMs from ongoing logs mid-plan; the other Phase 3
sports (hyrox/crossfit) and the polish items; changing the LLM.
