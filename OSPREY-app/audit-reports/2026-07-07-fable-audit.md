# OSPREY Nightly Audit — 2026-07-07

Branch: `claude/quirky-volta-4qskjf` (off `main` @ `d22d491`)
Run: fully autonomous, no human present. Analysis passes (code quality ×2, UX, feature-trace ×2, verification) run on Fable; fixes implemented and verified on Sonnet.

## Context brief

Since the last audit (2026-07-02), 104 files changed (+8,317/-883) — triathlon support, HealthKit import, lift analytics, hydration tracking, structured intervals, the weather-coach engine, and the `coach_memory` long-term-recall system all landed. This run focused on that new surface area plus a security-oriented pass over RLS policies and RPCs, since the last audit didn't touch SQL at all.

**Baseline:** `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 23 warnings (all pre-existing style warnings, untouched).

**A note on verification methodology:** this run had access to a local Postgres 16 instance. Rather than just eyeballing the SQL fixes, I stood up a disposable database, stubbed the minimum Supabase surface (`auth.uid()`, the `authenticated`/`service_role` roles), and ran **all 27 migration files in order from scratch**, then exercised the RLS/RPC fixes live under `SET ROLE authenticated` with a session-local `auth.uid()` — creating real fixture rows and confirming both the bug (would have reproduced) and the fix (does not) via actual query results, not inference. Details under "Verification" below.

---

## 1. Code Quality Review

Two parallel Fable passes covered `src/services/*` (core coaching/training-load logic vs. `docs/coaching/`) and the app layer (`src/store`, `src/hooks`, edge functions, SQL migrations). Combined findings, most severe first:

### Critical
| # | Location | Issue |
|---|---|---|
| 1 | `supabase/migrations/…014_challenges.sql` (RLS policies) | `challenge_members_read`/`challenges_read` subqueried `challenge_members` from inside their own policy → Postgres re-applies RLS to any table read inside a policy body → **infinite recursion (42P17) on every read of either table.** The entire challenges feature was down. |
| 2 | `src/services/activity.ts` | `get_activity_feed` RPC didn't exist anywhere; the fallback query used SQL-style `x as y` aliasing (invalid PostgREST syntax, silently becomes a request for a column literally named `xasy`) → 400 on every call. **The activity feed never loaded for anyone.** |

### High
| # | Location | Issue |
|---|---|---|
| 3 | `…001_initial_schema.sql` RLS on `activity_shares`/`kudos` | Policies commented "own + friends can read" but only ever implemented "own." Friends feed and kudo counts were structurally impossible regardless of #2. |
| 4 | `…013_friend_race_sync.sql`, `…014_challenges.sql` (RPCs) | `get_my_friends`/`get_friends_at_race` accepted a caller-supplied `p_user_id` with no check it matched the caller — any user could enumerate any other user's friends and race schedule by UUID. `get_race_partners` had no ownership check at all. |
| 5 | `…025_challenge_leaderboard_v2.sql` | `get_challenge_leaderboard` gated only its `challenge_info` CTE on membership; `members` queried `challenge_members` directly and was never actually restricted — a non-member could pull the full member list (names + UUIDs) for any challenge id. |
| 6 | `…026_coach_memory.sql` + `races.ts`/`workouts.ts` | Dedupe indexes were **partial** unique indexes; a plain `.upsert(..., {onConflict})` can't target a partial index without repeating its `WHERE` clause (which supabase-js never does) → every upsert failed with 42P10, silently swallowed. **`coach_memory` was never populated — PR/race-result recall in later briefs was fully dead.** |
| 7 | `src/services/subscriptions.ts` | `hasOspreyPlus()`/`purchaseOspreyPlus()`/`restorePurchases()` all returned `true` whenever RevenueCat wasn't configured or hadn't finished initializing — **fail-open granted free Plus** on Android, missing-key builds, or any launch-time race with `initRevenueCat`. |
| 8 | `src/services/plan.ts` | `currentWeekStartDate()` converted a local Monday-midnight `Date` via `toISOString()`, which shifts to Sunday for any user east of UTC — the query then matches no `training_weeks` row and **the entire current-week plan silently disappears.** |
| 9 | `src/services/performance.ts` | (a) the daily-load fill loop was one day short, so **today's workouts never entered ATL/CTL/TSB or ACWR** until the next day; (b) the Riegel race-predictor's "best effort" anchor picked the **longest-distance** run/swim/bike instead of the fastest-paced one, anchoring every race prediction and pace band to easy long-run pace. |
| 10 | `src/services/ozzie-audio.ts` | `Buffer` is used but never polyfilled in this RN app — `Buffer.from(...).toString('base64')` throws on every TTS call; the catch swallows it, so **Ozzie's voice silently never played**, and the failed call re-billed ElevenLabs every retry since nothing was ever cached. |
| 11 | `supabase/functions/ozzie-race-briefing`, `ozzie-race-retro` | No auth check at all (unlike every other `ozzie-*` function) — an unmetered, unauthenticated OpenAI proxy for anyone who found the URL. |

### Medium
- `src/services/logging.ts` — `saveQuickFood` wrote a meal's **total** calories/macros into `food_items`' per-100g density columns unless the logged quantity happened to be exactly 100g, corrupting the food library's density for every future lookup/re-log of that item.
- `src/services/onboarding.ts` — `user_goals` insert (table has `UNIQUE(user_id)`) wasn't an upsert; a retry after a partial onboarding failure hit a permanent `23505` duplicate-key error with no way to finish onboarding.
- `src/services/workouts.ts` — `detectSetPr` ignored query errors on two Supabase calls; a failed lookup fell through the "no history" branch and returned `true`, **falsely celebrating a PR** and permanently writing a bogus record into `coach_memory`.
- `src/services/hydration.ts`, `src/services/calendar.ts` — both used `toISOString()`/UTC-sliced timestamps for "today"/month-window math, rolling the hydration ring and calendar bucketing over at UTC midnight instead of local midnight (evening for any western-hemisphere user).
- `src/services/healthkit.ts` — HRV requested with the wrong unit (`Units.count` vs. seconds) and sleep hours summed overlapping Apple Health samples (~2× actual). **Not fixed this run** — flagged below.
- `app/(tabs)/index.tsx` — "Start Session" routed every non-lift session, including swim/bike/cross, to the GPS run screen instead of the endurance/interval screen Ozzie actually built the prescription for.
- Duplicate `saved_routes` migration (`…001` then `…023`) — `023` re-issued a bare `CREATE TABLE` on a table `001` already created with an incompatible schema; would error "relation already exists" the moment it was ever applied.

### Low (not fixed — logged for follow-up)
Race upcoming/past split using UTC vs. local `daysUntil`; `fetchWeekTargetKm` not scoped to the active plan (doubled targets after a plan regen); `fetchLastSetsForExercises` not filtering soft-deleted workouts; TSB computed off same-day rather than prior-day ATL/CTL; `formatPace` can render `"5:60"`; RevenueCat not re-logging in on user switch (shared-device entitlement bleed); `ozzie-audio.ts` API key shipped client-side (should proxy through an edge function like every other AI call).

---

## 2. UX Audit

Full read-through of every screen in `app/` plus shared components (no device available — code-level UX reasoning). Overall the app is unusually disciplined about accessibility (roles/labels/states present almost everywhere) and loading/error states. Standout findings:

- **High** — the "Start Session" mis-routing above (also a UX bug, not just a data bug): a swim/bike day showed a run map and mile-pace UI. Fixed.
- **High** — `app/reset-password.tsx` only reads `Linking.getInitialURL()`, no `addEventListener` fallback — a warm-started app (the common case) tells the user their valid reset link is "invalid or expired." **Not fixed this run** (needs device testing of the deep-link path) — logged as a follow-up.
- **High** — endurance/run workout screens have no pause and start the clock at mount, before the athlete is ready; run's warm-up screen and endurance screen are effectively navigation dead-ends (only "Start"/"Skip warm-up", no plain exit like the lift screen has). **Not fixed this run** — a UI-flow change across three screens, wants device testing.
- **Medium** — onboarding has no visible back affordance, never shows "step 5 of 5" (progress bar maxes at 80%), and lets a user pick 0 run days + 0 lift days with no warning.
- **Medium** — two disagreeing "is health connected" sources of truth (onboarding profile vs. a separate AsyncStorage key in Settings).
- **Medium** — nested touchables on the Log screen's delete button (VoiceOver tends to merge them, making delete unreachable); Stats' non-nested pattern is the better reference already in the codebase.
- Full list (27 findings) is in the verification transcript; the above are the ones worth a human's attention first.

---

## 3. Feature Testing (end-to-end trace)

Traced every item in `docs/TODO.md` §3's QA checklist through its actual code path (screen → hook → service → Supabase/edge function). No device was available, so "testing" means confirming the wiring is real and consistent, not exercising the UI.

**Fully wired, no defects:** lift logging (prescription → plate math → PR detection → recap), GPS run tracking core path (including the documented anchor-fix from the last audit), hydration quick-add (Home + Log, RPC-backed), weight-trend → nutrition-target shift, Performance Intelligence card gating, calendar blocking, offline cache, data export, units toggle, challenges (leaderboard v2 types included).

**Broken / partially wired (this run's findings):**
- **`coach_memory` writes were silently broken end-to-end** (see Critical #6) — this killed both "PR recall in a later brief" and "race retro → coach memory callback." **Fixed.**
- **Activity/social feed non-functional** (Critical #2, High #3) — **fixed** at both the query-syntax and RLS-policy layer, plus a proper `get_activity_feed` RPC added (see Verification).
- **Saved routes** — the duplicate migration meant the feature's actual columns (`tags`, `notes`) were never going to exist on the deployed table. **Fixed.**
- **Triathlon auto-regeneration** — the silent daily plan-regen call sends no body and hits `ozzie-generate-plan`'s fallback branch, which doesn't carry `weeklySwimDays`/`weeklyBikeDays`/`triathlonDistance` — a triathlete's *first* plan is correct, every auto-regenerated week after that loses swim/bike balance. **Not fixed this run** — needs a decision on where triathlon prefs should actually live (they currently exist only in auth `user_metadata`, not `user_goals`), logged as a follow-up.
- **HealthKit write-back** — `writeWorkoutToHealthKit` only self-initializes reliably from the run screen; a lift or endurance session started cold never writes back to Apple Health unless the user has separately tapped "Connect Health." **Not fixed this run** — logged as a follow-up (small fix: call the same init the run screen calls, from `lift.tsx`/`endurance.tsx`).

---

## 4. Fixes Implemented

16 files changed (+244/-65), one new migration. All fixes typecheck/lint clean; the SQL fixes were additionally run end-to-end against a real Postgres instance (see Verification).

1. **New migration `20260706000027_nightly_audit_security_fixes.sql`** — the single largest fix, bundling:
   - `is_challenge_member()` SECURITY DEFINER helper + rewritten `challenges_read`/`challenge_members_read` policies → **fixes the RLS infinite-recursion crash.**
   - `get_my_friends`/`get_friends_at_race` now ignore the caller-supplied `p_user_id` and use `auth.uid()` directly → closes the friend/race-schedule enumeration hole.
   - `get_race_partners` now checks the caller owns the race.
   - `get_challenge_leaderboard` — `members` now cross-joins `challenge_info`, so a failed membership check yields zero rows, not just zero scores.
   - `activity_shares`/`kudos` RLS split into per-command policies with accepted-friendship visibility added to `SELECT` (writes still self-only).
   - `coach_memory`'s two dedupe indexes made non-partial → **unblocks every PR/race-result memory write.**
   - New `get_activity_feed(p_user_id, p_limit)` RPC (SECURITY DEFINER) — the client's primary code path already called this by name; it never existed. Added it so the friends feed actually works end-to-end (the RLS fix alone can't surface friends' rows through the fallback query's `!inner` joins on self-only `users`/`workout_logs`).
   - `log_hydration` re-declared defensively (idempotent `CREATE OR REPLACE`) in case migration 018 had already deployed elsewhere before this fix landed there directly.
2. **`20260703000023_saved_routes.sql`** — rewritten from a colliding `CREATE TABLE` to `ALTER TABLE ADD COLUMN IF NOT EXISTS` against the table `001` already created.
3. **`20260702000018_hydration.sql`** + **`src/services/hydration.ts`** — `log_hydration` takes a `p_logged_on` param; both sides key off the device's local date instead of UTC.
4. **`src/services/subscriptions.ts`** — fail **closed** (not entitled) instead of fail-open when RevenueCat isn't configured/initialized.
5. **`src/services/ozzie-audio.ts`** — replaced `Buffer` with a dependency-free base64 encoder; cache key now hashes the full cue text instead of just its first 60 characters.
6. **`src/services/activity.ts`** — fixed the PostgREST alias syntax (`share_id:id`, not `id as share_id`); kudos fetch now filtered by `.in('share_id', shareIds)`.
7. **`src/services/plan.ts`** — `currentWeekStartDate()` formats from local date parts instead of `toISOString()`.
8. **`src/services/performance.ts`** — fill-loop window corrected by one day so today's training load counts; best-effort pace anchor now picks the fastest-paced qualifying effort per sport (≥1mi run/bike, ≥0.25mi swim — tuned after verification caught the initial blanket 1-mile floor nulling out realistic pool-swim predictions).
9. **`src/services/logging.ts`** — `saveQuickFood` normalizes calories/macros to per-100g by the logged quantity before writing a new `food_items` row.
10. **`src/services/onboarding.ts`** — `user_goals` insert → upsert on `user_id`.
11. **`src/services/workouts.ts`** — `detectSetPr` checks both query errors explicitly and returns `false` (not a false PR) on failure.
12. **`src/services/calendar.ts`** — month-window bounds and completed-workout bucketing use local calendar dates, not UTC slices.
13. **`app/(tabs)/index.tsx`** — swim/bike/cross sessions now route to `/workout/endurance` with the right `sessionType`; only `run` goes to the GPS screen.
14. **`supabase/functions/ozzie-race-briefing`, `ozzie-race-retro`** — added the same Authorization-header + `auth.getUser()` check every other `ozzie-*` function uses, plus a method check.

---

## 5. Verification

A Fable pass independently re-read every changed file in full (not just diff hunks) against the claims above and flagged two real issues before this went out the door:

1. **The initial `miles < 1` floor for "best effort" selection would have nulled out swim/triathlon race predictions** for anyone whose swims are pool-length (a 1500m swim is 0.93mi) — genuinely a new bug introduced by the performance.ts fix. **Corrected** to a per-sport minimum (swim: 0.25mi) before commit.
2. **The `log_hydration` migration edit could be fragile** if migration 018 had already been applied somewhere before this fix landed in it directly (`docs/TODO.md` states 016–026 are still pending `supabase db push`, so this shouldn't be live anywhere yet, but the fix doesn't rely on that assumption holding) — **addressed** by also re-declaring `log_hydration` defensively (idempotent `CREATE OR REPLACE`) in the new 027 migration, so the fix lands either way.
3. Flagged (not blocking, not fixed): the friends-feed RLS fix is necessary but was insufficient on its own — closed by adding the `get_activity_feed` RPC (above). `useSubscription`'s module-level cache could stick a `false` result across a launch-time race with `initRevenueCat`, meaning a paying user might need to hit `refresh()` once — safe-direction (no revenue leak) but worth a follow-up.

**Live database verification** (not just static review): stood up a disposable Postgres 16 instance, ran all 27 migrations in order from a stub Supabase environment, then exercised the fixes with real fixture rows:
- Confirmed a **member** of a test challenge can read `challenges`/`challenge_members`/`get_challenge_leaderboard` with no recursion error.
- Confirmed an **outsider** gets **zero rows** back from all three (previously: recursion crash on the first two, real data leak on the third).
- Confirmed `get_my_friends` called with another user's spoofed `p_user_id` returns nothing unless the caller actually is that user.
- Confirmed a `coach_memory` upsert now succeeds and correctly updates in place on a repeat call (previously: `42P10` on every call).

Post-fix baseline: `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 22 warnings (one fewer than baseline — an unused-var warning in `activity.ts` was incidentally resolved; no new warnings introduced). No fix introduced a new lint or type error; nothing was reverted.

---

## 6. Feature Recommendations

Three proposals chosen to build on infrastructure that already exists in this codebase (so effort estimates are grounded in real integration points) and to differentiate against the incumbents in this space — Whoop (recovery, no programming), TrainingPeaks (load metrics, no narrative coaching), Strava (social, no AI coach), and generic AI-chat fitness apps (no real training-load math underneath).

### 1. Season Intelligence — closed-loop adaptive periodization

**What:** Right now `coach_memory` (PRs, race results) and `computeInjuryRisk`/ACWR (`performance.ts`) are two islands — the daily brief can *mention* a past PR, and a same-day TSB dip can trigger a same-day "carrying heavy load" message, but nothing looks at the *trend* across weeks or *acts* on it by adjusting the plan. Season Intelligence closes that loop: a weekly job that reads the ACWR trend, recent `coach_memory` events, and time-to-next-race, and actually rebalances the next week's plan — inserting a deload week when the 7-day ACWR trend is climbing toward 1.3–1.5 (not just reacting once it's already there), or shifting emphasis toward strength in the block right after a big endurance PR, the way a real coach plans a season rather than a single week.

**Why it differentiates:** this is the natural payoff of infrastructure OSPREY already built (and this audit just made functional) that no competitor combines: real periodization math + a coach that remembers your history + software that actually acts on both together, framed in Ozzie's voice rather than a raw chart.

**Scope:** a new weekly Supabase cron/edge function (`ozzie-season-planner`) that calls `computeInjuryRisk`/`computeAtlCtlTsb` (already exist in `performance.ts`) plus a `coach_memory` read, and — when it decides a rebalance is warranted — calls the existing `swapSession`/`compressTodaySession` mutation pattern (already used for one-off swaps) across the *whole* next week instead of a single day. Surface it as a proactive Ozzie message ("This week's a deload — here's why") rather than a silent plan mutation.
**Effort:** Medium (2–3 weeks) — the hard math already exists; the work is the weekly trigger, the rebalancing rules, and a review/approval UI so it's not silently rewriting the user's week without them seeing why.
**Integration points:** `performance.ts` (existing), `coach_memory` table (now functional), `training_weeks`/`training_sessions`, the existing swap-mutation pattern in `plan.ts`, a new edge function alongside the existing `ozzie-*` set.

### 2. Training Squads — accountability groups, not just 1:1 challenges

**What:** `friendships`, `kudos`, `activity_shares`, `race_partners`, and `challenges` already exist but are thin (self-only feed until this audit's fix, one-off mileage/duration/streak competitions). Training Squads turns this into a standing group: 3–8 athletes training together (not necessarily the same sport — a squad can mix a marathoner, a powerlifter, and a hybrid athlete), with a shared weekly commitment (e.g. "4 sessions logged this week"), a squad-wide streak, and automatic race-day meetup surfacing using the `race_partners`/`get_friends_at_race` machinery that already exists but is currently only exposed one race at a time.

**Why it differentiates:** Strava has social but no coaching; OSPREY's competitors in the AI-coach space (Whoop, most GPT-wrapper apps) have no social layer at all. A standing squad — not a one-time challenge — is the retention lever: people quit alone, they don't quit in front of four training partners.

**Scope:** a `squads`/`squad_members` table (same shape as `challenges`/`challenge_members`, same RLS pattern this audit just fixed), a squad home screen reusing `HydrationCard`/activity-feed components, and a scheduled job that rolls up each member's weekly session count into a squad progress bar. Kudos/activity-shares infrastructure is reused as-is now that the RLS fix makes it actually work.
**Effort:** Medium (2–3 weeks) — mostly new UI + one new table pair; leans entirely on already-fixed friend/activity infrastructure rather than new plumbing.
**Integration points:** `friendships`, `activity_shares`/`kudos` (now friend-visible), `race_partners`/`get_friends_at_race`, the `challenges`/`challenge_members` RLS pattern as a template for the new tables.

### 3. Yellow Flag System — unified multi-signal injury early-warning

**What:** `recovery_scores`, `load_scores`, and `soreness_logs` tables already exist in the schema; ACWR is already computed; HRV/sleep already sync from HealthKit (currently with real unit/overlap bugs found in this audit, not yet fixed). None of these are pulled into one place today — a user has to piece together "my ACWR is climbing AND my HRV dropped AND I logged soreness on my left knee" themselves. Yellow Flag surfaces this as one weekly signal with a plain-English Ozzie explanation ("three separate things are pointing the same direction this week — here's what I'd change") instead of scattered numbers, and — critically — actually adjusts the plan (swap a run for a bike day, shorten a long run) rather than just displaying a warning nobody acts on.

**Why it differentiates:** Whoop shows you the recovery score and stops. TrainingPeaks shows ACWR and stops. Nobody in this space fuses subjective soreness + objective HRV/sleep + training-load trend into one coached decision with an actual plan change attached — which is exactly the kind of thing a real strength-and-conditioning coach does that generic fitness trackers don't.

**Scope:** a scoring function combining the existing ACWR calculation, HRV/sleep trend (once the unit/overlap bugs this audit found are fixed — a prerequisite, not part of this feature's own scope), and recent `soreness_logs` entries into a single 0–100 "signal," surfaced on Home alongside (not replacing) the existing Performance Intelligence card, plus a weekly Ozzie check-in conversation when the signal crosses a threshold.
**Effort:** Medium-Large (3–4 weeks, plus the HRV/sleep bug-fix prerequisite) — the individual data sources all exist; the work is the fusion scoring, the UI, and wiring the "act on it" plan adjustment through the same swap-mutation pattern Season Intelligence (above) would also use — the two features share that plumbing and are worth sequencing together.
**Integration points:** `recovery_scores`, `load_scores`, `soreness_logs`, `performance.ts`'s ACWR calc, `healthkit.ts` (needs its HRV-unit and sleep-overlap bugs fixed first), the daily-brief edge function as the natural place to fold in the weekly check-in.

---

## Categories skipped (needs human judgment, not attempted)

- **HealthKit HRV/sleep unit bugs** (`healthkit.ts`) — wrong-unit HRV query and overlapping-sample sleep double-count bias recovery scores toward "rest." Needs on-device HealthKit testing to confirm the actual unit react-native-health returns before changing the query, which this sandbox can't do.
- **Reset-password warm-start deep link, endurance/run pause controls, onboarding back affordance** — all UX fixes that touch navigation/timer behavior best confirmed on a device or simulator, unavailable in this sandbox.
- **Triathlon auto-regen losing swim/bike balance** — needs a product decision on where `weeklySwimDays`/`weeklyBikeDays`/`triathlonDistance` should be persisted (currently only in auth `user_metadata`) before changing `ozzie-generate-plan`'s fallback branch.
- **Dependency/SDK currency** — still Expo SDK 52 / RN 0.76, several majors behind current stable; an upgrade of that size needs full on-device regression testing.
- **Test coverage** — still no test runner in this repo. TSB/ACWR math and the pace-anchor logic touched this run are exactly the kind of pure functions that would benefit most from a lightweight suite once one exists.
