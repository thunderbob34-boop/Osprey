# Coaching-Engine Phase 3 (Ultra) — Design Spec

> Created 2026-07-15. The **first Phase 3 slice** (remaining sports + polish). Makes **ultra** a first-class goal:
> a new selectable sport that reuses the finished run + HR pipeline, plus three new inputs (race distance / vert /
> gut-trained), a progressive taper, distance-scaled volume, heavier in-session fueling, ultra-specific coaching
> voice, and — the one genuinely-new piece — **structural back-to-back long runs**. App + edge fn + two additive
> migrations. Most of it *threads calculators that already exist but are dormant* (`calculators/ultra.ts`).
> Grounded in `docs/coaching/ultra.md` (the coaching source of truth).

## 1. Why this exists / what it delivers

Today an ultra runner picks **"Run better"** and is coached as a road marathoner: road pace bands, one blunt
taper (a flat ~45% final-week cut), marathon fueling, and no back-to-back long runs. `calculators/ultra.ts` already
encodes the real ultra math — `ultraTaperWeeklyVolumes` (25/25/30 progressive taper), `ultraRaceCarbGPerHour`
(60–120 g/hr), `ultraHRZones` (5-zone %max-HR) — but the taper and fuel functions have **zero callers**.

2c-iii closed the endurance sports + fuel. This slice makes ultra a first-class goal and delivers, per
`docs/coaching/ultra.md`:
- Recognition — **Ultra** is selectable; blueprint reuses run pace zones + the universal HR zones (an ultra runner
  still has a threshold pace; §2 confirms zones are effort/HR-led).
- A real **progressive 3-week taper** (§8) and **distance-scaled volume** (§7) — 50k is not a scaled-up 100-miler.
- **Heavier in-session fueling** (§6) — 60–90 g/hr, up to 120 with a trained gut.
- **Structural back-to-back long runs** (§3) — the signature ultra session, enforced not just suggested.
- An **ultra coaching voice** in the prompt (effort-over-pace, power-hiking, drink-to-thirst, eccentric strength).

## 2. Decisions locked in brainstorming

- **A new selectable goal** (not a "distance-mode" of Run) — consistent with how every sport was added; discoverable.
- **Full scope:** the three inputs (distance/vert/gut) + progressive taper + distance volume + heavier fuel +
  structural B2B + ultra prompt.
- **Zones reuse run pace + the universal HR zones — no new zone math.** The run `easy` **pace-clamp is left
  untouched** (`validate.ts` unchanged — the byte-identical-guarded file); long-run easiness is **prompt-driven**.
- **Race date degrades gracefully:** no target date → a flat Base build with no taper (today's behavior), plus a
  strong prompt nudge to set a date. Not a hard requirement.
- **Storage:** a new `goal_params` JSONB on `user_goals`, mirroring the `threshold_anchor` optional-input pattern,
  **persisted** so the Monday background-regeneration doesn't drop it.

## 3. Goal plumbing (mirror cycling 2c-i-a)

- **Migrations (two, additive, committed-but-undeployed):**
  - `20260715000002_ultra_primary_goal.sql`: `ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'ultra';`
    (exact form of `20260715000001_cycling_primary_goal.sql`). **No `session_type_enum` change** — ultra sessions
    are `run`.
  - `20260715000003_goal_params.sql`: `ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS goal_params JSONB;`
    (nullable, default null — backward-compatible).
- **TS goal types** (each exhaustiveness-checked, so they won't compile without the addition):
  `PrimaryGoal` (`types/onboarding.ts:3-12`) += `'ultra'`; `TrainingGoal` (`types/preferences.ts:1-11`) += `'ultra'`;
  `ONBOARDING_GOAL_TO_PREFERENCES` (`services/onboarding.ts:9-19`) += `ultra: 'ultra'`.
- **Edge fn routing:** `PRIMARY_GOAL_MAP` (`index.ts:469-480`) += `ultra: 'ultra'`; `ENDURANCE_PRIMARY`
  (`goals.ts:18-25`) += `ultra: 'run'` (routes ultra's days to `weeklyRunDays`).
- **Pickers:** onboarding `GOALS` (`app/(onboarding)/goals.tsx:10-19`) += a `⛰️ Ultra` chip; plan-builder
  `GOAL_OPTIONS` (`app/preferences.tsx:37-48`) += `{ value: 'ultra', label: '⛰️ Ultra' }`. `primaryDayLabel`
  (`constants/sports.ts`) falls through to "Run days per week" — correct, no edit.
- **`blueprintSport('ultra') = 'run'`** (`coaching/zones.ts:22-28`, add `ultra` to the run branch). This single edit
  cascades for free: `anchorKeyForGoal` (`baseline.ts:74-80`) → `'run'` (onboarding auto-collects a run anchor for
  ultra) and `computeEnvelope`'s `bp === 'run'` branch (`envelope.ts:72-81`) → `runningPaceZones`.
- **No `validate.ts` change** — ultra emits `kind:'run'` zones, already clamped by the run path.

## 4. New inputs + storage + threading

`goal_params` JSONB on `user_goals` holds ultra config:
```ts
type UltraGoalParams = {
  raceDistance: '50k' | '50mi' | '100k' | '100mi';
  vertGainM: number | null;   // total race vert; null = flat/unknown
  gutTrained: boolean;         // practiced high-carb feeding?
};
```
- **Collected:** the onboarding Baseline step (ultra branch, alongside the run anchor) and the plan-builder ultra
  fields.
- **Persisted to `user_goals.goal_params`** at both write sites — the onboarding insert (`services/onboarding.ts`,
  next to `threshold_anchor`) AND the edge-fn plan-builder upsert (`index.ts:529-542`), so the weekly
  background-regeneration path (`index.ts:568-591`) keeps it (plan-builder-only preferences are otherwise dropped).
- **Threaded:** `build-envelope.ts` reads `goal_params` (add to the `user_goals` select at `build-envelope.ts:62`),
  a `toUltraParams()` flattener feeds new `EnvelopeInput` fields (`raceDistance`, `vertGainM`, `gutTrained` on
  `envelope.ts:30-44`) → `computeEnvelope`.
- **Race date (degrade gracefully):** if `user_goals.target_date` is null, phase stays `Base` and the taper is off
  (today's behavior); the ultra prompt block nudges the user to set a race date to unlock the taper.

## 5. Zones — reuse run + HR (no new math)

`blueprintSport('ultra')='run'` → `runningPaceZones` from the resolved run threshold anchor; the universal
`hrZones` (which *is* the `ultraHRZones` %max-HR model, `envelope.ts:101`) carries the effort/terrain emphasis
(`ultra.md` §2). No new zone type, no `ZoneSet` variant. The run `easy` pace-clamp (`running.ts`, threshold+60–120
s/mi) is **left as-is** (`validate.ts` untouched); the prompt (§9) keeps long runs easy/effort-based.

## 6. Periodization — progressive taper + distance-scaled volume

- **Progressive taper (`ultra.md` §8):** for `sport === 'ultra'` in the taper window, use
  `ultraTaperWeeklyVolumes(baseline)` → `[0.75, 0.75, 0.70] × baseline` applied **in order to the final three
  weeks** (3 weeks out ×0.75, 2 weeks out ×0.75, **race week ×0.70** — the biggest cut closest to the race),
  **replacing the flat 0.45 cut** at `periodization.ts:21-24`. This requires threading `weeksRemaining`
  (from `computeRacePhase`, `plan.ts:56`) into `EnvelopeInput` and into `targetWeeklyLoad`, and gating the branch on
  sport. (The `0.45` early-return is the *real* flat taper; `PHASE_FACTOR.Taper=0.55` at `periodization.ts:11` is
  dead — Taper returns before reaching it.)
- **Distance-scaled volume (`ultra.md` §7):** multiply the baseline weekly load (`build-envelope.ts:95`, currently a
  hardcoded `200`) by a distance factor before `computeEnvelope` — **50k ×1.0, 50mi ×1.15, 100k ×1.3, 100mi ×1.5**
  (a tunable design parameter — `ultra.md` §7 gives *direction* not exact multipliers). One multiplier feeds both the
  macrocycle loads and the taper.
- The existing ≤10%/week progression cap + 3:1 recovery weeks (`periodization.ts`) are unchanged (`ultra.md` §9).
- **Simplification:** taper *length* is fixed at 3 weeks here; `ultra.md` §8 varies it 2–3 weeks by distance
  (100mi longest, 50k shortest) — a future refinement (§12).

## 7. Fuel — ultra in-session carbs

- `inSessionCarbGPerHour` (`fuel.ts:14-18`) gains an `ultra` branch → `ultraRaceCarbGPerHour(gutTrained)`
  (`calculators/ultra.ts:26`) — 60–90 (untrained, midpoint 75) or 60–120 (trained, midpoint 90). Thread `gutTrained`:
  widen `computeFuel(sport, bodyWeightKg, gutTrained)` (`fuel.ts:20`) and the call at `envelope.ts:112`; add
  `EnvelopeInput.gutTrained`.
- **The daily carb ladder is unchanged** — `computeFuel`'s `dailyCarbGByDayType` (2c-iii) already matches
  `ultra.md` §6 (3–5 … 10–12 g/kg by day-type). Only the in-session rate is ultra-specific.

## 8. Structural back-to-back long runs (the one new piece)

**Problem:** day placement is 100% LLM-driven (`index.ts:369-370` day `dayOffset`s, `index.ts:730-736` →
calendar); there is no enforcement hook, and the one existing day preference (`longRunDay`) is never even sent to the
model. So *asking* gpt-4o-mini (temp 0.7) for back-to-backs is unreliable.

**Solution:** a new pure function `enforceBackToBackLongRuns(days)` run in the edge fn **after** `validateAndClamp`
and before persistence (`index.ts` ~721–729), **ultra-only**:
- Identify the two longest run sessions of the week (by `planned_distance_km` / `planned_minutes`). If the week has
  fewer than two run sessions, the function is a no-op.
- If they are not already on consecutive `dayOffset`s, reorder day assignments so they are — **weekend-preferred**
  (target Sat+Sun) — by swapping `dayOffset`s with the sessions currently there, preserving the exact 7-day set and
  every session's content.
- **Invariants (test-pinned):** exactly 7 days preserved; the two longest runs occupy consecutive `dayOffset`s;
  idempotent; **non-ultra plans are byte-identical** (the function is a no-op unless the plan is ultra).

This is the only net-new engine machinery in the slice — kept a small, deterministic, heavily-tested pure function.

## 9. Prompt — ultra coaching voice

An ultra goal-conditioned block in `PLAN_SYSTEM_PROMPT` (mirror the triathlon block at `index.ts:27`), drawing on
`ultra.md` §2–§8: **effort/HR over pace on terrain**; **back-to-back long runs + time-on-feet** (progress duration,
not pace); **power-hike the climbs, practice descents**; **drink-to-thirst + 60–120 g/hr fueling + train the gut**;
**eccentric/downhill strength**; **polarized 80/20**, ≤10%/week, 3:1; and — when no race date is set — a nudge to
add one to unlock the taper. The numeric zone / HR / fuel lines already emit via the run/HR/fuel machinery
(`envelopeGuidance`, `index.ts:331-336`); this block is the qualitative coaching layer.

## 10. Compatibility & deploy

- **App + edge fn + two additive migrations** (`ADD VALUE 'ultra'` + `goal_params` column), committed-but-undeployed;
  apply via **MCP `apply_migration`** (not `db push` — history drift) **before/with** the atomic app+edge redeploy —
  the fn upserts the enum value, and storing `'ultra'` before the type has it 500s. Joins the go-live pending-deploy
  set (`DEPLOY-CHECKLIST.md` §2). Same coupling as cycling.
- **Non-ultra plans are byte-identical:** `blueprintSport` unchanged for them; the taper / fuel / B2B branches are all
  gated on `sport === 'ultra'`; `validate.ts` is untouched. `goal_params` is nullable → backward-compatible.

## 11. Testing (TDD)

- **App (Jest):** `blueprintSport('ultra')='run'` + run-zone reuse; `computeFuel('ultra', bw, gutTrained)` →
  90 (trained) / 75 (untrained); the ultra progressive taper (`ultraTaperWeeklyVolumes` wired, correct per-week
  volumes) and its `sport` gate; distance-scaled baseline (50k vs 100mi); new-input threading
  (`goal_params` → `EnvelopeInput`); **regression — other sports' envelopes byte-identical**.
- **Edge (Deno):** `enforceBackToBackLongRuns` — the two longest runs land on consecutive days for ultra, a
  non-ultra plan is untouched, 7 days preserved, idempotent; `ENDURANCE_PRIMARY` ultra→run routing
  (`goals.test.ts`); `goal_params` persisted on the plan-builder upsert path; **existing clamp/polarization tests
  byte-identical** (validate.ts untouched).
- **Regression:** full Jest + Deno suites green; `no-restricted-syntax` lint clean.

## 12. Risks & open questions

- **The B2B structural step is the only new machinery** — the main task-risk. Mitigation: a small, deterministic,
  pure function with exhaustive tests, ultra-gated so it can't regress other sports.
- **Distance volume factors** (§6) are a tunable design parameter (`ultra.md` §7 gives direction, not exact
  multipliers) — confirm/tune during review.
- **Fixed 3-week taper** vs the doc's distance-varying 2–3 weeks — acceptable simplification; refinement noted.
- **Race-date-gated taper:** a dateless ultra silently runs a flat Base — mitigated by the prompt nudge; acceptable.
- **Easy pace-clamp** may still slightly speed a very-slow long run (`validate.ts` untouched by choice) —
  prompt-mitigated; revisit if plans read too fast.

## 13. Out of scope

Distance-varying taper *length*; vert-driven session structuring beyond guidance; night/heat/altitude-specific
scheduling; a dedicated ultra race-setup screen (reuse the existing race + onboarding inputs); the other Phase 3
sports (powerlifting / hyrox / crossfit); the low-confidence-anchor + zone-display polish items; changing the LLM;
the run easy-clamp change.
