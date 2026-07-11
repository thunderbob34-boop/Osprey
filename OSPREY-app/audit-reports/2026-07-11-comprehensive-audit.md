# OSPREY Comprehensive Audit — 2026-07-11

Branch: `claude/great-pascal-rgi4i4` (off `main`)
Run: autonomous, no human present. Scope: full code quality + UX + feature-completeness audit, fixes, verification, and forward-looking feature proposals.

## Baseline (before any fixes)

`npm install` succeeded (network available this run). All three gates were already clean and stayed clean throughout:

| | Before | After |
|---|---|---|
| `npm run typecheck` | 0 errors | 0 errors |
| `npm run lint` | 0 errors | 0 errors |
| `npm test` | 72/72 passing (6 suites) | 72/72 passing (6 suites) |

Three independent read-only passes were run first (code quality, UX, feature-completeness end-to-end tracing), each briefed on the prior 2026-07-02 audit and `docs/TODO.md` to avoid re-reporting known/tracked items. Findings below are what survived that filter, then a verification pass re-reviewed every fix against the diff.

## Fixes implemented (11 fixes, 18 files, +255/-64 lines)

1. **[HIGH, code quality] `ozzie-nutrition-coach` used naive UTC dates, not the user's timezone.** `supabase/functions/ozzie-nutrition-coach/index.ts` computed "today" via `new Date().toISOString()` on Deno's UTC edge clock instead of the user's IANA timezone — `ozzie-daily-brief` was fixed for this exact bug previously, but nutrition-coach was never updated. For any user behind UTC, this rolled "today" over hours early: food logged during the actual local evening was excluded from `loggedToday`, understating logged calories/macros on the Home card, and `todaySession` resolved to tomorrow's session instead of today's. Ported the `zonedDateString`/`zonedMidnightUTC` helpers from daily-brief and now fetch `users.timezone`.

2. **[HIGH, UX] Paywall showed the annual plan's price labeled "/mo".** `app/paywall.tsx` hardcoded `${priceString}/mo` and "per month" on the subscribe button regardless of which package was selected. Since Annual is the pre-selected default offering, first paint showed something like "Start for $59.99/mo" — a $59.99/**year** plan presented as $59.99/**month**, both a user-trust problem and an App Store subscription-disclosure risk. Added `packagePeriodSuffix`/`packagePeriodWords` keyed off the package's actual billing period.

3. **[MEDIUM, feature-completeness] Finishing a tracked workout never refreshed Home/Stats/Calendar.** `run.tsx`, `lift.tsx`, `endurance.tsx`, and `hyrox.tsx` all saved the workout and navigated straight to recap with no cache invalidation — every other write path (manual quick-log, plan-preview, race results) already invalidates `daily-summary`/`stats`/`calendar-month`, but the four tracked-workout screens were the one omission. Since the app's `QueryClient` has no focus-refetch wiring and tab screens stay mounted, this meant Home/Stats kept showing pre-workout numbers until the user force-quit or pulled-to-refresh — after literally every completed run, lift, endurance, or Hyrox session. Added the same three `invalidateQueries` calls to all four finish handlers.

4. **[MEDIUM, UX] Onboarding's final screen read "Step 4 of 5" and the bar stopped at 80%.** All five onboarding screens passed `totalSteps={5}` while the last real step is `step={4}` (welcome=0 has no visible counter; name/mode/goals/health = steps 1–4). Changed `totalSteps` to `4` everywhere so the finish screen correctly shows "Step 4 of 4" at 100%.

5. **[MEDIUM, code quality] Two different ATL/CTL smoothing formulas were live at once.** `supabase/functions/ozzie-generate-plan/index.ts` computed training load with the impulse-response form (`1 - exp(-1/tau)`), while the user-facing Performance card (`src/services/performance.ts`, the tested/canonical version) uses a simple `alpha = 1/tau` EWA — a ~7% divergence in the same TSB number the plan engine makes de-load/intensity decisions on. Aligned the plan generator to the simple formula.

6. **[MEDIUM, code quality] `load_scores` was read but never written — a dead fallback.** `ozzie-daily-brief` selects from `load_scores` to drive a TSB-based rest recommendation when there's no HealthKit recovery data, but nothing in the codebase ever inserted into that table, so the fallback silently never fired for any user without a connected wearable. Added `computeAndStoreTrainingLoad()` (same formula as #5) that computes ATL/CTL/TSB from `workout_logs` and upserts into `load_scores` on a cache miss, so the fallback now has real numbers and the table stops being dead weight.

7. **[MEDIUM, UX] "Ask Ozzie" promised a conversation that isn't live.** The Home header's avatar button (`accessibilityLabel="Ask Ozzie"`) and its destination screen's own header both said "Ask Ozzie," but the screen's body text explicitly discloses two-way chat isn't built yet — the entry point over-promised what the destination honestly disclaims. Renamed both to "Ozzie's Take" — copy-only, no behavior change.

8. **[LOW, UX] The session-swap sheet offered swapping to today's own session type.** `DailySummary.tsx`'s "Adjust Today's Session" sheet always listed all four targets (Run/Lift/Cross/Rest) even when one matched the current session — a visible no-op tap. Refactored the static list into a filtered array excluding `session.sessionType`.

9. **[LOW, code quality] GPS anchor never reset between pause/resume.** `useRunTracking.ts`'s noise-filter anchor persisted across a pause→resume cycle; if the runner moved during the pause, the first fix after resuming could diff against a stale anchor and inject a spurious distance jump (feeding directly into TSS/training load). Anchor now resets to `null` whenever tracking (re)starts, so the first post-resume fix always has a zero delta.

10. **[LOW, code quality] Recap screen hardcoded hex colors instead of design tokens.** `recap.tsx`'s swim/bike/rowing badge colors (`#3B82F6`/`#4ADE80`) drifted from the app's actual `Colors.blue`/`Colors.green` tokens used everywhere else. Switched to the tokens.

11. **[LOW, code quality] `computeRacePhase` mixed UTC and local date parsing.** `src/services/plan.ts` compared a local-midnight `today` against `raceDate = new Date('YYYY-MM-DD')`, which parses as **UTC** midnight per spec — for timezones behind UTC this could inflate `weeksRemaining` by a day and flip the Base/Build/Peak/Taper boundary right at a transition. Now parses the target date into y/m/d components and constructs a local-midnight `Date` instead.

## Verification

A separate pass re-read the full diff against each fix's intended behavior (not just "does it compile"). All 11 fixes confirmed correct with no regressions; typecheck/lint/test stayed green after every change. Two non-blocking notes surfaced:
- The nutrition-coach fix now fetches `users.timezone` as a sequential query before its `Promise.all`, adding one extra round-trip of latency (correctness over micro-latency; not worth the added complexity of restructuring the parallel fetch for one field).
- `Colors.blue` (#3388dd) is a visibly different shade from the old hardcoded `#3B82F6` — intended (using the real token), but the swim/rowing badge blue will look slightly different than before.

Items that only a device/simulator can fully confirm (flagged, not blocking): DST-boundary behavior of the timezone helpers, the workout-completion cache actually visibly refreshing Home/Stats on-screen, and real GPS resume behavior. All are logically sound by code inspection and consistent with existing, already-shipped patterns elsewhere in the app.

## Findings noted but deliberately not fixed this run

Consistent with the prior audit's approach — safe/scoped fixes only, no unattended changes that need device verification or touch product judgment calls:

- **Endurance/Hyrox sessions have no pause** (`endurance.tsx`/`hyrox.tsx`), unlike `run.tsx`. A real feature gap, not a bug — adding pause/resume UI and timer logic to two screens is a scoped but non-trivial change better done as its own reviewed PR.
- **Warm-up "Start" gating is bypassed by an adjacent "Skip warm-up" link** (`run.tsx`, `lift.tsx`) — a product/UX judgment call on whether the skip link should exist at all, not a clear-cut bug.
- **`Colors.textMuted` is borderline sub-AA contrast** (≈4.3:1 vs 4.5:1 threshold) at the small sizes it's used at pervasively. Fixing the token would touch dozens of call sites' visual weight without device verification — flagged for a dedicated a11y pass.
- **27 npm audit findings**, all in devDependency/build-tooling packages (expo-dev-client, xcode, tar/cacache via transitive deps) — not runtime app code shipped to users, and every fix path requires a breaking major Expo SDK bump, consistent with the prior audit's decision to defer that as its own dedicated pass.

## Feature recommendations

Three features intended to differentiate OSPREY from single-modality competitors (Strava, TrainingPeaks, Whoop, Hevy, Runna) by leaning into what's structurally unique here: one AI coach engine spanning strength *and* endurance for the same athlete, backed by the documented per-sport blueprints in `docs/coaching/`.

### 1. Smart Sets — live in-session strength autoregulation

**What:** After each set in `lift.tsx`, prompt the athlete for a quick RPE/RIR tap (1 tap, no typing). Ozzie adjusts the *next* set's prescribed weight in real time using the %1RM + RPE/RIR autoregulation tables already specified in `docs/coaching/powerlifting.md` and `crossfit.md` — e.g., if a set comes in easier than its target RPE, bump the next set's load; if it comes in harder, hold or reduce. Today, lift logging (plate math, PR detection, rest timer) is purely a *recorder*; competitors like Hevy/Strong are recorders too. This makes it an active coach mid-session, which no mainstream lift-logging app does.

**Scope/integration:** New `computeAutoregulatedLoad(exercise, targetRpe, actualRpe, prescribedWeight)` in a new `src/services/autoregulation.ts`, sourced directly from the blueprint tables (keeps plan-generation and in-session coaching using the same source of truth per `docs/coaching/_index.md`'s design). Wire into `lift.tsx`'s existing set-completion flow (already has per-set state) — add one RPE selector UI element per set, feed its value into the existing exercise/set data model already saved via `saveLiftWorkout`.

**Effort:** Medium, ~2 weeks. Mostly UI (RPE input) + a pure calculation function with clear existing test conventions (`performance.test.ts` shows the pattern) to verify against the blueprint tables; no new backend schema needed since sets/reps/weight already round-trip through `saveLiftWorkout`.

### 2. Smart Sequencing — cross-modality interference guardrails

**What:** OSPREY's whole premise (`CLAUDE.md`: "look like a bodybuilder, function like an athlete") is that the same athlete does heavy leg day *and* a key threshold run in the same week — and today nothing checks whether the plan sequences them sensibly. Single-domain competitors (TrainingPeaks for endurance, or Hevy for lifting) structurally can't build this because they only see one half of the week. Add a lightweight interference check when a plan is generated or a session is swapped/compressed: flag (and offer to auto-resequence) a heavy lower-body day landing the day before a key run/bike session, or two hard sessions of either modality stacked back-to-back without the polarized 80/20 spacing the blueprints already call for.

**Scope/integration:** A pure function in `src/services/plan.ts` (alongside `computeRacePhase`) that scans `fetchCurrentWeekSessions` output for `sessionType`/`intensity` adjacency conflicts, surfaced the same way the existing calendar-conflict messaging works in the daily brief ("schedule" string pattern in `ozzie-daily-brief/index.ts`) — extend that prompt to also receive a `sequencingConflict` string. On the generation side, `ozzie-generate-plan` gets the same check as a post-generation validation pass before persisting the week.

**Effort:** Medium-large, ~2-3 weeks. The detection logic is cheap; the harder part is deciding auto-resequence UX (reuse the existing `swapTodaySession`/`compressTodaySession` mutations and the bottom-sheet pattern already built for `usePlanDeload`, which this closely resembles architecturally).

### 3. Red Flag Radar — soreness + load pattern matching against documented red flags

**What:** Every sport blueprint in `docs/coaching/` has a "Staying Healthy — Load & Red Flags" section (§9) with specific stop/modify criteria per sport. There's also already a `soreness_logs` table in the schema (migration `20260628000001`) that is **completely unused** — no UI writes to it, nothing reads from it. Build a simple soreness quick-log (reuse the Home quick-add pattern already used for hydration/weight) and a background check that cross-references logged soreness + the ACWR/TSB data already computed (`computeInjuryRisk` in `performance.ts`) against each sport's documented red-flag criteria, surfacing a proactive "Ozzie noticed X — here's what your blueprint says to do" — something no generic fitness tracker can do because it requires the sport-specific coaching knowledge OSPREY already has written down but isn't using operationally.

**Scope/integration:** `src/hooks/useSoreness.ts` (mirrors `useHydration.ts`'s optimistic quick-add pattern) writing to the existing `soreness_logs` table (no migration needed — table already exists, just needs RLS/grant verification). A `matchRedFlags(soreness, injuryRisk, sport)` pure function encoding each blueprint's §9 criteria as data (not hardcoded prose), surfaced via the existing daily-brief `recentMemories`/`habit_tip`-style optional-insight slot.

**Effort:** Medium, ~2 weeks. Lowest-infra-risk of the three since the table already exists and the pattern (quick-add + daily-brief insight slot) is proven twice over in the current codebase; the main work is encoding each blueprint's red-flag section as structured thresholds instead of free text.

## Summary

Baseline was already clean (0/0/72-passing) going in and stayed clean throughout. 11 real, verified issues fixed across 18 files — 2 high-severity (a timezone bug silently hiding logged food from most US users every evening, and a paywall showing the wrong billing period), several medium-severity data-integrity and UX issues, and a handful of low-severity polish items. Four items were identified and deliberately left unfixed with reasoning recorded above. Three feature proposals target OSPREY's structural advantage — one coaching engine spanning strength and endurance — in ways single-modality competitors can't easily replicate.
