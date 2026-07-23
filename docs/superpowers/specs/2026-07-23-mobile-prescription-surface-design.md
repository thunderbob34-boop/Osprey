# Mobile Prescription Surface ("Your Numbers") — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan built from this spec.

**Goal:** Give the athlete a real, always-current view of everything `computeEnvelope` already computes for them — working loads, Prilepin ranges, RPE/RIR, attempt plans, Hyrox splits and station weights, CrossFit loads and Fran tier, and daily fuel targets — none of which renders anywhere on mobile today, even though the same data already drives the LLM's coaching prompt server-side.

**Architecture:** Generalize the existing `useDisplayZones` hook (currently a thin wrapper around `resolveZones` with a hardcoded `phase: 'Base'`) into `useDisplayEnvelope`, which calls the full `computeEnvelope` and returns every field additively — today's `zones`/`hrZones`/`confidence` stay byte-identical, with `strength`/`hyrox`/`crossfit`/`fuel`/`phase`/`weekNumber`/`totalWeeks`/`targetWeeklyLoad` added alongside. One hook, one shared query cache, one DB-read cost, serving both the 6 existing consumers (unchanged) and a new screen. Then build `app/your-numbers.tsx`, a new always-visible Settings-linked screen rendering the sport-specific prescription plus fuel targets.

**Tech Stack:** React Native / Expo, TanStack Query (existing `useQuery` convention), Jest (existing test convention — no cross-repo parity port needed here; this consumes mobile's own `computeEnvelope`, which already exists and is already tested).

## Why this exists (context, not itself a requirement)

The 2026-07-21 experience audit's core finding: "the engine outperforms competitors but renders almost nothing to the athlete." `computeEnvelope` (`OSPREY-app/src/services/coaching/envelope.ts`) already produces a full `CoachingEnvelope` — `strength`/`hyrox`/`crossfit`/`fuel` included — and this exact object already drives `ozzie-generate-plan`'s LLM prompt (`strengthGuidance`/`hyroxGuidance`/`crossfitGuidance` in the edge fn). But no client ever calls `computeEnvelope` itself: mobile's only consumer of this dependency graph, `useDisplayZones`, calls the narrower `resolveZones` and only ever surfaces pace/HR zones. The richer fields have no renderer anywhere. Webapp's `StrengthZones.tsx` (`webapp/src/features/settings/`) is a related but independent feature — a *maxes-editing* card computed ad hoc from stored `goal_params` — not a `computeEnvelope` consumer, and it doesn't show Prilepin/RPE/RIR/attempts/fuel either, so there's nothing to literally port for those fields; this is new UI work grounded in data that already exists and is already correct.

Investigating the current renderer surfaced a second, real bug worth fixing as part of this work rather than around it: `useDisplayZones`'s `fetchDisplayZones` hardcodes `phase: 'Base' as const` instead of computing a real phase from `target_date`/`total_weeks_planned` (the same `computeRacePhase` function — `OSPREY-app/src/services/plan.ts` — mobile and webapp both already use elsewhere). This is currently harmless because `resolveZones` doesn't need phase for pace-band math, but it would silently produce a wrong `strength.workingPercent1RM`/`crossfit.workingPercent1RM` (Base/Build/Peak/Taper give materially different %1RM targets) the moment this hook starts computing the full envelope.

## Global Constraints

- **`zones`/`hrZones`/`confidence` in the hook's return value must stay byte-identical to today's `resolveZones`-only computation** for every existing input — this is an additive change, not a behavioral one, for the 6 existing consumers (`ZonesCard.tsx`, `DailySummary.tsx`, `pace-format.ts`, `training-baseline.tsx`, `plan-preview.tsx`, `workout.tsx`, `run.tsx`).
- **The hook itself must not encode sport-specific "don't show this" presentation logic.** Today's blanket `if (sport === 'lift') return null` inside `fetchDisplayZones` is a `ZonesCard`-specific decision (lift has no pace zones) leaking into a data hook used by 6 other call sites. Each consumer that needs to hide itself for a given sport does so explicitly at its own call site — `ZonesCard` gains its own guard so lift/crossfit/hyrox athletes see exactly the same "no zones card" behavior they see today, unchanged.
- **No change to `computeEnvelope`, `buildStrengthPrescription`, `buildHyroxPrescription`, `buildCrossfitPrescription`, `computeFuel`, or any of their calculator dependencies.** This spec is entirely about rendering already-correct data; the math is out of scope.
- **No change to webapp's `StrengthZones.tsx`** — a separate, working, narrower feature (editing maxes) that this spec doesn't touch or need to reconcile with.
- **No Free/Plus gating anywhere on the new screen or its entry point** — already resolved (2026-07-21 roadmap decision #3): session-numbers data is free for every account.
- **No edge-function or migration changes.** Everything this spec needs (`computeEnvelope` and its full dependency graph, `target_date`/`total_weeks_planned` on `user_goals`) already exists and is already deployed.

## Component 1 — Generalize `useDisplayZones` → `useDisplayEnvelope`

Rename `src/hooks/useDisplayZones.ts` → `src/hooks/useDisplayEnvelope.ts` (mechanical rename touching the 6 existing import sites — each just updates its import and hook-call name; none change how they *use* the returned `zones`/`hrZones`/`confidence` fields).

`fetchDisplayZones` (renamed `fetchDisplayEnvelope`) changes:
- Its `user_goals` select gains `target_date, total_weeks_planned` alongside the existing `primary_goal, fitness_level, threshold_anchor`.
- Computes a real phase: `const raceGoal = g?.target_date && g?.total_weeks_planned ? { targetRace: null, targetDate: g.target_date, totalWeeksPlanned: g.total_weeks_planned } : null; const phaseInfo = raceGoal ? computeRacePhase(raceGoal) : null;` — feeding `phase: phaseInfo?.phase ?? 'Base'`, `weekNumber: phaseInfo?.currentWeekNumber ?? 1`, `totalWeeks: phaseInfo?.totalWeeks ?? 8` into the envelope input, mirroring the exact fallback values `build-envelope.ts` already uses for the same no-race-target case.
- Removes the early `if (sport === 'lift') return null;` — every sport now proceeds to compute a full envelope.
- Calls both `resolveZones(input)` (as today, for `confidence` — `computeEnvelope` calls `resolveZones` internally too but discards `.zonesConfidence`, so this is the only way to get it) and `computeEnvelope(input)` (for everything else). Zones get computed twice — once standalone, once inside `computeEnvelope` — which is cheap, pure, synchronous math; not worth engineering around. Returns `computeEnvelope`'s full result (`zones`, `hrZones`, `strength`, `hyrox`, `crossfit`, `fuel`, `phase`, `weekNumber`, `totalWeeks`, `targetWeeklyLoad`) plus `confidence` from the standalone `resolveZones` call.

`DisplayZones` interface (renamed `DisplayEnvelope`) grows additively — every existing field keeps its exact name and type; new fields append.

`ZonesCard.tsx` gains an explicit guard (`if (!display.zones && !isHrOnlySport) ...` — exact condition is an implementation detail; must reproduce "no card for lift/crossfit/hyrox" while still showing the HR-fallback card for weight_loss/general/cycling-without-FTP exactly as today) so its rendered behavior is unchanged for every sport, verified against today's behavior for each of: run, swim, rowing, cycling (with and without FTP), triathlon, ultra, hybrid, weight_loss, general, lift, crossfit, hyrox.

## Component 2 — `app/your-numbers.tsx`

New standalone screen, structural convention matching `app/training-baseline.tsx` (header, scroll view, card sections, `ScreenHeader` back navigation). Reads `useDisplayEnvelope()`.

Sections, in order:
1. **Training context** (always) — phase, "Week {weekNumber} of {totalWeeks}", target weekly load.
2. **Sport-specific prescription** (exactly one, based on `primaryGoal`, `null` when the envelope's corresponding field is `null` — e.g. a paramless lifter):
   - **Strength** (`strength` non-null): working loads for squat/bench/deadlift + %1RM + zone name, Prilepin rep/set + total-rep ranges, RPE/RIR ranges, daily fat target; attempt plan (opener/second/third per lift) shown only when `attempts` is non-null (Peak/Taper).
   - **Hyrox** (`hyrox` non-null): division, compromised-run split range, all 5 station weights, sodium/caffeine ranges.
   - **CrossFit** (`crossfit` non-null): strength loads (back squat/deadlift/press) + %1RM + zone name, energy-system table (reusing the same table shape webapp's `StrengthZones.tsx` renders), Fran tier + benchmark name.
   - When the relevant envelope field is `null` for the athlete's own sport (e.g. a paramless lifter with no 1RMs), show an empty-state pointing to Preferences, matching the existing "Not set — enter your X to see..." voice used throughout Settings/Training Baseline/webapp's card.
3. **Fuel** (always): daily carb range by day type (easy/moderate/high/peak), protein range, in-session carb rate (labeled per-sport, e.g. "on long runs" vs "on race day" vs "on long metcons" — exact copy is an implementation detail).

Endurance-only sports (run/swim/rowing/cycling/triathlon/ultra/hybrid/weight_loss/general) render sections 1 and 3 only — their zones are already well-served by the existing `ZonesCard`, so this screen doesn't duplicate a fuller zone breakdown.

## Component 3 — Entry point

New row in `app/(tabs)/settings.tsx`, always visible (not sport-gated, unlike Training Baseline's row — training context and fuel targets apply to every sport), `router.push('/your-numbers')`, matching the existing row style used for Training Baseline / Hyrox quiz / Preferences.

## Verification

1. Existing Jest suite (330+ tests as of the last mobile change this session) stays green — the 6 existing `useDisplayZones`/`ZonesCard` consumers are exercised by their own existing tests; any behavior drift for `zones`/`hrZones`/`confidence` or the lift/crossfit/hyrox "no card" case would be a real regression.
2. New unit tests for `fetchDisplayEnvelope`'s phase computation (real `target_date`/`total_weeks_planned` → real phase; missing either → `'Base'`/week 1/8 fallback, matching `build-envelope.ts`'s established fallback values) and for the screen's per-sport section selection logic (pure, extractable — mirrors `zone-rows.ts`'s testable-pure-function pattern).
3. Live verification on the real account (a `run` goal — confirms training context + fuel render correctly, and confirms `ZonesCard`'s existing behavior is genuinely unchanged). The real account's own sport won't exercise the strength/Hyrox/CrossFit sections — those are verified via unit tests against representative `goal_params` fixtures for each sport plus a simulator screenshot check with a temporarily-substituted `primaryGoal`/`goalParams` (not a second real account), rather than skipped.

## Explicitly out of scope (deferred)

- Any change to `computeEnvelope` or its dependency graph's math — already correct, this spec only renders it.
- Any change to webapp's `StrengthZones.tsx` — separate, working, narrower feature.
- Free/Plus gating — already resolved, applies to nothing here.
- Persisting the envelope to a database column (the roadmap's "persist the envelope *(or a shared hook)*" phrasing offers this as an alternative; the shared-hook approach in Component 1 achieves the same "single render source" goal without a schema change or staleness-invalidation design).
- Finding #4 ("personal numbers on the session card", plan-preview) and any other Phase 1/5/6/8 roadmap item — this spec's hook generalization makes those cheaper later, per the roadmap's own framing, but doesn't implement them now.
