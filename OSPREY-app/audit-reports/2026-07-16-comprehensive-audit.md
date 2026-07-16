# OSPREY Comprehensive Audit — 2026-07-16

Branch: `claude/eager-gauss-37w1s2` (off `main` @ `8f4d19a`)
Run: fully autonomous, no human present. Scope: code quality, UX, feature testing, fixes, verification, and feature proposals across `OSPREY-app/`, `webapp/`, and `supabase/`.

## Context brief

This is not a greenfield audit. The repo has 12 prior unmerged `claude/*` audit branches (mapped in `docs/audit-branch-map.md`) and one prior landed audit report (`2026-07-02-fable-audit.md`). `main` has moved 45+ commits past the last audit-branch-map snapshot, including a full "coaching engine Phase 3" rewrite (powerlifting, follow-ups). Several previously-known open bugs (paywall "/mo" mislabel, Start-Session mis-routing, UTC-vs-local "today" in daily-summary) were **already fixed** on this branch — confirmed by reading the current code before doing any new work, rather than trusting the stale docs.

Four parallel Opus-model analysis passes were run fresh against current code: mobile code quality, backend/webapp code quality (incl. security), UX audit, and end-to-end feature tracing. A fifth Opus pass independently verified every fix below against the actual diff (not just the diff's own comments) before this report was written.

## Fixes implemented (11 fixes, 13 files)

1. **Onboarding — "Get stronger" never collected 1RMs (critical).** `app/(onboarding)/goals.tsx`: `anchorKeyForGoal('lift')` returns `null`, so the routing check `anchorKeyForGoal(primaryGoal) ? baseline : health` sent every lift-primary athlete straight to `health`, skipping the squat/bench/deadlift 1RM screen entirely — even though `baseline.tsx` has a full, working lift-1RM branch that was simply unreachable. Fixed the routing condition to also route on `primaryGoal === 'lift'`.

2. **Onboarding — ultra Skip discarded entered race params.** `app/(onboarding)/baseline.tsx`: the ultra baseline screen requires a valid recent-hard-run entry to pass "Continue" despite its hint saying baseline is optional, and the only escape ("Skip — estimate for me") discarded any race distance/vert/fueling the athlete had already entered. Continue now treats the recent-effort fields as genuinely optional when left blank; a new `onSkip()` re-parses and saves the ultra race params before navigating.

3. **GPS run tracking — distance inflated across pause/resume.** `src/hooks/useRunTracking.ts`: pausing a run didn't clear the GPS anchor ref, so resuming computed the first post-resume fix's distance against the *pre-pause* position — silently adding however far the athlete walked while paused. Cleanup now nulls the anchor on pause/stop.

4. **Race-plan generation clobbered non-runners' goals (backend).** `supabase/functions/ozzie-generate-plan/index.ts`: building a plan from a race event unconditionally overwrote `primary_goal='run'`, `weekly_lift_days=1`, `fitness_level='intermediate'` for every athlete — resetting a cyclist's/lifter's/hybrid athlete's actual sport, lift-day count, and experience level. Now fetches the athlete's existing `user_goals` row and preserves sport/lift-days/fitness-level, only setting race-specific fields.

5. **First race-plan week mislabeled "Base" phase.** `src/services/coaching/build-envelope.ts`: `invokeGeneratePlan` reads `user_goals.target_date`/`total_weeks_planned` from the DB *before* the same request's edge-function call writes them for a brand-new race target — so the client-computed envelope always saw `race: null` and defaulted to an 8-week Base phase with the wrong load, ignoring the real weeks-out. Now overrides the envelope's race field from the freshly-posted `raceTarget.{raceDate,weeksOut}` when present.

6. **UTC "today" caused wrongly-rescheduled sessions (backend timezone bug).** `supabase/functions/ozzie-generate-plan/index.ts`: `mondayOfThisWeek()`/`todayStr` used the edge runtime's UTC clock instead of the athlete's `users.timezone`, so `rescheduleMissedSessions` could mark a session "missed" and silently swap it out in the evening for negative-UTC-offset athletes, before they'd had a chance to do it. Extracted timezone-aware `zonedDateString`/`mondayOfWeek`/`toDateString` helpers into a new `date.ts` module (mirroring the existing pattern in `ozzie-daily-brief`), wired in `users.timezone`, and added `date.test.ts`.

7. **`plan_type` mislabeled swim/bike/row-only plans as `'run'`.** Same file: any plan with 0 run days and 0 lift days (e.g. a swim-only plan) fell through to `'run'`. `plan_type_enum` has no swim/bike/row value, so these now correctly fall to the existing `'custom'` value instead of a wrong sport label.

8. **Internal error disclosure.** `supabase/functions/ozzie-race-briefing/index.ts` and `ozzie-race-retro/index.ts`: both returned raw exception text (including upstream OpenAI error bodies) to the client on failure, unlike every other edge function. Now return a generic message and `console.error` the real error server-side.

9. **Webapp query-cache hardening.** `webapp/src/features/nutrition/queries.ts`: `useNutritionCoaching`'s query key had no `userId`, unlike every sibling user-scoped query. (Note: `NavRail`'s sign-out already calls `queryClient.clear()`, so the practical exposure was narrower than "cross-user leak on every sign-out" — this closes the remaining in-session-switch gap and matches convention.)

10. **Food-search debounce leak.** `OSPREY-app/app/(tabs)/log.tsx`: the search debounce `setTimeout` wasn't cleared on unmount — navigating away mid-type could fire a network call and a state update on an unmounted screen. Added unmount cleanup.

11. **Accessibility — undersized touch targets.** `OSPREY-app/app/(tabs)/workout.tsx`: the plan-recalibration banner's "Recalibrate" and dismiss (✕) controls were well under the 44×44pt minimum. Added `minHeight`/`minWidth`/`hitSlop`.

## Verification

- `npm run typecheck` (mobile app): 0 errors, before and after.
- `npm run lint` (mobile app, `src/`): 0 errors, 8 pre-existing warnings (all `import/first` in test files), unchanged.
- `npm test` (mobile app): **199/199 passing**, all 24 suites, including the existing `useRunTracking` regression suite.
- `webapp`: `npm run typecheck` — 0 errors. `npm test` — **91/91 passing**, 12 suites.
- A dedicated Opus verification pass independently re-derived and confirmed all 11 fixes against the live code (not just the diff), found no regressions, and flagged two pre-existing (not newly introduced) edge cases noted below.

### Known residual gaps (not fixed this run — flagged, not touched)
- `computeTrainingLoad`'s 84-day training-load lookback in `ozzie-generate-plan/index.ts` still buckets by raw UTC days, not the athlete's local day. Lower-impact than the "missed session" bug (it's a rolling load window, not a hard boundary check) — worth a follow-up pass.
- If a race's date fails to parse (`parseRaceDate` returns null), the build-envelope race override silently no-ops and the plan still defaults to Base phase. Pre-existing, narrow edge case.
- The `date.ts`/`date.test.ts` Deno tests could not be executed in this sandbox (no `deno` binary, and `deno.land` install is blocked by the network proxy allowlist) — verified by hand-porting the identical logic to Node and confirming all assertions, but flagging that they haven't run under the actual Deno test runner.

## Categories reviewed but intentionally not touched (needs human/product judgment)

- **"Ask Ozzie" dead-end button.** The Home screen's prominent avatar CTA routes to a screen that says two-way coaching "isn't live yet" — this tracks a deliberate, recent, documented product decision (ElevenLabs voice disabled pending a commercial license; see recent commit history). Not something to silently re-enable or hide without a product call.
- **Swap-session options don't cover all sports** (`DailySummary.tsx`) — swimmers/cyclists/rowers can only swap to run/lift/cross/rest, never their own modality. Real UX gap, but the "right" fix (add per-sport swap options end-to-end through the swap mutation and plan-adaptation logic) is bigger than an unattended pass should risk without review.
- **Hyrox never appears as a plan-generated session type** — the AI prompt's session-type enum has no `hyrox` value, so hyrox athletes only get run/lift/cross weeks; hyrox logging is manual-only. Traced end-to-end and looks like it may be an intentional design choice (hyrox = running + functional strength, which the existing types already cover) rather than a bug — flagged for a product decision, not changed.
- **Client-controlled coaching envelope** (`ozzie-generate-plan/index.ts`, `body.envelope`) is trusted without server-side re-derivation — only affects the caller's own plan (not a cross-user issue), but a tampered client could inject 1RM/zone values that bypass the load guardrails those values are meant to enforce. Worth a dedicated hardening pass.
- **`food_items` table has no per-user scoping** — any authenticated (and even anonymous, via granted `SELECT`) user can see every other user's manually-added food names. Low severity, but a real design gap in a shared reference table with no owner column.
- Text-contrast (`textMuted` borderline WCAG AA at small sizes), onboarding step-count inconsistency for goals that skip baseline, and a hand-rolled header on `plan-preview.tsx` were flagged by the UX pass as lower-severity polish items — left for a dedicated design pass rather than piecemeal color/copy tweaks in an unattended run.

## Feature recommendations

Three net-new differentiators, chosen to avoid re-pitching the unmerged branch features already catalogued in `docs/audit-branch-map.md` (Watch bridge, live race tracking, Life Load, meal-prep/grocery, physique coaching, Ozzie voice) and to lean on OSPREY's real moat — one engine spanning strength, endurance, and fuel.

### 1. Interference Radar — the hybrid-athlete session sequencer
**Pitch.** Concurrent-training interference (a heavy lower-body lift blunts tomorrow's threshold run, and vice versa) is the biggest thing that goes wrong for the hybrid athlete OSPREY is built around — and no competitor coaches it (Runna ignores lifting, Hevy ignores running, TrainingPeaks makes the athlete sequence it manually). Interference Radar detects lower-body load collisions across strength and endurance sessions and reorders the week to space them, with a plain-language reason ("Ozzie moved your intervals to Thursday because you squat heavy Wednesday").
**MVP.** A rules-based post-processing pass after `ozzie-generate-plan` returns its 7 days: score each session's lower-body neuromuscular load; when a heavy-lower lift and a threshold/interval-lower run land under 24h apart, swap or space them and write the reason to `ozzie_notes`. No ML — encode the rules from `docs/coaching/`. Ship for run+powerlifting/hybrid first.
**Effort:** M (2–4 weeks) — extends the existing `backtoback.ts` alternation pass; reuses `training_sessions`, `strength-params.ts`, `periodization.ts`, `performance.ts` (TSB gate), surfaced via `usePlanAdaptation.ts`.
**Risk:** athletes with few available days can make the constraint infeasible — needs a graceful "accept the collision, here's the cost" fallback rather than an unsolvable shuffle.

### 2. Course IQ — terrain-personalized race pace + fuel map
**Pitch.** Today's race briefing (`ozzie-race-briefing`) is text-only. Course IQ turns a race into a segment-by-segment execution plan: an elevation profile (the app already renders endurance charts and computes `elevation_gain_m`) split into 4–6 segments, each with a pace/effort target derived from the athlete's own threshold zones plus timed fuel markers ("power-hike miles 18–22; gel at 6/12/18"). Fusing terrain × personal zones × a fuel clock into one plan is a real gap — valuable especially for ultra/trail, where flat pace targets are meaningless.
**MVP.** User-uploaded GPX first (provider auto-match later): elevation profile + auto-segmented pace targets off the athlete's anchor, gel/fluid markers from `fuel.ts` (60–120g/hr). Skip turn-by-turn maps.
**Effort:** L (4–6 weeks) — chart reuse is cheap; cost is GPX ingest/segmentation and the pacing engine. Integrates with `services/races.ts`, `race_events`/`race_logistics` (migration `20260701000011`), `performance.ts` predictors, `coaching/fuel.ts` + `zones.ts`.
**Risk:** course GPX availability/licensing varies by race org — user upload de-risks the MVP; treat provider integration as later upside.

### 3. Fuel Clock — intraday timed fueling + 2-day heat pre-hab
**Pitch.** OSPREY already knows today's session, the athlete's macros, and the weather, but fuel advice is a static daily band. Fuel Clock turns it into a timestamped day: pre-session carbs, intra-session g/hr for long efforts, the post-session protein window, and a proactive nudge 2 days before a hot session to start pre-hydrating with a sodium plan — a category none of Strava/Hevy/Whoop/MyFitnessPal can do because none of them know the athlete's actual training.
**MVP.** Today-only: a pre/during/post timeline from today's `training_sessions` type+duration + bodyweight (via `fuel.ts` formulas), plus a 2-days-out heat notification when `weather-coach` flags a hot upcoming session. Skip multi-day planning and grocery lists (that's the already-explored meal-prep branch — deliberately out of scope).
**Effort:** M (3–4 weeks) — composes existing services (`nutrition.ts`, `hydration.ts`, `coaching/fuel.ts`, `weather-coach.ts`/`weather-context.ts`, `schedule-context.ts`); new work is scheduling/timed-notification logic plus `ozzie-nutrition-coach` wiring.
**Risk:** notification fatigue/permissions, and intra-session g/hr tolerance is individual — pitch as a coached, athlete-tunable default rather than a fixed prescription.

**Recommended first bet:** Interference Radar — smallest effort, and the clearest "only OSPREY can do this" claim for the hybrid athlete the product is already positioned around.
