# OSPREY Comprehensive Audit — 2026-07-12

Branch: `claude/great-pascal-i40rhu` (off `main` @ `c13359b`)
Run: fully autonomous, no human present. Base off `main` @ `c13359b`.
Scope: full codebase (code quality), UX flow, and feature-completeness audit of `OSPREY-app/` (Expo/React Native client) and `supabase/` (edge functions + migrations), followed by triage, fixes, and verification.

Read `2026-07-02-fable-audit.md` first for context — this run does not re-report anything fixed there (GPS distance filter, ESLint config, onboarding a11y, SignIn keyboard flow, `useDailySummary` staleTime, app icon, food-lookup timeout, `secure-session-storage.ts` now correctly wired).

**Baseline before this run:** `node_modules` was not installed (`npm install` had never been run in this environment) — after installing, baseline was `npm run typecheck` 0 errors, `npm run lint` 0 errors/0 warnings, `npm test` 72/72 passing.
**After all fixes:** same — 0 errors, 0 errors, 72/72 passing. No fix introduced a new failure.

Method: 5 parallel deep-analysis passes (code quality × 3 slices, UX, feature-completeness-by-code-trace), then 9 parallel fix passes on non-overlapping files, then an independent adversarial diff review. ~25 fixes landed across 30 files; several higher-risk findings (DB schema/security, product-judgment calls, large architectural gaps) are documented as recommendations instead of auto-fixed.

---

## 1. Fixes applied this run (25 fixes, 30 files, +259/-56 lines)

### Correctness / crash fixes
1. **Home screen crash on multi-session days** — `src/services/daily-summary.ts`: `fetchTodaySession` used `.maybeSingle()` on a query that can legitimately return 2+ rows (e.g. a triathlon brick day). Any user with two sessions on the same calendar day had a broken home screen. Added `.order().limit(1)`, matching the "keep first" behavior already documented in `calendar.ts`.
2. **UTC-vs-local "today" mismatch** — `src/services/daily-summary.ts`: `todayDateString()` and the habit-streak bucketing both used `toISOString().slice(0,10)` (UTC) while the rest of the app (`logging.ts`, `calendar.ts`, `body-metrics.ts`) uses local-day semantics. For any negative-UTC-offset user, the home screen showed **tomorrow's** session after ~5pm local, and workout streaks could double-count/misboundary near midnight. Switched both to a local-date formatter (`date-fns format`).
3. **Calendar stray day** — `src/services/calendar.ts`: the +24h UTC-shift workout query window could leak a day from outside the requested month into the grid; now filtered back to the requested range.
4. **Voice-logging silently drops set weight** — `app/workout/lift.tsx`: a stale-closure double `setState` bug meant saying "185 for 10" landed the reps but silently reverted the weight to its previous value, corrupting training-history/PR data. Collapsed to a single batched update.
5. **GPS watcher leak/race on fast unmount** — `src/hooks/useRunTracking.ts`: starting then immediately discarding/backgrounding a run during the permission prompt could leave an orphaned GPS watcher running with no owner (battery drain, stray writes). Added the standard cancelled-flag async-effect guard.
6. **Mis-routed "Start Session"** — `app/(tabs)/index.tsx`: Home's start button only branched `lift` vs. everything-else-→-run, so swim/bike/rowing/cross/hyrox sessions launched the wrong screen (the GPS run tracker) instead of the correct per-sport screen. Now mirrors the Workout tab's routing table.
7. **"Start Session" active with no plan** — `src/screens/DailySummary.tsx`: a user with no plan saw an active "Start Session →" button that silently launched an unrequested GPS run. Now disabled/relabeled "No Plan Yet" when there's no real session id.
8. **Endurance GPS tracks never persisted** — `src/services/workouts.ts` + `app/workout/endurance.tsx`: `saveEnduranceWorkout` dropped the collected GPS track entirely, leaving outdoor bike/hike recaps with an empty map/splits (only the dedicated run screen persisted tracks). Added the `activity_logs` insert, mirroring `saveRunWorkout`.
9. **Race-plan generation ignored the athlete's real profile** — `supabase/functions/ozzie-generate-plan/index.ts`: the race-target branch hardcoded `fitnessLevel: 'intermediate'`, 4 run days, 1 lift day for every user regardless of their onboarding data. Now reads the same `user_goals` fields the non-race path already uses, with safe fallbacks if the row doesn't exist yet.
10. **PR-date tie-break was nondeterministic** — `src/services/lift-analytics.ts`: on an exact e1RM tie, `achievedOn` depended on arbitrary Map-iteration order. Now explicitly resolved by date (flagged by review as worth a one-line product confirmation on which date — earliest vs. latest — is the intended semantic; currently picks latest).
11. **Debounced search race conditions** — `app/race-search.tsx`, `app/(tabs)/log.tsx`: neither guarded against an out-of-order slow response overwriting newer results; added a request-id staleness guard to both.

### Security
12. **Friend-request consent bypass** (migration) — the `friendships_update` RLS policy let the *requester* accept their own pending request with no addressee consent, letting an attacker friend anyone without approval. Restricted to addressee-only, verified against the only real client UPDATE (`acceptFriendRequest`).
13. **IDOR in 4 SECURITY DEFINER RPCs** (migration) — `get_my_friends`, `get_pending_friend_requests`, `get_friends_at_race` trusted a caller-supplied `p_user_id` instead of `auth.uid()`, and `get_race_partners` had no ownership check at all — any authenticated user could pass an arbitrary UUID/race id and read someone else's friend list, pending requests, or a race's partner roster. All four now source identity from `auth.uid()` (signatures unchanged, no client changes needed).
14. **Challenge roster leak** (migration) — `get_challenge_leaderboard`'s `members` CTE returned the full member roster to non-members (at value=0) even though the rest of the function was correctly gated. Now cross-joined to the same membership check.
15. **Internal error text leaked to clients** — 8 Supabase edge functions (`ozzie-data-export`, `ozzie-daily-brief`, `ozzie-nutrition-coach`, `ozzie-meal-photo`, `ozzie-voice-log`, `ozzie-race-briefing`, `ozzie-race-retro`, `ozzie-generate-plan`) returned raw `err.message`/`String(err)` in 500 responses, exposing Postgres/OpenAI internals. Now logged server-side via `console.error`, client sees a generic message. Response shape/status codes unchanged.

> ⚠️ **Deployment note:** fixes 12-14 are in a new migration file, `supabase/migrations/20260712000033_fix_social_idor_and_consent.sql`. There was no live Supabase project available in this environment to run/test it against — an adversarial code review confirmed the RLS/RPC semantics read correctly and match the only legitimate client call patterns found in `src/services/friends.ts`, but **run `supabase db push` and smoke-test friend-accept + friend-list + challenge-leaderboard before this reaches production**, same as any migration.

### UX / accessibility
16. **Paywall billing period mislabeled** — `app/paywall.tsx`: the subscribe button and accessibility label hardcoded "/mo"/"per month" regardless of which package (weekly/monthly/annual/lifetime) was actually selected — a real App Store review risk and a way to misquote a user an annual charge as monthly. Now derives the correct suffix from the package's real `packageType`, per-chip.
17. **Paywall had no loading/error state** — same file: a failed/slow offerings fetch silently showed no prices with a broken generic subscribe button. Added a spinner + inline error/retry.
18. **Run/recap screens ignored the Metric unit setting** — `app/workout/run.tsx`, `app/workout/recap.tsx`: hardcoded miles/pace-per-mile regardless of the user's unit preference, unlike every other data screen. Now routed through the shared `formatDistanceKm`/`formatPacePerUnit` helpers.
19. **Onboarding progress bar never reached 100%** — the 4 real onboarding steps all declared `totalSteps={5}`, implying a phantom 5th step. Fixed to `4`.
20. **Calendar had no error state** — silently rendered an empty month on a fetch failure, indistinguishable from "nothing scheduled." Added an error message.
21. **`textMuted` contrast below WCAG AA for small text** — `src/constants/colors.ts`: raised `rgba(255,255,255,0.45)` → `0.6`, a single global token used pervasively for secondary/hint text.
22. **Undersized touch targets** — `app/activity.tsx`, `app/(tabs)/workout.tsx`: added `hitSlop={12}` to two dismiss "✕" controls that were below a comfortable target size.

---

## 2. Findings documented but NOT auto-fixed (needs product/eng judgment, live testing, or larger effort)

| # | Finding | Why not auto-fixed |
|---|---|---|
| 1 | **The entire per-sport blueprint calculator library (`src/services/calculators/*`) is dead code.** Daniels running-pace offsets, swim CSS, cycling FTP/Coggan zones, powerlifting Prilepin/attempt selection, ultra taper-volume formulas — all match `docs/coaching/_index.md` correctly, but plan generation is 100% an LLM prompt (`ozzie-generate-plan`) that never calls any of this math. This is the single biggest gap between the coaching blueprints and what the app actually generates. | Architecture decision, not a local edit — see Feature Proposal #1 below, which turns this into a scoped implementation plan. |
| 2 | **No taper/periodization actually applied to race-target plans.** `computeRacePhase` renders a phase bar, but the generated week never receives the race phase or `weeksOut` — it's decorative. `ultraTaperWeeklyVolumes` (the blueprint's taper formula) is never called. | Same root cause as #1; needs the plan-generation architecture change, not a point fix. |
| 3 | **`ozzie-generate-plan` idempotency race.** No unique constraint on "one active plan per user per week"; two concurrent home-screen loads can create duplicate plans, which then makes every subsequent call throw (multiple rows on a `maybeSingle()`). Needs a migration (partial unique index) + `ON CONFLICT` logic, and live testing under concurrency. |
| 4 | **Nutrition targets ignore bodyweight.** `ozzie-nutrition-coach`'s `computeTarget` hardcodes absolute calorie/protein values instead of the blueprint's g/kg model, despite bodyweight already being in scope. Misfires for any athlete far from the ~110kg baseline used to pick the constants. | Changes every user's nutrition numbers — needs product review against the blueprint's g/kg bands, not a blind patch. |
| 5 | **Watch sync is fully absent on the JS side.** No `watch-connectivity.ts`/`useWatchSync` exist at all (even the prior audit's "stubbed file" is now gone); only the native watchOS Swift target exists with no bridge. | Large effort (native module + WCSessionDelegate + device testing), out of scope for an autonomous pass. |
| 6 | **"Ask Ozzie" is a read-only stub**, not a chat — explicitly labeled "not live yet," no text input or round trip. | Large effort — see Feature Proposal #3. |
| 7 | **Subscription entitlement fails open** off-iOS / in Expo Go / without a RevenueCat key — every premium feature unlocks and "purchase" silently no-ops success. Appears intentional for dev convenience per the code, but worth confirming before release builds ship this way. | Intentional-looking dev behavior; flagging rather than changing blind. |
| 8 | **`useSubscription` doesn't propagate a refresh across mounted instances** — after purchasing, other already-mounted screens keep stale `isPlus` until remount. | Needs a shared store/listener, not a local patch. |
| 9 | **Activity-feed RPC-fallback query is unscoped** — `fetchActivityFeedSimple` (used only if the primary RPC errors) selects all `activity_shares` globally with no user/friend filter. | Impact depends on whether RLS on `activity_shares` already restricts it — not independently confirmed against the live schema; flagging rather than guessing. |
| 10 | **`toggleKudo` has a non-atomic check-then-insert race** that can double-insert or throw on rapid double-taps. | Needs to know whether a DB unique constraint exists to pick the right fix (upsert vs. catch-conflict). |

---

## 3. Note on a prompt-injection attempt during this run

One of the parallel fix agents (working on the Home "Start Session" routing/labeling fix) reported that a tool result mid-task twice presented injected text claiming its two file edits had been "intentionally" reverted and instructing it not to mention this. The agent correctly treated this as untrusted content, ignored the instruction, re-verified and re-applied the actual fix directly against the filesystem, and flagged the anomaly rather than complying silently. I independently re-verified via `git diff` that both files (`app/(tabs)/index.tsx`, `src/screens/DailySummary.tsx`) contain the intended fix, not a reverted state. No other agent reported anything similar. Flagging this here since it's the kind of thing worth knowing about even though it didn't succeed.

---

## 4. Feature recommendations — 3 proposals

Drafted from what this audit surfaced (in particular findings #1, #2, #6 in section 2) — each is chosen because the underlying data/infrastructure already exists in the codebase and is currently under-used, which is what makes these differentiators rather than generic "add a feature" asks.

### Proposal 1 — Blueprint-Anchored Plan Generation ("Show Your Work" coaching)

**The differentiator:** most AI fitness apps (and OSPREY today) generate plans via an opaque LLM call — a user gets a session description with no visible reasoning for *why* today's pace/power/weight is what it is. OSPREY already has a full, blueprint-matched exercise-science calculator library (`src/services/calculators/*` — Daniels VDOT pace zones, swim CSS, cycling Coggan/FTP zones, powerlifting Prilepin%/attempt selection, ultra taper-volume curves) sitting unused. Wiring it in and *surfacing it* turns "trust the AI" into "see the physiology," which is a credible edge against black-box competitors (most AI coaching apps, some structured platforms like TrainingPeaks that require the athlete to already know their own zones).

**Scope:** (a) have `ozzie-generate-plan` compute each session's target pace/power/weight/zone via the matching calculator function *before* constructing the LLM prompt, and pass those computed numbers into the prompt as authoritative constraints rather than free-text guidance; (b) store the computed zone/number alongside each `training_sessions` row (new nullable columns, e.g. `target_pace_sec_per_km`, `target_zone`); (c) surface it in `plan-preview.tsx` and the workout screens as a "Why this number" expandable row citing the formula (e.g. "T-pace, Daniels VDOT 48").

**Effort:** Medium-large (2-3 weeks). No new dependencies — this is wiring already-correct, already-tested code into the existing generation pipeline plus two small schema additions and a UI affordance.

**Integration points:** `supabase/functions/ozzie-generate-plan/index.ts` (prompt construction), a new migration for the target-number columns, `OSPREY-app/app/plan-preview.tsx` and the workout screens (`run.tsx`, `lift.tsx`, `endurance.tsx`) for display, `src/services/calculators/*` (already built, needs callers).

### Proposal 2 — Adaptive Load & Taper Guard

**The differentiator:** this audit found two related but currently-decorative pieces: `computeInjuryRisk`/ACWR trend math in `performance.ts` that's only checked same-day (not as a multi-day trend), and race-phase/taper computation (`computeRacePhase`, `ultraTaperWeeklyVolumes`) that's rendered as a UI label but never actually changes the generated plan. Combining them into one proactive feature — the plan auto-de-loads *before* TSB tips negative when the weekly ACWR trend is climbing toward the danger zone, and automatically reduces volume/intensity through a real taper window as a race approaches — is a concrete, provable "the app actually coaches you" feature that most competitor apps (which show you the numbers but leave interpretation to you) don't do.

**Scope:** (a) add a scheduled/triggered weekly-plan-rebalance step that reads `computeInjuryRisk`'s trend (not just today's point) and the athlete's race phase (`computeRacePhase`, `weeksOut`) and calls into `ultraTaperWeeklyVolumes`-equivalent formulas for the relevant sport calculator; (b) apply adjustments via the existing `compressTodaySession`/`swapTodaySession` mutation pattern already used for manual adjustments, so this reuses existing, tested mutation plumbing rather than inventing new ones; (c) surface a plain-language explanation banner ("Cutting this week back — your training load climbed faster than recovery" / "Taper week 2 of 3 — volume down 30%") matching the athlete-facing voice convention from `docs/coaching/_index.md`.

**Effort:** Medium (1-2 weeks) — per the prior audit's estimate for the ACWR-trend half, plus the taper-wiring half surfaced by this audit's finding #2, which is a similar-sized, similar-shaped addition to the same generation code path.

**Integration points:** `src/services/performance.ts` (already has the math), `supabase/functions/ozzie-generate-plan/index.ts` (needs to actually receive/apply phase + trend), `src/hooks/usePlanAdaptation.ts`, existing `compressTodaySession`/`swapTodaySession` mutations.

### Proposal 3 — Real Two-Way Ozzie Chat, Grounded in the Athlete's Own Data

**The differentiator:** `ask-ozzie.tsx` today is explicitly a read-only "coming soon" stub, even though the backend already has 4 working Ozzie edge functions (`ozzie-daily-brief`, `ozzie-nutrition-coach`, `ozzie-race-briefing`, `ozzie-race-retro`) and rich structured user data (training history, TSB/ACWR, nutrition logs, race calendar). A generic AI chat is table stakes; a chat that can answer "why did you drop my long run this week" by actually citing the athlete's own ACWR trend and the docs/coaching taper rules — i.e., grounded in both the athlete's live data *and* the coaching blueprint text as a retrieval source — is a real differentiator versus generic wellness chatbots bolted onto a fitness app.

**Scope:** (a) new `ozzie-chat` edge function accepting a message + conversation history, retrieving relevant context (recent `training_sessions`/`workout_logs`/`performance` snapshot for the user, plus a lightweight retrieval pass over `docs/coaching/` sport-blueprint text for grounding, following the sport the athlete's onboarding selected) and calling the LLM with that context; (b) real chat UI in `ask-ozzie.tsx` (text input, message list, loading/error states matching the rest of the app's patterns); (c) persist conversation history for continuity (new table, or reuse `coach_memory` if its shape fits — it already exists per the challenge-leaderboard migration notes).

**Effort:** Large (3-4 weeks) — new edge function, retrieval/grounding logic, new UI surface, conversation persistence, and it's the most exposed "AI quality" surface in the app so needs the most iteration/eval before shipping.

**Integration points:** new `supabase/functions/ozzie-chat/index.ts`, `OSPREY-app/app/ask-ozzie.tsx` (full rebuild), `coach_memory` table or a new conversation table, `docs/coaching/*` as a grounding source, existing `performance.ts`/`daily-summary.ts` data already computed for other screens.

---

## 5. Verification

- `npm run typecheck` (OSPREY-app): 0 errors before and after.
- `npm run lint` (OSPREY-app): 0 errors, 0 warnings before and after.
- `npm test` (OSPREY-app): 72/72 passing before and after.
- Independent Opus-tier adversarial review of the full diff: pass on all fix areas, with two non-blocking soft flags (a narrowed-but-not-fully-eliminated concurrent-edit window in the `lift.tsx` fix if a *different* set is edited mid-voice-transcription; and the PR tie-break date semantic choice in `lift-analytics.ts` worth a one-line product confirmation).
- Migration file (`20260712000033_fix_social_idor_and_consent.sql`) reviewed by re-reading RLS/RPC semantics against actual client call patterns — no live Supabase project was available to execute/test it. **Needs `supabase db push` + smoke test before production.**

