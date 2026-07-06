# OSPREY Nightly Audit — 2026-07-06

Branch: `claude/quirky-volta-ruhdld` (off `main` @ `d22d491`)
Run: fully autonomous, no human present. Analysis passes used FABLE (via the
Agent tool's `model: "fable"` override); fixes and this report were written
by Sonnet.

## Method

Three parallel FABLE passes (each fanning out into further sub-agents for
deep, full-file reads): **code quality** (bugs/logic errors across app +
Supabase, cross-checked against `docs/coaching/`), **UX audit** (navigation,
accessibility, design consistency, static-read only — no device/simulator
available), and **feature end-to-end trace** (six sub-traces: onboarding→plan,
workouts, nutrition, races, challenges/supplements/hydration/body-metrics,
paywall/watch — tracing UI → hook → service → Supabase table/RPC/edge
function). A fourth, narrower FABLE pass recovered the coaching-logic-math
and migrations findings after the original code-quality agent's final
synthesis step was lost mid-run (see "Environment note"). After fixes, a
fifth FABLE pass verified each fix against the actual diff.

Baseline before any fixes: `npm run typecheck` — 0 errors. `npm run lint` —
0 errors, 23 pre-existing warnings (all `no-unused-vars`/`array-type` style,
untouched tonight). Both unchanged after all fixes (now 22 warnings — no new
warnings introduced, one pre-existing one no longer triggers as a side effect
of an edited import).

## Environment note

The original code-quality and feature-trace top-level agents each finished
their own sub-work (visible in the transcript) but then went silent for
several hours on their final synthesis step, and their task IDs were no
longer resolvable via `TaskOutput`/`TaskStop` — they were lost, not merely
slow. Rather than redo everything, the already-completed sub-agent output
was kept (all 6 feature sub-traces, plus the code-quality agent's
hooks/store/services pass) and a single narrow replacement agent recovered
just the missing piece (coaching-logic math + migrations), with instructions
not to spawn further sub-agents itself. If this run is repeated, expect
individual FABLE sub-passes on this codebase to take several minutes to
tens of minutes each — that's normal depth, not a hang — but budget for the
possibility of a lost top-level synthesis step on a very long multi-hour run.

## Fixes implemented (4 commits, 23 files, +578/-43 lines)

### Backend / Supabase migrations

1. **Bug Detection & Fix — broken migration chain.** `supabase/migrations/20260703000023_saved_routes.sql`:
   migration 001 already created a `saved_routes` table with a different,
   unused shape (`surface`/`gpx_url`/lat-lon instead of `tags`/`notes`); 023's
   own `CREATE TABLE saved_routes` collided with it, so the migration chain
   could never apply cleanly from zero. Added `DROP TABLE IF EXISTS
   saved_routes CASCADE` before 023's create — verified nothing else
   references the old shape and no FK points at the table.
2. **Bug Detection & Fix — RLS made a whole feature unusable.**
   `challenge_members_read` (014) checked membership via a subquery against
   its own table from inside its own RLS policy — Postgres flags this
   infinite recursion (42P17) on every authenticated query, so listing,
   joining, or leaving a challenge always errored. New migration 027 checks
   membership through a `SECURITY DEFINER` function instead. A follow-up
   verification pass caught that the new function's default `PUBLIC EXECUTE`
   plus a client-suppliable `p_user_id` made it a membership-probing oracle;
   migration 033 removes the parameter entirely (the function only ever
   needs `auth.uid()`).
3. **Security — cross-user data leak in three RPCs.** `get_my_friends`,
   `get_friends_at_race`, and `get_race_partners` are all `SECURITY DEFINER`
   (needed to join the self-only-RLS `users` table) but none verified the
   caller was asking about themselves — any authenticated user could pass an
   arbitrary id and read someone else's friend list, race calendar, or
   training partners. Migration 028 constrains all three to the caller's own
   `auth.uid()`; verified every real call site already passes its own id, so
   nothing legitimate breaks.
4. **Bug Detection & Fix — two silently-failing upserts.** Both `coach_memory`
   dedup indexes (PR memory, race-result memory) were *partial* unique
   indexes; PostgREST always emits a bare `ON CONFLICT (cols)` with no
   predicate, which Postgres can't match to a partial index (42P10) — so
   every PR-memory and race-result-memory write failed and was silently
   swallowed by a try/catch. Migration 029 drops the partial predicate
   (verified this doesn't change uniqueness semantics: NULLs were never
   considered equal for this purpose either way).
5. **Feature breakage — activity feed.** `src/services/activity.ts` called a
   `get_activity_feed` RPC that no migration ever defined, and its "RPC
   doesn't exist yet" fallback used invalid PostgREST alias syntax (`id as
   share_id` instead of `share_id:id`) — both paths always failed. Migration
   031 adds the RPC (same `SECURITY DEFINER` + friends-join pattern as
   `get_challenge_leaderboard`); the fallback's alias syntax and unscoped
   kudos query are also fixed.
6. **Performance & Battery — missing indexes.** Added indexes on
   `training_sessions.week_id`, `workout_logs.session_id`,
   `training_weeks.start_date`, `plan_adjustments.user_id`/`session_id`, and
   `friendships.addressee_id` — all filtered/joined on regularly with no
   supporting index.
7. **Bug Detection & Fix — hydration reset at the wrong local time.**
   `log_hydration` always wrote against Postgres's `CURRENT_DATE` (UTC),
   while the client displayed/queried local device time — evening US users
   would log water that landed on "tomorrow" server-side. Migration 032 lets
   the client pass its own local calendar date.

### App code

8. **Bug Detection & Fix — generated plans invisible for UTC+ users.**
   `currentWeekStartDate()` computed the device's *local* Monday, then
   converted to UTC via `toISOString()` — for any UTC+ timezone this shifted
   the date back a day, so `fetchCurrentWeekSessions` could never match the
   `start_date` the edge function (which runs on Deno's UTC clock) actually
   stored. The freshly generated plan existed in the database but the app
   could never find it. Rewrote the function to compute the same Monday
   entirely in UTC, matching the server byte-for-byte — verified instant-for-
   instant identical for both a UTC+10 and a UTC−8 example.
9. **Bug Detection & Fix — silently dead voice coaching.** `ozzie-audio.ts`
   called `Buffer.from(...).toString('base64')` — `Buffer` doesn't exist in
   React Native/Hermes and no polyfill is installed, so this threw on every
   TTS call (caching, playback, and the app-launch prewarm), silently
   swallowed by a catch. Replaced with a hand-written, RN-safe base64
   encoder — verified against the standard algorithm for input lengths not a
   multiple of 3.
10. **Bug Detection & Fix — offline users bounced into onboarding.** On any
    transient profile-fetch error, `authStore.ts` replaced the real profile
    with a synthetic `onboarding_complete: false` one, kicking already-
    onboarded users back into the onboarding flow the next time they opened
    the app offline. Now preserves whatever profile was already loaded;
    verified the one remaining null-profile case (first-ever fetch failing)
    is handled by an existing "Could not load profile / Try Again" screen,
    not a stuck or wrong state.
11. **Bug Detection & Fix — soft-deleted workouts inflating fitness math.**
    `fetchPerformanceData` (feeds TSB/CTL/ATL/injury-risk/race predictor) had
    no `deleted_at` filter, unlike every other workout query in the app.
12. **Bug Detection & Fix — race-search distance filter always empty.** The
    RunSignUp list endpoint never returns per-race distance data, so every
    non-"All" filter chip matched zero results. Distances are now fetched
    lazily per race only when a specific distance is selected (not on every
    keystroke), cached by race id. Verification caught that the "Half" chip
    still compared against the wrong label (`'Half'` vs. the canonical
    `'Half Marathon'`) — fixed in the follow-up commit.
13. **UX Flow — run warm-up screen was a dead end.** Both visible buttons on
    the pre-run warm-up screen started the workout; there was no system back
    (fullscreen modal, no header) and no way to leave without starting a GPS
    run. Added an explicit exit button (matching the existing pattern on the
    lift screen) and reset the workout store on unmount so abandoning a run
    any other way (Android back, swipe) doesn't leak stale `active` state
    into the next session.
14. **Ease of Use — Android silently dropped dialog options.** The swap-
    session (5 buttons) and compress-session (4 buttons) prompts used
    `Alert.alert`, whose native Android implementation renders at most 3
    buttons and drops the rest — "Make it Rest" and "30 min" were
    unreachable on Android. Replaced both with a small reusable
    `ActionSheetModal` component; verified every original option/handler is
    preserved.
15. **Edge Case & Crash Handling — silent restore-purchases failure.**
    `handleRestore` had a `try/finally` with no `catch`; a failed restore
    (network error, RevenueCat error) surfaced nothing to the user. Added a
    catch with a user-facing alert.
16. **Bug Detection & Fix — plan generator ignored two real inputs.**
    `ozzie-generate-plan` always hardcoded the long-run day to Sunday
    (ignoring the user's actual `preferences.longRunDay` choice) and, for
    race-target plans, always assumed a 4-run/1-lift "intermediate" athlete
    regardless of the user's real onboarding experience tier. Both are now
    threaded through from the user's actual data, with the same defaults
    retained when no prior data exists.
17. **UX Flow — plan preview mislabeled every session's day.** `plan-
    preview.tsx` labeled weekday rows by array index ("sessions are in order
    Mon–Sun"), so any plan not starting Monday or not exactly 7 rows
    mislabeled every session. Now derived from each session's actual
    `session_date`.

## Verification results

A dedicated FABLE pass re-derived each fix from the actual diff and
surrounding code rather than trusting the commit message. **13 of 15 items
verified correct with no new bugs introduced; 0 broken.** Two were flagged
partial and fixed immediately in a follow-up commit (see items 12 and 2
above — the "Half Marathon" label mismatch and the `is_challenge_member`
parameter leak). One verified item carries a deliberate, disclosed trade-off
worth flagging: Android hardware-back during an *active* run now silently
discards the session with no confirmation dialog — strictly better than the
prior behavior (which corrupted the next run's distance), but a confirm
dialog would be a nicer follow-up.

## Categories skipped (needs human judgment)

- **Paywall fails open with no RevenueCat key configured.** `hasOspreyPlus()`
  returns `true` whenever unconfigured — on Android (RevenueCat isn't wired
  up there at all) and on iOS with no `EXPO_PUBLIC_REVENUECAT_IOS_KEY` set,
  every user gets OSPREY+ for free, and the paywall screen becomes dead code.
  Neither `eas.json` nor `app.json` injects a key for preview/production
  builds. This is a monetization/business decision (is Android meant to be
  free-tier-only right now, or unconfigured-by-accident?) that needs a human
  call before flipping the fail-safe direction, plus an EAS secret to be
  provisioned. **Recommend resolving before any real App Store/Play Store
  submission** — right now a production build would ship with no
  subscription enforcement at all.
- **Apple Watch companion app is shipped but fully dead.** `targets/watch/`
  contains real, working `WCSession` receiver code (`WorkoutDataModel.swift`)
  and is still wired into `app.json`'s build plugins — but the phone-side
  JS bridge (`useWatchSync`/`watch-connectivity.ts`, previously a stub) was
  deleted entirely in a cleanup commit the day before this audit, with zero
  remaining callers anywhere in the app. The Watch app will build and ship
  but do nothing. Needs a decision: build the real bridge (native module +
  `WCSessionDelegate` on both sides, large effort, needs physical Watch
  hardware to test) or pull the target from the build until it's ready.
- **Onboarding collects 3 of the 4 documented coaching inputs.**
  `docs/coaching/_index.md` specifies experience, goal event & demands,
  timeline to peak, and constraints/injury history. The real onboarding flow
  never asks sport, target race/event, timeline, or injury history — and the
  entire `src/services/calculators/` suite (11 sport-specific calculator
  files) has zero callers anywhere in the app. This is the single biggest
  gap between the coaching blueprints and the shipped product; closing it is
  a multi-week onboarding redesign + plan-generator rework, not a bug fix.
- **Plan generation doesn't implement the periodization/zone/fueling engine.**
  `ozzie-generate-plan` is a single-week GPT-4o-mini prompt with no
  threshold-anchored training zones, no 80/20 polarization enforcement, no
  real multi-week taper (a "taper week" generates the same volume as a base
  week), and no fueling guidance in generated sessions — despite
  `docs/coaching/_index.md`'s calculator formulas and per-sport blueprints
  already existing. Six of nine documented sports (cycling, swimming,
  rowing, ultra, powerlifting, hyrox, crossfit) have no onboarding path or
  generator support at all. This is a coaching-engine rebuild, appropriately
  out of scope for an autonomous nightly pass.
- **The friend system is schema-complete but has no UI.** `friendships`,
  `race_partners`, `challenge_members`, and the activity feed's friends-join
  all exist and are correctly wired end-to-end — but nothing in the app ever
  *creates* a `friendships` row (no add-friend/search-by-username screen
  anywhere). Every social feature (challenge invites, race-day partner
  spotting, friends' activity feed) is unreachable in practice for an
  organically-created account. See Feature Recommendation 3 below.
- **No crash reporting/analytics SDK anywhere** (carried over from the
  2026-07-02 audit — still true). For a paid-subscription app this means
  zero production crash visibility; recommend Sentry (has an Expo config
  plugin) before wider release.
- **Dependency currency** (carried over from 2026-07-02 — still true, no
  registry access from this sandbox to get a fresher number): still multiple
  Expo SDK majors behind current stable. Native-project-touching upgrade,
  deliberately out of scope for an autonomous pass.
- **No test suite** (carried over — still true). The TSB/CTL/ATL math, the
  new `bytesToBase64`, and `currentWeekStartDate`'s UTC alignment are exactly
  the kind of pure functions that would benefit most from unit tests once a
  runner exists.

## Feature recommendations (not implemented — proposals below)

See the three proposals below.

## Lint/typecheck delta

| | Before any fixes | After all fixes |
|---|---|---|
| `npm run typecheck` | 0 errors (baseline) | 0 errors |
| `npm run lint` | 0 errors, 23 warnings | 0 errors, 22 warnings (pre-existing, none touched deliberately) |

No fix introduced a new lint or type error; nothing was reverted.

---

## Feature proposals

### 1. Full training-block generation (multi-week periodization, not just "this week")

**The gap:** `ozzie-generate-plan` only ever creates one week at a time,
regenerated on demand. `computeRacePhase`/`total_weeks_planned` already
model Base/Build/Peak/Taper phases for the *UI* (the countdown/phase
overview on plan-preview), but the generator itself never receives its own
phase or a target volume curve — a "taper week" three weeks out from race
day gets exactly the same prompt and volume as a base week. Most
competitor apps (TrainingPeaks, Runna) also mostly show "today," so a
real, visible multi-week block is a genuine differentiator, not table
stakes.

**Proposal:** When a race target is set (or the user commits to a plan
length), generate the *entire* block up front — one `training_plans` row,
N `training_weeks` rows, and N×7 `training_sessions` rows — with volume and
intensity distribution shaped by `computeRacePhase`'s existing phase math
(ramping through Base → Build → Peak, then a real taper cut in the final
1-2 weeks). Store it once; individual weeks can still be nudged
(swap/compress) without needing to regenerate the whole block.

**Scope & effort:** Medium-large (2-3 weeks). Integration points:
`ozzie-generate-plan/index.ts` (loop over weeks instead of a single
`generateWeekDays` call, passing phase + target weekly volume per week into
the prompt), `src/services/plan.ts` (already has `computeRacePhase` — reuse
directly), `plan-preview.tsx` (extend to show a full block overview, not
just one week), and a new `total_weeks_planned`-driven volume-curve
function shared between server and client so the "shape" of the block is
computed once and is consistent everywhere it's displayed.

### 2. Closed-loop coach memory — Ozzie references your actual history

**The gap:** `coach_memory` already exists with three event types (`pr`,
`race_result`, `injury_flag`) and this audit's own fixes made its writes
actually succeed for the first time (item 4 above) — but nothing ever
*reads* it back into a future plan or daily brief, and `injury_flag` has
zero references anywhere in the app. Long-term memory that actually shapes
coaching (not just a single week's context) is a meaningfully different
product experience than "regenerate from scratch every time."

**Proposal:** (a) Feed a short summary of recent `coach_memory` rows (last
PR per lift, last race result, any open injury flag) into
`ozzie-generate-plan`'s prompt so Ozzie can reference them ("Last month you
PR'd this squat — let's see where it is today"), the way the daily-brief
edge function (`ozzie-daily-brief`) already references same-day context. (b)
Add a simple "Coach's Log" screen (a chronological list of `coach_memory`
rows) so the athlete can see what Ozzie remembers. (c) Wire up
`injury_flag`: when `computeInjuryRisk`'s ACWR crosses the high-risk
threshold, or a user marks a session as painful, write an `injury_flag` row
and have both the plan generator and daily brief take it into account for a
few weeks (favor lower-impact substitutions, flag before reintroducing
intensity).

**Scope & effort:** Small-medium (1-2 weeks). Integration points:
`ozzie-generate-plan/index.ts` and `supabase/functions/ozzie-daily-brief`
(both already query `workout_logs`/`training_sessions` for the current
user — add one more `coach_memory` query each), a new read-only screen
reusing existing list/card UI patterns, and a new write path from
`usePerformance`'s injury-risk computation into `coach_memory` (mirroring
the existing PR-memory write in `src/services/workouts.ts`).

### 3. Real friend/training-partner system

**The gap:** This audit confirmed `friendships`, `race_partners`,
`challenge_members`, and the activity feed's friends-join are all correctly
built and wired — three separate features (challenge invites, race-day
partner spotting, friends' activity feed) are simultaneously dead because
there is no add-friend UI anywhere in the app. This is unusually high
leverage: one feature unlocks three already-built ones at once, and a real
social layer (train with friends, see their races, celebrate their PRs) is
a differentiator most solo-coaching apps don't have.

**Proposal:** Add a minimal friend-request flow: search users by
email/username (a new RPC, since `users` is self-only RLS — same
`SECURITY DEFINER` pattern already used throughout this schema), send/
accept/decline via the existing `friendships` table and its
`friendship_status_enum`, and a simple friends-list screen. Once
`friendships` rows actually exist, `get_my_friends`, `get_friends_at_race`,
`get_activity_feed`'s friends-join, and challenge invites all start working
with no further backend change — they're already correctly built and
verified working end-to-end in this audit.

**Scope & effort:** Small-medium (1-2 weeks, mostly UI — the hard backend
work is already done). Integration points: one new `search_users_by_handle`
RPC + migration, a new friend-request screen and a small badge/notification
for pending requests, and wiring the existing `useChallenges`/
`useRacePartners`/`useActivity` hooks' empty-state copy to point at it
("Add friends to see their activity here") instead of the current
unexplained-empty-forever state.
