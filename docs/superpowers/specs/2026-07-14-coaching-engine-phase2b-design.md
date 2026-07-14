# Coaching-Engine Phase 2b — Sport Selection + Anchor Acquisition — Design Spec

> Created 2026-07-14. Activates the swim/rowing/hyrox zone engine that Phase 2a built-but-left-dormant, by
> letting a user actually *be* a swimmer/rower/hyrox athlete, and adds real anchor acquisition (Baseline input
> + HR fallback). Read the Phase 2 spec (`2026-07-14-coaching-engine-phase2-design.md`) and the 2a plan alongside.

## 1. Why this exists

2a shipped the `ZoneSet` generalization + swim/rowing zone math + per-kind clamp — all correct and tested, but
**dormant**: the app is goal-centric, so `user_goals.primary_goal` only ever holds `run | lift | hybrid |
weight_loss | general_fitness | triathlon`. `blueprintSport` never resolves to `swim`/`rowing`/`hyrox`, so
`computeEnvelope` never dispatches to those branches for a real user. 2b makes them selectable and gives every
athlete a real anchor.

**Decisions locked in brainstorming:**
- **Extend the goal picker with sports** (not a separate dimension, not a replacement) — matches how `run`/`triathlon` already are sport-goals and how `blueprintSport(primary_goal)` already works.
- **Activate swim + rowing + hyrox** now (their zones exist: swim CSS, rowing split, hyrox = compromised run pace). **Cycling stays 2c** (power zones); build the HR fallback as universal machinery so cycling has an upgrade path.
- **Anchor = optional Baseline input + HR-fallback zones** (locked in the Phase 2 brainstorm); the Baseline step is skippable, so sport selection alone (2b-i) activates the sports via data-derivation/tier before any new input UX.

## 2. Sport selection — extend the picker + wire it through

The stored `primary_goal` must be able to hold `swim`/`rowing`/`hyrox`. Touch every place the goal flows:

- **`PrimaryGoal` type** (used by onboarding) — add `swim | rowing | hyrox`.
- **Onboarding** `app/(onboarding)/goals.tsx` — add three `GOALS` chips (Swimming / Rowing / Hyrox) with icons + descriptions. Onboarding writes `primary_goal: draft.primaryGoal` directly (`onboarding.ts:54`), so no mapping needed for the onboarding path.
- **`TrainingGoal` type + `ONBOARDING_GOAL_TO_PREFERENCES`** (`onboarding.ts:9`) — add `swim`/`rowing`/`hyrox` entries so an onboarded sport survives into the plan-builder.
- **Plan-builder** `app/preferences.tsx` — add the three options to its goal chips (its `GOAL_OPTIONS`).
- **Edge fn `PRIMARY_GOAL_MAP`** (`index.ts:447`) — add `swim → 'swim'`, `rowing → 'rowing'`, `hyrox → 'hyrox'` so the preferences path also stores the sport (today it silently `?? 'hybrid'`).
- **Edge fn `GoalsContext`** (`index.ts:40`) — add `weeklyRowDays?`, populate it in the preferences day-split (mirroring `weeklySwimDays`/`weeklyBikeDays`), and include it in the plan user-message (`index.ts:329`).
- **Edge fn `PLAN_SYSTEM_PROMPT`** (`index.ts:29,33,37`) — add `rowing` to the `session_type` enum and to the `planned_distance_km` + `interval_prescription` rules (swim is already present; hyrox emits `run`/lift sessions so needs no new session_type).

Result: `primary_goal ∈ {…, swim, rowing, hyrox}` → `blueprintSport` resolves → 2a's swim/rowing/run(hyrox) zones + clamp fire. The `includeSwim/includeBike` cross-training toggles are unchanged (secondary disciplines).

## 3. Anchor resolution model

`resolveAnchor(sport, athlete)` priority, per sport — a single ladder the envelope consults:

1. **Self-report (Baseline input)** — persisted, authoritative, never degrades.
2. **Data-derived** — run/hyrox (Riegel, 2a `selectBestRunEffort`), rowing (2a `selectBestRowingSplit`). Swim has none (§2 of the Phase 2 spec).
3. **HR-fallback zones** — from observed max HR; universal.
4. **Experience-tier estimate** — cold-start (2a already has run/swim/rowing tier estimates).

**Storage:** `user_goals.threshold_anchor` JSONB (added Phase 1, migration `20260714000002`), a per-sport map:
`{ "swim": { "cssSecPer100": 95, "source": "self_report" }, "row": { "splitSecPer500": 108, "source": "self_report" }, "run": { "thresholdSecPerMile": 443, "source": "self_report" } }`. Self-report entries take priority over derivation/estimate in `computeEnvelope`.

## 4. Baseline step (optional onboarding screen)

A new **skippable** step after sport selection (`app/(onboarding)/baseline.tsx`), branching on the chosen sport:
- **Swim** → two time fields (400m TT, 200m TT) → `computeCSSPer100` → `cssSecPer100`.
- **Rowing** → one time field (2k) → split; or skip → derive from logs.
- **Hyrox / Run** → a recent run distance + time (optional; run already derives from logs).
Writes the sport's entry to `user_goals.threshold_anchor` with `source: 'self_report'`. Skippable → fall to the
ladder (§3). Follows the existing `OnboardingShell` pattern; adds one step to the progress bar (keep the
`totalSteps` count consistent, per the Phase-1 fix). **Input validation:** reject non-positive / implausible
times; a 400 TT must exceed the 200 TT (else CSS is negative).

## 5. HR-fallback zones (universal)

A new `ZoneSet` variant: `{ kind: 'hr'; maxHR: number; bands: HRZones }` where `HRZones` are %-of-max-HR bands
(reuse `percentOfMaxHR` / the `ultraHRZones` pattern in `calculators/`). **Max-HR source:** the athlete's observed
`max_heart_rate` (max across recent `workout_logs`); a conservative default (e.g. 190) when there's no HR history,
flagged low-confidence. **Guardrail tier:** *prompt-only* — HR is measured after the session, so `validate.ts`
does NOT clamp `hr`-kind sessions (the clamp's per-kind dispatch already no-ops any kind it doesn't handle; add
`hr` to the "no clamp" set explicitly). The prompt emits HR-zone targets. Used when a sport has no pace/power
anchor (and is the interim path cycling will use in 2c).

## 6. Envelope + build-envelope wiring

- `computeEnvelope`: consult `resolveAnchor` (§3) — prefer the stored `threshold_anchor[sport].self_report` over
  the 2a data-derivation/tier fallback for swim/rowing/run. Emit the `hr` `ZoneSet` when no pace anchor resolves.
- `build-envelope.ts`: fetch `user_goals.threshold_anchor` (already fetching `user_goals`), and the athlete's
  observed max HR (extend the existing logs query or add one), and pass them into `EnvelopeInput`.
- Edge-fn `Envelope`/`validate.ts`: add the `hr` kind to the hand-copied `ZoneSet` (prompt-only; not clamped).

## 7. Data-model & API
- No new migration (the `threshold_anchor` column exists). `resolveAnchor` reads/writes it.
- Edge-fn request shape unchanged except the envelope may now carry `zones.kind === 'hr'` (backward-compatible).
- **Deploy coupling:** the edge-fn changes (PRIMARY_GOAL_MAP, GoalsContext, prompt, `hr` kind) ship with the app
  build, deployed atomically (same rule as 2a — the envelope contract + goal wiring must agree).

## 8. Testing (TDD)
- App (Jest): `resolveAnchor` priority ladder; `computeEnvelope` picking self-report over derived; the `hr`
  `ZoneSet` math; the swim CSS-from-TT + validation; the sport-selection mapping tables (`ONBOARDING_GOAL_TO_PREFERENCES`, and that each new sport round-trips onboarding → preferences → primary_goal).
- Edge fn (Deno): `validate.ts` treats `hr` kind as no-clamp (pass-through); prompt guidance for the `hr` kind.
- The onboarding Baseline screen + the picker chips are UI — verify via the app on device (screenshot the flow);
  the pure logic (CSS derivation, validation, resolveAnchor) is the TDD core.
- Existing 116 Jest + 9 Deno stay green; `no-restricted-syntax` lint clean.

## 9. Sequencing (each independently shippable + green)
- **2b-i — Sport selection + edge-fn wiring.** The §2 changes. **This alone activates swim/rowing/hyrox** on 2a's
  zones (via data-derive for run/row, tier estimate for swim). Highest value; no new anchor UI. De-risks by
  proving the goal→sport→zones→clamp path end-to-end for a real selectable sport.
- **2b-ii — Baseline input + `threshold_anchor` read/write.** The §4 screen + §3 self-report priority in
  `computeEnvelope`/`build-envelope`. Makes swim precise and lets any athlete pin a real anchor.
- **2b-iii — HR-fallback zones.** The §5 `hr` `ZoneSet` + max-HR source + prompt-only handling. Universal coverage
  + the cycling upgrade path.

## 10. Risks & open questions
- **Goal-vs-sport conflation grows** — the picker now mixes true goals (weight loss, general fitness) with sports
  (run, swim, rowing, hyrox, triathlon). Acceptable for now (matches the existing model); a future cleanup could
  split "sport" from "emphasis," but not this phase.
- **Swim self-report friction** — two TT fields is a big ask at onboarding; keep it skippable and lead with "skip
  → we'll estimate and sharpen as you log."
- **Max-HR noise** — a single spurious `max_heart_rate` sample skews HR zones; consider a percentile rather than
  the raw max (2b-iii detail). **Open:** raw max vs. 95th-percentile of recent maxima?
- **Open:** does the Baseline step live in the main onboarding flow (adds friction for everyone) or a post-onboarding
  "sharpen your zones" prompt (better completion, but zones start coarse)? Lean: in-flow but skippable.

## 11. Out of scope
Cycling power zones + triathlon composite (2c); fuel-per-day-type (2c); a zones display/settings UI; power-meter
import; changing the LLM; historical-plan migration.
