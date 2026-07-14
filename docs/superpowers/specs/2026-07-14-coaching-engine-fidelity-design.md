# Coaching-Engine Fidelity — Design Spec

> Created 2026-07-14. Makes OSPREY's "Expert Coach" actually coach: the sport-science calculators
> become **guardrails** that shape and validate every generated plan, instead of dead code.
> Read `docs/coaching/_index.md` (authoritative) alongside this.

## 1. Problem

Plan generation (`supabase/functions/ozzie-generate-plan/index.ts`) is a **single `gpt-4o-mini` call** over
goal metadata + TSB that returns one flat week of **LLM-invented numbers** — no training zones, no
periodization, no taper, no fuel. Meanwhile `OSPREY-app/src/services/calculators/*` is a **complete, correct,
tested** sport-science library (zones, fuel, taper, progression, attempt selection for all 9 sports) that is
**orphaned**: 12 of 13 modules have zero consumers; only `hyroxStationWeights` is wired, and only to a workout
screen. `computeRacePhase` (`src/services/plan.ts:45`) and `weeksOut` are captured but only drive a UI bar —
they never shape a session. This is the product thesis's biggest gap, flagged in five audits.

## 2. Goal & success criteria

**Goal:** every generated plan is coach-sane by construction — real macrocycle, taper, progression, zones, and
periodized fuel — with the LLM authoring session *variety and voice* inside deterministic bounds.

**Decisions locked in brainstorming:**
- **Hybrid guardrails** — the LLM proposes sessions; the calculators **validate and clamp** the numbers.
- **Scope: all 9 sports** (sequenced in §11).
- **Architecture ①** — client computes a *coaching envelope* from the existing calculators and passes it to the
  edge function, which prompts the LLM with it as hard constraints and clamps the output before the DB write.
- **Anchor acquisition** — optional per-sport input at onboarding, with a data-derived + experience-tier fallback.
- **Multi-week** — keep the per-week generation/reschedule flow, made **phase-aware** (pass phase + target load).

**Done when:**
- A generated week's session paces/powers/splits fall inside the athlete's prescribed zones (verified numerically).
- Weekly load follows Base/Build/Peak/Taper with 3:1 loading, ≤10%/week progression, and real taper cuts.
- Each session carries calculator-derived fuel targets (daily carbs by day-type, in-session carbs/sodium for long efforts).
- Hard-session share ≤ ~20% (polarized).
- All new pure logic is TDD'd; generation still passes typecheck + the existing suite.

**Non-goals:** redesigning onboarding wholesale; changing the workout-logging or recap screens; per-sport UI for
zones (display can come later); replacing the LLM (it still authors sessions).

## 3. Architecture (①)

```
 app (client)                         edge fn: ozzie-generate-plan (Deno)          Postgres
 ─────────────                        ────────────────────────────────            ────────
 resolveAnchor(sport, user)  ─┐
 computeEnvelope(anchor,      │  POST { goals, envelope }
   phase, baseline, sport) ───┼──────────────────────────►  promptLLM(goals, envelope)  ──► gpt-4o-mini
                              │                                        │ days[] (proposed)
                              │                              validateAndClamp(days, envelope)
                              │                                        │ days[] (coach-sane)
                              │                              write training_week(phase, tss_target)
                              │                              write training_sessions(+fuel)  ───► DB
                              └──────────────────────────◄  { created, weekId }
```

- **Client** owns the sport-science math (reuses the tested `calculators/*`) → produces a `CoachingEnvelope`.
- **Edge fn** owns the LLM call, the clamp, and the DB write (keeps the idempotency/reschedule logic added in
  `d5e52ab`/`79e676f` intact). The clamp is pure numeric comparison against the passed envelope — no calculator
  math is ported to Deno.

**Why not port calculators to Deno (②) or share a package (③):** ② duplicates 13 tested modules (drift risk);
③ needs Metro-`@/`-alias + RN-dep plumbing to import into Deno for pure-math files. ① reuses the asset as-is.

**Trust note:** the envelope is client-computed. It only ever describes *the caller's own* plan (no cross-user
data), and the edge fn independently clamps the LLM output to it, so a tampered envelope can only produce a
weird *self* plan — acceptable. If we ever want server-authoritative bounds, ② becomes the upgrade path.

## 4. The Coaching Envelope

A single well-typed object the client computes and passes. Pure data — no methods.

```ts
// OSPREY-app/src/services/coaching/envelope.ts (new)
export interface CoachingEnvelope {
  sport: PrimaryGoal;                 // 'run' | 'cycling' | 'swim' | ... (existing enum)
  phase: 'Base' | 'Build' | 'Peak' | 'Taper';
  weekNumber: number;                 // 1-indexed within the macrocycle
  totalWeeks: number;
  loadingWeek: 1 | 2 | 3 | 4;         // position in the 3:1 cycle (4 = recovery)
  targetWeeklyLoad: number;           // TSS-equivalent target for THIS week (see §6)
  longSessionShareMax: number;        // e.g. 0.35 of weekly volume
  hardSessionShareMax: number;        // polarization cap, ~0.20
  zones: ZoneSet | null;              // per-sport; null when anchor unavailable (see §5)
  fuel: FuelTargets;                  // §7
  sessionCountByType: Record<string, number>;  // from onboarding day-split
}

export type ZoneSet =
  | { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones }
  | { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones }
  | { kind: 'swim'; cssPer100: number; bands: SwimPaceZones }
  | { kind: 'rowing'; splitPer500: number; bands: RowingZones }
  | { kind: 'hyrox'; thresholdSecPerKm: number; bands: HyroxRunZones }
  | { kind: 'ultra'; maxHR: number; bands: UltraHRZones }
  | { kind: 'strength'; oneRepMaxes: Record<string, number> }   // PL / crossfit
  | { kind: 'triathlon'; swim: ZoneSet; bike: ZoneSet; run: ZoneSet };
```

`bands` come straight from the existing calculators (`runningPaceZones`, `cyclingPowerZones`, `swimPaceZones`,
`rowingTrainingZones`, `hyroxRunZones`, `ultraHRZones`). `computeEnvelope` is a thin per-sport dispatcher; the
sport-agnostic parts (phase, loading week, targetWeeklyLoad, fuel day-typing, polarization caps) are shared.

**Sport-key reconciliation (implementation detail):** the app's `primaryGoal` enum is not 1:1 with the 9
blueprint sports — it includes composite values (`hybrid`, `triathlon`) and uses `lift`/`cross` where the
blueprints say powerlifting/crossfit. `computeEnvelope` needs a small `primaryGoal → blueprintSport` map;
`hybrid` resolves to a run+strength combination, `triathlon` fans out to the three-discipline `ZoneSet`.

## 5. Threshold-anchor acquisition

Zones need an anchor. Resolution order (`resolveAnchor(sport, userId): Anchor | null`):

1. **Data-derived (preferred, zero friction).** From logged efforts already available: running uses the best
   recent effort → Riegel/VDOT → threshold pace (extend `performance.ts` `bestRun*`); cycling from logged power
   if present; swim from logged TT; rowing from 2k efforts; strength from logged top sets. Refreshes as the
   athlete logs (satisfies the docs' "re-test every 4–8 weeks" — it re-derives continuously).
2. **Explicit input (optional onboarding "Baseline" step).** A new optional per-sport screen collects the
   sport-appropriate result (recent 5K/10K time, 20-min power/FTP, 400+200 swim TT, 2k row, the 3 lifts, etc.).
   Skippable. Stored as the anchor with `source: 'self_report'`.
3. **Experience-tier estimate (cold-start fallback).** Map `fitness_level` (beginner/intermediate/advanced) +
   `primaryGoal` to a coarse anchor so a brand-new user still gets zones (flagged low-confidence).

If all three yield nothing (shouldn't happen given #3), `zones: null` → the envelope still carries
periodization + fuel, and the LLM prescribes efforts by RPE label only (today's behavior) for that plan.

**Storage:** add `threshold_anchor JSONB` to `user_goals` (one active goal per user — consistent with the
one-active-plan invariant). Shape: `{ sport, anchorType, value, source, measuredAt }`. Applied via a migration
(see §9 — **apply with MCP `apply_migration`, not `db push`**, per the migration-drift note in DEPLOY-CHECKLIST).

## 6. Periodization, progression & taper (sport-agnostic)

- **Phase** from a corrected `computeRacePhase`: keep fixed-% Base/Build/Peak but guarantee the blueprint's
  **3 taper weeks** (fixes the `audit-reports/2026-07-10-audit.md:44` nit where 16-week plans got ~2).
- **Baseline load** = the athlete's recent CTL (already computed in `performance.ts` / the edge fn's EWMA over
  `workout_logs.tss`, `index.ts:56`). New users with no history start from a conservative onboarding-derived baseline.
- **targetWeeklyLoad** = `baseline × phaseFactor(phase) × loadingFactor(loadingWeek)`, then clamped by
  `maxWeeklyProgression` (`shared.ts:29`, ≤10%/wk vs the prior week). `loadingFactor` implements 3:1 (weeks
  1–3 build, week 4 = recovery cut). Taper phase overrides with the `ultraTaperWeeklyVolumes` pattern
  (`ultra.ts:31`, 25/25/30% cuts) generalized to all sports via `applyVolumeCut` (`shared.ts:33`).
- **Persist** phase + target on the existing `training_weeks` columns (`focus TEXT`, `tss_target NUMERIC`,
  `week_number`) — currently hardcoded (`index.ts:576`). No new columns needed for the week.

## 7. Fuel targets

From the existing fuel calculators, attached to the plan (not LLM-invented):
- **Daily carbs** by day-type via `dailyCarbGrams(dayType, kg)` (`shared.ts:17`) / per-sport `*DailyCarbGrams`.
- **Protein** 1.6–2.2 g/kg (`_index.md:20`).
- **In-session carbs/sodium** for long efforts via per-sport `*CarbGPerHour` + `sodiumMgPerHourFromSweatRate`.
- Needs **bodyweight (kg)** — available from `body_metrics`; fall back to an onboarding value.

`FuelTargets` rides in the envelope and is written onto sessions (extend `training_sessions` payload) so the
Log/Nutrition surfaces can show "today's plan wants ~Xg carbs, Yg/hr on the long run."

## 8. Validation & clamp (edge fn, pure)

New pure module `supabase/functions/ozzie-generate-plan/validate.ts`, called after the LLM returns:

- **Zone clamp:** each session's implied pace/power/split (from `planned_distance_km` + `planned_minutes` or the
  interval prescription) must sit inside the band for its `intensity` label; clamp to the nearest band edge.
- **Volume clamp:** scale the week's sessions so total ≈ `targetWeeklyLoad` (± tolerance).
- **Polarization:** if hard-labeled sessions exceed `hardSessionShareMax`, demote the excess to easy.
- **Taper:** in Taper phase, enforce the volume cut while preserving ≥1 short sharp session.
- **Fuel:** overwrite session fuel fields from the envelope (never trust LLM fuel numbers).

Returns corrected `days[]` + a `clampReport` (what changed) for logging/telemetry. All pure → testable.

## 9. Data-model & API changes

- **Migration** (`athlete_threshold_anchor`): `ALTER TABLE user_goals ADD COLUMN threshold_anchor JSONB;`
  Apply via **MCP `apply_migration`** (migration-history drift makes `db push` unsafe — DEPLOY-CHECKLIST appendix).
- **Edge fn request**: `ozzie-generate-plan` accepts `{ ..., envelope: CoachingEnvelope }`. **Backward-compatible:**
  if `envelope` is absent (old app build), fall back to today's prompt-only path — so deploy order is unconstrained.
- **`training_sessions`**: add nullable `fuel JSONB` (or reuse an existing notes/metadata column) for per-session targets.
- No change to the idempotency/one-active-plan logic.

## 10. Testing (TDD)

The high-value logic is pure → test-first, which the calculators already model:
- **Client (Jest):** `resolveAnchor` derivations (Riegel etc.), `computeEnvelope` per sport (anchor+phase+baseline
  → envelope), phase/loading/taper math. Pin TZ already handled.
- **Edge fn (Deno):** `validate.ts` clamp functions via `deno test` — introduce a minimal `deno test` CI step
  (`supabase/functions/**/**.test.ts`). This is new infra but small and the honest way to TDD the server clamp.
- **Regression:** existing 85-test suite + typecheck stay green; `no-restricted-syntax` lint still clean.

## 11. Sequencing (how "everything, all sports" ships without one giant PR)

- **Phase 1 — Envelope scaffolding + periodization/fuel (sport-agnostic) + validation + running zones.**
  Delivers real macrocycle, 3:1, taper, and fuel for **all** sports immediately (no anchor needed for those),
  plus running zones as the first vertical proving the anchor→zone→clamp path. Biggest value, lowest risk.
- **Phase 2 — Endurance zones + anchor acquisition.** Cycling, swimming, rowing, triathlon zones; the optional
  onboarding Baseline step + data-derivation + `threshold_anchor` storage.
- **Phase 3 — Remaining sports + polish.** Powerlifting (Prilepin/attempt selection), Hyrox, CrossFit, Ultra
  zones; low-confidence-anchor UX; zone display on plan-preview.

Each phase is independently shippable and leaves the app green.

## 12. Risks & open questions

- **Anchor accuracy for new users** — experience-tier estimates are coarse; mitigated by fast re-derivation once
  they log. Acceptable for launch; flag zones as "estimated" until data-derived.
- **LLM fighting the clamp** — heavy clamping can make sessions feel odd. Mitigation: make the prompt carry the
  envelope numbers explicitly so the LLM rarely needs clamping; log `clampReport` to tune the prompt.
- **Deno test infra** — new; keep it minimal (one command).
- **Open:** should the Baseline onboarding step be its own screen or fold into the existing goal step? (Phase 2 detail.)
- **Open:** persist the full envelope for audit/telemetry, or recompute? (Lean recompute; store only phase/target on the week.)

## 13. Out of scope
Onboarding redesign; workout/recap UI; per-sport zone visualizations; replacing the LLM; historical-plan migration.
