# Coaching-Engine Phase 2 — Endurance Zones + Anchor Acquisition — Design Spec

> Created 2026-07-14. Extends the Phase 1 running vertical
> ([2026-07-14-coaching-engine-fidelity-design.md](2026-07-14-coaching-engine-fidelity-design.md)) to
> swimming, rowing, cycling, and triathlon, and adds real athlete-anchor acquisition. Read `docs/coaching/`
> (authoritative) and the Phase 1 spec alongside this.

## 1. Where Phase 1 left off

Phase 1 (+1.1) shipped, on `main`: a `CoachingEnvelope` computed in the app from the tested calculators and
enforced in `ozzie-generate-plan` — running pace zones + periodization + taper + fuel, with the LLM's proposed
sessions **clamped** into those bounds. It's **running-only**: `computeEnvelope` returns `runZones` for run/hybrid
and `null` otherwise, and `validate.ts` clamps run *pace* (derived from distance÷duration). This phase generalizes
that to the endurance sports and gives every athlete a real anchor.

**Decisions locked in brainstorming:**
- **Anchor acquisition = optional onboarding Baseline input + HR-based zones as a universal fallback** (we log
  avg/max HR for every session; no one is left without zones).
- **Scope = all four endurance sports** (swim, rowing, cycling, triathlon), sequenced internally (§11).
- **The guardrail degrades by zone type** (§3) — this is the central design idea.

## 2. The data reality that drives everything

`workout_logs` (`supabase/migrations/20260628000001_initial_schema.sql`) stores `total_distance_km`,
`total_duration_s`, `avg_heart_rate`, `max_heart_rate`, `tss` — **but no power**. Consequences:

| Sport | Zone anchor | Derivable from logs? | Clampable from a prescription? |
|---|---|---|---|
| Run | Daniels T (sec/mile) | ✅ Riegel (Phase 1) | ✅ pace = dist÷dur |
| Rowing | 2k split (sec/500m) | ✅ split = dur÷(dist/500) | ✅ pace-like |
| Swim | CSS (sec/100m) | ⚠️ only from a 400+200 TT | ✅ pace = dur÷(dist/100) |
| Cycling | FTP (watts) | ❌ no power logged | ❌ can't derive watts from dist+dur |
| Any | Max-HR % zones | ✅ observed `max_heart_rate` | ❌ HR is logged post-hoc |

## 3. The guardrail model — degrades by zone type (central idea)

"Hybrid guardrails" cannot mean the same thing for every sport. Three tiers:

- **Pace-clamped** (run, swim, rowing): the session's *implied pace* (from `planned_minutes` and
  `planned_distance_km`) is clamped into the band for its intensity — exactly Phase 1's mechanism, with a
  per-sport pace formula (run sec/mi, swim sec/100m, rowing sec/500m).
- **Prompt + volume/polarization only** (cycling): power can't be derived from a distance/duration prescription,
  so cycling zones are injected into the LLM prompt as targets and the guardrail enforces *weekly volume* and
  the *polarization cap* — not a per-session pace clamp.
- **Prompt only** (HR-fallback zones, any sport): HR is measured after the fact, so HR zones inform the prompt
  (and post-hoc analysis) but never clamp a prescription.

The clamp report (`validate.ts` `changed[]`) already logs what it touched; it simply won't touch power/HR sessions.

## 4. Anchor acquisition

`resolveAnchor(sport, athlete)` resolution order, per sport:

1. **Onboarding "Baseline" input** (optional) — the sport-appropriate result, stored as `source: 'self_report'`:
   - Cycling: FTP watts (or 20-min power → `estimateFTPFromTwentyMinPower`, `calculators/triathlon.ts`).
   - Swimming: a 400m TT time + a 200m TT time → `computeCSSPer100` (`calculators/swimming.ts`).
   - Rowing: a 2k time → split.
   - Running: unchanged (Phase 1 data-derivation is already good; input optional).
2. **Data-derived** — run (Phase 1 `selectBestRunEffort`), rowing (best recent 2k-equivalent split from logged
   rowing distance/duration). Cycling/swim have no derivable source (see §2).
3. **HR-based zones** — from the athlete's observed `max_heart_rate` (max across recent logs) via
   `percentOfMaxHR`/`ultraHRZones`. Universal fallback for any sport lacking a pace/power anchor. Flagged
   low-confidence. (No DOB in the schema, so no 220−age estimate; a conservative default max-HR is the last resort.)
4. **Experience-tier estimate** — cold-start coarse anchor (running already has this).

**Storage:** the `user_goals.threshold_anchor` JSONB column (added Phase 1, migration `20260714000002`) holds a
per-sport map:
```json
{ "run":  { "thresholdSecPerMile": 443, "source": "derived" },
  "bike": { "ftpWatts": 240, "source": "self_report" },
  "swim": { "cssSecPer100": 95, "source": "self_report" },
  "row":  { "splitSecPer500": 108, "source": "derived" } }
```
Self-reported anchors persist (they don't degrade); derived/HR anchors are recomputed as the athlete logs.

## 5. Envelope + `ZoneSet` extension

`CoachingEnvelope.runZones` generalizes to a discriminated `zones: ZoneSet | null`:

```ts
export type ZoneSet =
  | { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones }
  | { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones }
  | { kind: 'rowing'; splitSecPer500: number; bands: RowingZones }
  | { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones }   // display/prompt, not pace-clamped
  | { kind: 'hr'; maxHR: number; bands: HRZones }                     // fallback, prompt only
  | { kind: 'triathlon'; swim: ZoneSet; bike: ZoneSet; run: ZoneSet };
```

`computeEnvelope` dispatches per sport (via the §7 sport-key map) to the existing calculators —
`swimPaceZones`, `rowingTrainingZones`, `cyclingPowerZones`, `ultraHRZones` — all already tested. The envelope
also carries a `clampKind: 'pace' | 'power' | 'hr' | 'mixed'` so the edge fn knows how to treat it without
re-deriving. Backward-compat: Phase 1 callers/tests that read `runZones` get a shim (`kind:'run'` → `runZones`)
during migration, then move to `zones`.

## 6. Clamp extension (`validate.ts`, Deno)

- Refactor `bandFor` + the implied-pace step to be **pace-formula-aware**: `impliedPace(day, kind)` returns
  sec/mile (run), sec/100m (swim), or sec/500m (rowing); the band comparison/clamp is otherwise identical
  (including the direction-aware floor/ceil rounding from Phase 1.1).
- Triathlon: dispatch each session by `session_type` (`swim`/`bike`/`run`) to the matching sub-`ZoneSet` and
  apply that kind's rule.
- Cycling / HR sessions: **not** pace-clamped — pass through unchanged except fuel attach. Polarization + the
  weekly-volume behavior still apply to all sessions regardless of kind.
- All pure; extends the existing `deno test validate.test.ts` suite.

## 7. Sport-key reconciliation (fixes the Phase 1 gap)

Add a canonical `primaryGoal → blueprintSport` map. Notably `hyrox` resolves to **run-threshold** zones (its
anchor is compromised run pace per `docs/coaching/hyrox.md`), fixing the Phase 1 minor where `hyrox` silently
got `zones: null`. `hybrid` → run + strength; `triathlon` → the composite `ZoneSet`; `lift`/`cross` → no
endurance zones (Phase 3).

## 8. Triathlon

Three anchors (swim CSS + bike FTP + run threshold), each resolved by §4. The week already balances disciplines
in the Phase 1 prompt; Phase 2 adds `disciplineHourSplit` (`calculators/triathlon.ts`, swim 20% / bike 50% /
run 30%) as target day counts and clamps each session by its discipline's zone (swim→CSS pace-clamp, run→pace-clamp,
bike→power prompt). Brick sessions stay prompt-driven (already handled).

## 9. Fuel per day-type (folded in from Phase 1.1's deferral)

`computeRunningFuel` generalizes to `computeFuel(sport, bodyWeightKg)` returning `dailyCarbGByDayType`
(`{ easy: Range; hard: Range }` via `dailyCarbGrams`/per-sport `*DailyCarbGrams`), protein, and the per-sport
in-session carb rate (`cyclingInRideCarbGPerHour`, `swimMeetDayCarbGPerHour`, etc.). `validate.ts` attaches each
session the easy/hard carb range by its post-clamp intensity (instead of one weekly tier stamped on all).

## 10. Onboarding "Baseline" step

A new **optional** onboarding screen after sport/goal selection that branches by sport to collect the anchor
(FTP / 400+200 swim / 2k row; running data-derives so its input is optional). Skippable → HR/estimate fallback.
Writes `user_goals.threshold_anchor`. Follows the existing `OnboardingShell` pattern; adds one step to the
progress bar (kept consistent with the Phase-1 `totalSteps` fix).

## 11. Sequencing (internally phased — each independently shippable + green)

- **2a — ZoneSet generalization + swim & rowing (pace-based).** Refactor `runZones`→`zones`/`ZoneSet`, extend
  `computeEnvelope` + the pace-clamp to swim (CSS) and rowing (split), add rowing data-derivation + the sport-key
  map (incl. hyrox). Reuses the whole Phase 1 architecture. Highest value, lowest risk.
- **2b — Anchor acquisition: onboarding Baseline step + HR-fallback zones.** The `user_goals.threshold_anchor`
  read/write, the Baseline screen, and the HR-zone path (universal fallback). Unblocks cycling + swim precision.
- **2c — Cycling (power, prompt-guided) + triathlon (composite) + fuel-per-day-type.** The zone-type divergence
  and the 3-anchor composite, on a proven foundation.

## 12. Testing (TDD)
Pure logic throughout — Jest for the app (`ZoneSet` dispatch, per-sport anchor resolution, HR-zone math, fuel),
Deno for `validate.ts` (per-kind pace formulas, triathlon dispatch, cycling/HR pass-through). The existing
105 Jest + 7 Deno stay green; jest TZ pin + `no-restricted-syntax` lint unchanged. Migrations (if any) via MCP.

## 13. Risks & open questions
- **Cycling has the weakest guardrail** — prompt + volume only. Acceptable given no power data; revisit if/when
  power import lands.
- **HR-zone precision** — max-HR from observed logs is noisy; flag zones low-confidence and prefer a real anchor.
- **Swim/rowing prescription realism** — the LLM must emit sane distance+duration for the pace-clamp to be
  meaningful; the Phase 1 prompt-carries-the-numbers approach extends here.
- **Open:** should the Baseline step live in the main onboarding flow or a post-onboarding "improve your zones"
  prompt? (2b detail.) **Open:** persist HR-derived zones or recompute each generation? (lean recompute.)

## 14. Out of scope
Powerlifting/CrossFit/Hyrox-strength zones (Phase 3); power-meter import; a zones display/settings UI; changing
the LLM; historical-plan migration.
