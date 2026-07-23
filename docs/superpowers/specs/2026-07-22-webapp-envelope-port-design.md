# Webapp Envelope-Building Port — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan built from this spec.

**Goal:** Give the webapp's two plan-generation call sites (`usePlanSync`, `useBuildPlanForRace`) a real, personalized envelope to post to `ozzie-generate-plan` — matching what mobile has always done — so `validateAndClamp` (pace clamp, polarization, lift-load guardrail, fuel) actually runs for webapp-originated plans, for every sport the webapp already supports.

**Architecture:** Port the missing pieces of mobile's `OSPREY-app/src/services/coaching/{envelope,periodization,fuel,hr,anchor}.ts` dependency graph into `webapp/src/lib/`, reusing the zone-band math and DB-shape helpers already ported there (parity-tested against the mobile originals). Extend the three existing display-oriented "loads" files (`strength-loads.ts`, `hyrox-loads.ts`, `crossfit-zones.ts`) with the higher-level prescription-builder logic they're already partial ingredients of, rather than creating parallel files. Add one new DB-reading orchestrator (`build-envelope.ts`) that assembles the envelope input and calls the new `computeEnvelope` port, matching mobile's own per-query resilience (log and degrade, never let one failed read block the whole build). Wire the result into both existing call sites.

**Tech Stack:** TypeScript, Vite/React (webapp), `@tanstack/react-query`, existing Vitest parity-test convention (`webapp/tests/*-parity.test.ts` importing the mobile originals directly and asserting byte-equality — see `zone-parity.test.ts`, `race-phase.test.ts`, `fitness-load-parity.test.ts` for the established pattern).

## Why this exists (context, not itself a requirement)

An audit finding cited a real prescribed session reading "45 min for 7.00 km" — inconsistent with the athlete's own easy pace. Root-causing this live traced it to `webapp/src/features/calendar/queries.ts`'s `useBuildPlanForRace` (and, less visibly, `webapp/src/features/home/queries.ts`'s `usePlanSync`, which auto-fires once per day for every authenticated webapp session): both POST to `ozzie-generate-plan` without an `envelope` field at all, so the edge function's entire `validateAndClamp` guardrail — pace clamp, polarization cap, lift-load %1RM clamp, fuel attachment — silently never runs. A code comment in `usePlanSync` already flagged this as deliberate, deferred scope: "requires re-deriving mobile's full threshold/rowing/hyrox-params assembly (`build-envelope.ts`), which is a separate, larger port." This spec is that port.

Scoping this properly (not just wiring together what already exists) found: the webapp already has parity-tested *zone-band display* math (`training-zones.ts`, `race-phase.ts`, `strength-loads.ts`, `hyrox-loads.ts`, `crossfit-zones.ts`, `baseline.ts`, `threshold-anchor.ts`), but none of the *generation-time orchestration* math mobile's `envelope.ts`/`build-envelope.ts` layer on top of it — `computeEnvelope`, `resolveZones`, `targetWeeklyLoad`, `computeFuel`, `resolveMaxHR`, the strength/Hyrox/CrossFit prescription builders, and the athlete's-best-recent-effort selection functions all have zero webapp counterpart, and two DB tables (`body_metrics`, rowing `workout_logs`) have no webapp read path at all.

**Ultra is explicitly excluded from this port** — confirmed there is zero ultra-specific logic or UI anywhere on the webapp today (not a gap in an existing port, a whole sport that was never built there). Porting `ultra-params.ts` + `calculators/ultra.ts`'s taper/distance-factor math for a sport nothing on the webapp currently lets an athlete select is out of proportion to the actual problem being fixed. If a webapp ultra experience is ever built, its envelope support is that project's own scope.

## Global Constraints

- **Byte-parity with mobile for every ported pure function**, verified the same way every existing port already is: a Vitest test importing the mobile original directly and asserting equality across representative inputs (matching `zone-parity.test.ts`'s established pattern). This is not optional polish — it's how this codebase already guards against the exact class of silent drift a second hand-port risks.
- **No changes to already-shipped, already-working webapp code these fixes don't need to touch.** Specifically: `goal-params.ts`'s existing `parse*Params` functions (their documented null-contract divergence from mobile's `to*Params` is adapted to at the new envelope-builder's boundary, not "fixed" upstream) and `useBestRun` (calendar's longest-run display; the envelope-builder gets its own dedicated best-*quality*-effort query rather than repurposing a hook serving a different, legitimate use case) are explicitly left alone.
- **Resilience matches mobile's own established pattern exactly**: each of the envelope-builder's DB reads degrades independently (log a warning, fall back to a safe default) rather than throwing and blocking the whole plan-generation call — mirroring `build-envelope.ts`'s existing `if (goalsRes.error) console.warn(...)` treatment for every one of its five queries today.
- **No edge-function or mobile changes.** This is a webapp-only port; `ozzie-generate-plan` already knows how to consume a real envelope (that's what makes mobile-originated plans work correctly today) — nothing about its contract changes.
- **No new database migration.** Both new DB reads (`body_metrics`, rowing `workout_logs`) are reads against existing tables/columns already used elsewhere in this codebase for other purposes.
- Ultra stays entirely out of scope, as above — no `ultra-params.ts`/`calculators/ultra.ts` port, no ultra branch added to any new webapp file.

## Component 1 — `periodization.ts`

Port `targetWeeklyLoad` (the actual weekly-load/progression-cap math driving how hard a generated week gets prescribed) and its two `calculators/shared.ts` dependencies (`applyVolumeCut`, `maxWeeklyProgression`). Pure, no I/O. Parity-tested against `OSPREY-app/src/services/coaching/periodization.ts` and its shared-calculator deps across a representative phase/week matrix (Base/Build/Peak/Taper, loading-week 1-4, with and without a `prevWeekLoad`).

## Component 2 — `fuel.ts`

Port `computeFuel` (per-sport daily carb/protein ranges + in-session carb rate), reusing the calculator-level fuel functions already implicitly needed by other ported files where they overlap (e.g. `powerliftingDailyNutrition`, already partially present via `strength-loads.ts`'s ecosystem — confirm and reuse rather than re-port during implementation) and porting the rest (`runningRaceFuelGPerHour`, `cyclingInRideCarbGPerHour`, `swimMeetDayCarbGPerHour`, `hyroxDailyNutrition`/`hyroxInRaceCarbGPerHour`, `crossfitDailyNutrition`, `dailyCarbGrams`) fresh. The ultra branch (`ultraRaceCarbGPerHour`) is omitted — `sport` can never actually be `'ultra'` from a webapp-originated call, since no webapp UI lets an athlete select it. Parity-tested per sport.

## Component 3 — `hr-zones.ts`

Port `resolveMaxHR` and `ultraHRZones` (the general HR-zone-band calculator every sport's envelope carries as a fallback — the mobile name is misleading; despite "ultra" in the name, it is called unconditionally for every sport's `hrZones` field, not gated on the athlete's goal being ultra, and this port keeps that same unconditional behavior). Parity-tested against both observed-maxHR and estimated-fallback inputs.

## Component 4 — `anchor.ts`

Port `selectBestRunEffort`, `selectBestRowingSplit`, `resolveRunningAnchor`, and the tier-estimate fallback functions (`estimateSwimCssByTier`, `estimateRowingSplitByTier`, and the run/swim/rowing tier-estimate tables) not already covered by the existing `baseline.ts` port (which already has `deriveThresholdSecPerMile` — reuse it, don't re-port it). These are the functions that turn a list of recent `workout_logs` rows into "the athlete's real current pace/split," and are what make a generated plan's zones reflect the athlete's actual fitness rather than a generic tier guess. Parity-tested against representative effort lists (including the empty-history fallback-to-tier case).

## Component 5 — `envelope.ts`

Port `computeEnvelope` and `resolveZones` — the actual orchestration function mobile's `build-envelope.ts` calls once it has assembled an input. Composes Components 1-4 plus the already-ported zone math (`training-zones.ts`) and the extended prescription builders (Component 6). This is the direct webapp counterpart of `OSPREY-app/src/services/coaching/envelope.ts`, parity-tested the same way — construct representative `EnvelopeInput`s per sport (including triathlon's composite case) and assert the webapp and mobile originals produce identical `CoachingEnvelope` output.

## Component 6 — Extend the existing prescription-adjacent files

Rather than creating three more parallel files, add the higher-level builder each file's existing constants are already partial ingredients of:
- `strength-loads.ts` gains a `buildStrengthPrescription`-equivalent (reusing its own already-ported `intensityZoneForPercent1RM`/`STRENGTH_PHASE_PERCENT`).
- `hyrox-loads.ts` gains a `buildHyroxPrescription`-equivalent.
- `crossfit-zones.ts` gains a `buildCrossfitPrescription`-equivalent (reusing its own `ENERGY_SYSTEM_ZONES`/`CROSSFIT_BENCHMARKS`/`CROSSFIT_PHASE_PERCENT`).

Each addition is parity-tested the same way as the file's existing exports.

## Component 7 — `build-envelope.ts` (the DB-reading orchestrator)

The direct counterpart of mobile's `build-envelope.ts`: assembles a real `EnvelopeInput` from the athlete's actual data, then calls Component 5's `computeEnvelope`.

**Reads:**
- `user_goals` — reuse the existing `useUserGoal` query (`webapp/src/features/settings/queries.ts`), extended to also select `fitness_level` (the one column mobile needs that it currently omits). This is an additive column on an already-shared, already-cross-feature hook — every existing consumer (calendar, dashboard, `StrengthZones.tsx`) is unaffected by gaining an unused extra field.
- `body_metrics` — new query, latest `weight_kg` by `recorded_on`, mirroring mobile's exact shape. No webapp precedent exists for this table; this is a fresh read.
- `workout_logs` (recent runs) — new query dedicated to this purpose (do not reuse or modify `useBestRun`, which serves a different, legitimately different selection need for the calendar). Mirrors mobile's exact filter (`session_type='run'`, `deleted_at is null`, recent window, ordered/limited), feeding Component 4's `selectBestRunEffort`.
- `workout_logs` (recent rowing) — new query, same pattern, feeding `selectBestRowingSplit`. No webapp precedent exists for a rowing-filtered `workout_logs` read.
- `workout_logs` (max heart rate) — new aggregate query. The column is already present in `WorkoutLogSchema` and read incidentally elsewhere, but no dedicated max-of query exists; this adds one.
- `threshold_anchor` — already available via `useUserGoal`'s existing selection; flatten it with a small port of mobile's `toSelfReportAnchor` (a ~6-line mapper, not previously ported since nothing on the webapp needed the flattened shape until now).
- `goal_params` — already available via `useUserGoal`; parsed via the *existing* `goal-params.ts` functions (per the Global Constraints, not modified), with this new orchestrator adapting their documented divergence from mobile's null-contract at its own call site.

**Resilience:** each read is independently try/caught or checked for a Supabase `error`, logging a warning and falling back to the same defaults mobile's own `build-envelope.ts` falls back to (`fitnessLevel: 'beginner'`, `bodyWeightKg: 70`, empty effort lists, `maxHR: null`) rather than throwing — matching mobile's existing behavior exactly, not inventing a new fallback policy.

**Output:** the same shape mobile's `invokeGeneratePlan` builds — assembled `EnvelopeInput`, passed through Component 5's `computeEnvelope` (via the same `envelopeFromInputs`-style phase/week wrapping `race-phase.ts` already provides), ready to attach to a `supabase.functions.invoke('ozzie-generate-plan', ...)` body under the `envelope` key.

## Component 8 — Wire into the two existing call sites

- `webapp/src/features/home/queries.ts`'s `usePlanSync`: build the envelope before invoking, include it in the POST body (still `force`-less, still the same idempotent background-sync semantics it has today — this component changes what's IN the body, not when or how often it fires).
- `webapp/src/features/calendar/queries.ts`'s `useBuildPlanForRace`: same — the envelope joins the existing `{ raceTarget, force: true }` body, unchanged otherwise.

Neither call site's query key, invalidation list, staleTime/retry config, or trigger condition changes — this is purely "give the existing call a real envelope," not a rework of when/how these fire.

## Verification

1. Every new/extended pure function has a parity test (matching the established `webapp/tests/*-parity.test.ts` convention) passing against the real mobile original, not a hand-copied expectation.
2. Full existing webapp Vitest suite stays green — nothing in `goal-params.ts`, `useBestRun`, or any other untouched file regresses.
3. Live verification on the real account: trigger `useBuildPlanForRace` (or wait for `usePlanSync`'s daily fire) and confirm the resulting sessions are now internally consistent (duration/distance/pace agree with the athlete's real zone) — the direct fix for the originating audit finding. Confirm via a read-only SQL check that a webapp-triggered generation now also carries a `fuel` field on non-rest sessions and respects the polarization cap, matching what mobile-originated generations already produce.
4. Confirm neither call site's behavior changed in any way *other than* the envelope now being present — same trigger conditions, same query keys, same invalidation lists.

## Explicitly out of scope (deferred)

- Ultra support on the webapp (a whole unbuilt sport, not a gap in this port — see above).
- Real CTL-derived `baselineLoad`/`prevWeekLoad` — mobile itself still hardcodes `200`/`null` with a "Phase 2 will thread real CTL" comment; this port matches mobile's *current* behavior exactly rather than leapfrogging ahead of it, even though the webapp happens to already have real CTL infrastructure (`useFitnessLoadSeries`) that could feed this later.
- Reconciling `goal-params.ts`'s null-contract divergence from mobile's `to*Params`, or changing `useBestRun`'s selection algorithm — both explicitly left alone per Global Constraints.
- A webapp-side "preferences" plan-builder flow analogous to mobile's (i.e., `resolveGoalInputs`'s posted-vs-DB-goal precedence logic) — neither existing webapp call site ever posts a `preferences` body field today, so this precedence logic has nothing to resolve yet; the DB-read `primary_goal` path is sufficient for both current call sites.
