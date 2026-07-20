# Audit Feature Status

> Tracks the feature proposals surfaced by audit passes, separately from the bug-fix work those
> audits also do. Source of the current entries: `OSPREY-app/audit-reports/2026-07-16-comprehensive-audit.md`
> (PR [#6](https://github.com/thunderbob34-boop/Osprey/pull/6), merged 2026-07-16).

## How to use this doc

Each entry is a proposal, not a commitment — audits recommend, they don't decide. When a proposal
moves (someone scopes it, starts building it, ships it, or explicitly passes on it), update its
**Status** and **Notes** here rather than letting the answer live only in a PR description or a
chat transcript.

Status values: `Proposed` · `Scoped` · `In progress` · `Shipped` · `Rejected` · `Superseded`.

---

## 2026-07-16 — comprehensive audit (PR #6)

Three net-new differentiators, chosen to avoid re-pitching the unmerged branch features already
catalogued in `docs/audit-branch-map.md` (Watch bridge, live race tracking, Life Load,
meal-prep/grocery, physique coaching, Ozzie voice) and to lean on OSPREY's real moat — one engine
spanning strength, endurance, and fuel.

### 1. Interference Radar — the hybrid-athlete session sequencer

**Status:** Proposed

**Pitch.** Concurrent-training interference (a heavy lower-body lift blunts tomorrow's threshold
run, and vice versa) is the biggest thing that goes wrong for the hybrid athlete OSPREY is built
around — and no competitor coaches it (Runna ignores lifting, Hevy ignores running, TrainingPeaks
makes the athlete sequence it manually). Interference Radar detects lower-body load collisions
across strength and endurance sessions and reorders the week to space them, with a plain-language
reason ("Ozzie moved your intervals to Thursday because you squat heavy Wednesday").

**MVP.** A rules-based post-processing pass after `ozzie-generate-plan` returns its 7 days: score
each session's lower-body neuromuscular load; when a heavy-lower lift and a threshold/interval-lower
run land under 24h apart, swap or space them and write the reason to `ozzie_notes`. No ML — encode
the rules from `docs/coaching/`. Ship for run+powerlifting/hybrid first.

**Effort:** M (2–4 weeks) — extends the existing `backtoback.ts` alternation pass; reuses
`training_sessions`, `strength-params.ts`, `periodization.ts`, `performance.ts` (TSB gate),
surfaced via `usePlanAdaptation.ts`.

**Risk:** athletes with few available days can make the constraint infeasible — needs a graceful
"accept the collision, here's the cost" fallback rather than an unsolvable shuffle.

**Recommended first bet** — smallest effort, and the clearest "only OSPREY can do this" claim for
the hybrid athlete the product is already positioned around.

### 2. Course IQ — terrain-personalized race pace + fuel map

**Status:** Proposed

**Pitch.** Today's race briefing (`ozzie-race-briefing`) is text-only. Course IQ turns a race into
a segment-by-segment execution plan: an elevation profile (the app already renders endurance charts
and computes `elevation_gain_m`) split into 4–6 segments, each with a pace/effort target derived
from the athlete's own threshold zones plus timed fuel markers ("power-hike miles 18–22; gel at
6/12/18"). Fusing terrain × personal zones × a fuel clock into one plan is a real gap — valuable
especially for ultra/trail, where flat pace targets are meaningless.

**MVP.** User-uploaded GPX first (provider auto-match later): elevation profile + auto-segmented
pace targets off the athlete's anchor, gel/fluid markers from `fuel.ts` (60–120g/hr). Skip
turn-by-turn maps.

**Effort:** L (4–6 weeks) — chart reuse is cheap; cost is GPX ingest/segmentation and the pacing
engine. Integrates with `services/races.ts`, `race_events`/`race_logistics` (migration
`20260701000011`), `performance.ts` predictors, `coaching/fuel.ts` + `zones.ts`.

**Risk:** course GPX availability/licensing varies by race org — user upload de-risks the MVP;
treat provider integration as later upside.

### 3. Fuel Clock — intraday timed fueling + 2-day heat pre-hab

**Status:** Proposed

**Pitch.** OSPREY already knows today's session, the athlete's macros, and the weather, but fuel
advice is a static daily band. Fuel Clock turns it into a timestamped day: pre-session carbs,
intra-session g/hr for long efforts, the post-session protein window, and a proactive nudge 2 days
before a hot session to start pre-hydrating with a sodium plan — a category none of
Strava/Hevy/Whoop/MyFitnessPal can do because none of them know the athlete's actual training.

**MVP.** Today-only: a pre/during/post timeline from today's `training_sessions` type+duration +
bodyweight (via `fuel.ts` formulas), plus a 2-days-out heat notification when `weather-coach` flags
a hot upcoming session. Skip multi-day planning and grocery lists (that's the already-explored
meal-prep branch — deliberately out of scope).

**Effort:** M (3–4 weeks) — composes existing services (`nutrition.ts`, `hydration.ts`,
`coaching/fuel.ts`, `weather-coach.ts`/`weather-context.ts`, `schedule-context.ts`); new work is
scheduling/timed-notification logic plus `ozzie-nutrition-coach` wiring.

**Risk:** notification fatigue/permissions, and intra-session g/hr tolerance is individual — pitch
as a coached, athlete-tunable default rather than a fixed prescription.
