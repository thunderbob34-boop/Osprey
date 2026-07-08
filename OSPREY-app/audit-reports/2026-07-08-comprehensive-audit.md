# OSPREY Comprehensive Audit — 2026-07-08

Branch: `claude/great-pascal-bdwpoj` (off `main` @ `9afbd55`)
Run: autonomous, six-phase pass — code quality (Opus) → UX (Opus) → feature
end-to-end verification (Opus) → fixes (Sonnet) → independent verification
(Opus) → this report.

Baseline before any fixes: `npm ci` (node_modules wasn't installed in this
sandbox) then `npm run lint` / `npm run typecheck` — both clean, 0
errors/warnings, matching the 2026-07-02 audit's baseline. (One of the three
Opus audit passes ran in a sandbox with a stray global ESLint v10 and no
`node_modules`, and reported lint/typecheck as broken — that was an
environment artifact of that agent's sandbox, not a repo bug; a clean
`npm ci` in this session's environment reproduces 0 errors on both.)

---

## 1. Code quality findings (Opus)

| # | Severity | Finding |
|---|----------|---------|
| 1 | **High** | IDOR: `get_my_friends`, `get_friends_at_race`, `get_race_partners`, `get_pending_friend_requests` — 4 `SECURITY DEFINER` RPCs trusted a client-supplied `p_user_id` (or had no ownership check at all), letting any authenticated user read another user's friend list, pending requests, or a race's training partners by passing an arbitrary UUID. |
| 2 | **High** | Activity/social feed non-functional: client called a `get_activity_feed` RPC that was never shipped; the fallback query is scoped by self-only RLS on `activity_shares`/`kudos`, so the feed only ever showed the caller's own shares with kudo counts of 0 or 1. |
| 3 | Medium | `ozzie-generate-plan` inserted unvalidated LLM JSON straight into `session_type`/`intensity` enum columns — a hallucinated value 500s the entire plan-generation request (the user's only onboarding output). |
| 4 | Low | Triathlon day-split rounding over-allocated at `daysPerWeek <= 3` (requested 4 discipline-days for a 3-day athlete). |
| 5 | Low | `existingWeek` idempotency check used `.maybeSingle()`, which throws (500) if a user ever ends up with 2+ active plans sharing a week's start date. |

**Also found during fix verification (not part of the original 3 audit passes):** a genuine migration-history defect — `saved_routes` was defined twice, with two different, incompatible column sets, once in `initial_schema.sql` (unused columns: `surface`/`gpx_url`/`start_lat`/`start_lon`/`is_public`) and again in `023_saved_routes.sql` (the one the app actually queries: `tags`/`distance_km`/`notes`). Replaying all 32 migrations against a fresh Postgres 16 database failed at `023` with `relation "saved_routes" already exists` — this was caught by actually spinning up a local Postgres and replaying the full migration chain, something none of the three static-read Opus passes did.

Coaching-calculator spot check (per `CLAUDE.md`): CSS, Daniels pace offsets, Prilepin table, and endurance fueling tiers in `src/services/calculators/*` all match `docs/coaching/_index.md` exactly — no correctness bug in the sport-science math itself. (See Feature Recommendation #1 below for the bigger architectural finding: these calculators are almost entirely unused by the actual plan generator.)

## 2. UX findings (Opus)

| # | Severity | Finding |
|---|----------|---------|
| 1 | **High** | Paywall subscribe button showed the annual price with a hardcoded `/mo` suffix (e.g. "$59.99/mo" for a $59.99/**year** plan) — a real price-misrepresentation risk. |
| 2 | Medium | No back navigation anywhere in the 5-screen onboarding flow — the highest-drop-off moment in the app, with no way to fix a mistyped answer short of an OS-level back gesture. |
| 3 | Medium | Run/recap screens hardcode imperial units regardless of the user's unit preference (part of the known `docs/TODO.md` "units sweep" item — confirmed and detailed to the two most visible files). |
| 4 | Low–Med | Onboarding progress bar had an off-by-one (`totalSteps=5` for 4 real steps) — never reached 100%. |
| 5 | Low–Med | "Ask Ozzie" avatar CTA leads to a screen that explicitly states two-way chat isn't live — over-promising label. |
| 6 | Low | Goals screen lets you continue without an explicit primary-goal tap (defaults silently to "hybrid"). *(not fixed this pass — see Deferred)* |
| 7 | Low | "Recalibrate →" banner button actually triggers a full plan rebuild, not a light tune. |
| 8 | Low | Three inconsistent back-button visual treatments across screens. *(not fixed — cosmetic/design-system cleanup, out of scope for a bug-fix pass)* |
| 9 | Low | Sub-44px touch targets on the onboarding day-picker. *(not fixed — same reason)* |

Confirmed **good**: destructive-action confirmations, loading/empty/error states, and on-voice coaching copy are all solid across the app — no gaps found.

## 3. Feature end-to-end verification (Opus)

| Feature | Verdict |
|---|---|
| Onboarding → plan generation | Partially working — the pipeline works, but plan generation is 100% an LLM prompt covering 4 goal archetypes; 8 of 9 `docs/coaching` sport calculators are dead code with zero consumers (see Feature Rec. #1) |
| Workout logging (lift/endurance/run/recap/hyrox) | Working — one latent bug found (coach_memory upsert, fixed) and one built-but-unconnected gap (GPS runs never save as reusable routes) |
| Nutrition (scanner/macros/supplements) | Working, minor data-quality caveats only |
| Race hub | Partially working — search distance filters were fully broken (fixed), retro→coach-memory callback was silently failing (fixed) |
| Social (friends/challenges) | Working — all RPCs defined and correctly scoped |
| Ozzie AI coach | Working — all 8 edge functions invoked, none orphaned; "Ask Ozzie" two-way chat is honestly labeled as not-yet-live |
| Paywall/subscription | Working — pricing display bug fixed; note `hasOspreyPlus()` fails open off-iOS (acceptable for an iOS-only launch) |
| Body metrics/hydration/calendar | Working end-to-end |

---

## 4. Fixes applied

**Security**
- `supabase/migrations/20260711000033_fix_social_rpc_idor.sql` — all 4 IDOR RPCs now resolve identity via `auth.uid()` instead of a client-supplied id; `get_race_partners` gained a race-ownership check matching its table's RLS policy.

**Data / backend**
- `supabase/migrations/20260711000034_add_activity_feed_rpc.sql` — ships the missing `get_activity_feed` RPC (friend-scoped via a `friendships` CTE, aggregated kudo counts, `auth.uid()`-only visibility — no new IDOR surface).
- `supabase/migrations/20260711000035_fix_coach_memory_upsert_conflict.sql` — converts the two `coach_memory` dedup indexes from partial to standard unique indexes so Supabase's bare-column-list `upsert()` can actually resolve `ON CONFLICT` (previously silently failing on every PR and race-result memory write).
- `supabase/migrations/20260628000001_initial_schema.sql` + `20260628000004_fix_remaining_rls.sql` — removed the duplicate/incompatible `saved_routes` table and its orphaned RLS block; the app-matching schema in `023_saved_routes.sql` is now the sole definition. **Verified by replaying all 35 migrations against a fresh local Postgres 16 database — now succeeds end to end** (previously failed at 023).
- `supabase/functions/ozzie-generate-plan/index.ts` — added `sanitizeDays()` to whitelist LLM-generated `session_type`/`intensity` against the real DB enums and bound/dedupe `dayOffset` before insert; fixed triathlon day-split rounding for `daysPerWeek <= 3`; replaced the throwing `.maybeSingle()` idempotency check with a non-throwing `.limit(1)`.

**UX**
- `OSPREY-app/app/paywall.tsx` — subscribe button and its accessibility label now derive the correct period suffix (`/yr`, `/mo`, `/wk`, etc.) from the selected package instead of hardcoding `/mo`.
- `OSPREY-app/src/components/onboarding/OnboardingShell.tsx` + all 5 `app/(onboarding)/*.tsx` screens — added a back-chevron button and fixed `totalSteps` (5→4) so the progress bar reaches 100% on the last real step.
- `OSPREY-app/app/race-search.tsx` — distance filter chips (5K/10K/Half/Full) were always empty because the race-list API never returns per-race distances; now enriches each result from the detail endpoint after the initial load (with a request-id guard against stale async writes). A follow-up one-line fix corrected a "Half" vs "Half Marathon" string mismatch that the independent verification pass caught.
- `OSPREY-app/src/screens/DailySummary.tsx` / `app/(tabs)/workout.tsx` — relabeled two misleading CTAs ("Ask Ozzie" → "Today's read from Ozzie"; "Recalibrate" → "Rebuild plan").

**Deferred (documented, not fixed this pass):** goals-screen implicit-default selection, inconsistent back-button styling across screens, sub-44px onboarding day-picker touch targets, units-display sweep (pre-existing `docs/TODO.md` item), GPS-run-to-saved-route linkage, and the architectural gap in Feature Recommendation #1 below. All are low severity or large/architectural enough to warrant a dedicated, reviewed pass rather than an unattended fix.

## 5. Verification results

An independent Opus pass reviewed the full diff against the original vulnerable/broken code, re-derived the triathlon-split math by hand for every reachable `daysPerWeek` value, grepped for other callers of every changed function/table, and re-ran `npm run lint` / `npm run typecheck`.

**Verdict: 5 of 6 fix categories PASS outright.** The verifier caught one real regression-adjacent bug the fix itself introduced: the newly-functional race-search distance filter used `'Half'` where the actual data now says `'Half Marathon'`, so the Half chip would have returned zero results even after the enrichment fix. Corrected in a follow-up commit; re-verified `npm run typecheck` clean.

Additionally, the local-Postgres migration replay (used to catch the `saved_routes` duplication) is itself a verification method worth keeping — it caught a bug none of the three static-read audit passes found, and should be part of any future migration change.

**Final state:** `npm run lint` — 0 errors. `npm run typecheck` — 0 errors. All 35 migrations replay cleanly against a fresh database. New/modified RPCs smoke-tested directly against Postgres.

---

## 6. Feature recommendations

### 1. Wire the dormant sport-science calculators into the plan engine ("Coach-Grade Precision")

**The gap:** `docs/coaching/` blueprints for 9 sports were fully coded into `src/services/calculators/{running,cycling,swimming,rowing,triathlon,powerlifting,crossfit,ultra,shared}.ts` — correct, blueprint-matching math (verified this audit) — but `ozzie-generate-plan`'s actual plan generator is a single GPT-4o-mini prompt that only knows 4 goal archetypes (hybrid/run/lift/triathlon) and never imports any of these modules except `hyrox.ts`. The onboarding goals screen doesn't even let a user pick ultra, standalone cycling/swimming/rowing, powerlifting, or crossfit as a goal, so 8 of 9 documented sport blueprints can never fire. This directly contradicts `CLAUDE.md`'s stated architecture ("shared 4-input engine... per-sport zone and fuel parameters swapped in") and is the single biggest gap between what OSPREY's coaching content promises and what the app generates.

**The pitch:** most AI-fitness apps (Whoop, generic GPT wrapper apps) either have no real exercise science underneath the LLM, or have exercise science but no warm coaching voice. OSPREY already has both, built and correct — they're just not connected. Making training zones, paces, and taper come from a deterministic, coach-authored formula (with the LLM only handling sequencing, tone, and narrative "ozzie_notes") is a defensible, marketable claim ("every number in your plan traces to sport science, not a language model's guess") that competitors using pure-LLM plan generation cannot make.

**Scope:** (1) Expand onboarding's goal picker to expose all 9 sports (or a smaller v1 subset — running/cycling/swimming/triathlon/ultra are the highest-leverage, already-coded ones). (2) In `ozzie-generate-plan`, before calling the LLM, compute the day's zones/paces/taper phase deterministically via the matching `calculators/*` module and pass them into the prompt as hard constraints ("this session's pace band is X:XX–Y:YY/mi, non-negotiable") rather than asking the LLM to invent them. (3) Post-validate the LLM's output against the calculator's expected ranges (extending the `sanitizeDays()` validation already added this pass) and fall back to a fully deterministic template (no LLM) if the model's numbers drift outside them. (4) Update `PrimaryGoal`/`TrainingGoal` types and `preferences.tsx` to match.

**Effort:** Large (3–4 weeks) — touches onboarding UI, the plan-generation edge function, and needs real-athlete-data validation per sport before shipping, but each sport can ship incrementally since the calculators already exist and are already correct.

**Integration points:** `app/(onboarding)/goals.tsx`, `app/preferences.tsx`, `src/types/onboarding.ts`, `supabase/functions/ozzie-generate-plan/index.ts` (the `PLAN_SYSTEM_PROMPT` and `generateWeekDays`), `src/services/calculators/*` (already built).

### 2. Real two-way conversational coach

**The gap:** `app/ask-ozzie.tsx` is honestly labeled but fully read-only — it shows the daily brief and states "two-way conversations with Ozzie aren't live yet." Every other `ozzie-*` edge function is a fire-and-forget, single-purpose call (daily brief, nutrition coaching, race briefing). There's no persistent conversational thread where a user can ask "why is today an easy day?" or "swap tomorrow's run, I have a work trip" and have Ozzie actually act on it.

**The pitch:** this turns Ozzie from a set of scripted, one-way outputs into an actual coaching relationship — the single most differentiating thing an AI coach can offer over a static training-plan app (TrainingPeaks, Strava) or a data-only wearable (Whoop, Garmin). Function-calling against data OSPREY already has (today's plan, training load, nutrition targets, race calendar) means the chat can be genuinely useful, not just a chatbot bolted onto the app.

**Scope:** (1) New `ozzie-chat` edge function using OpenAI function-calling with tools that wrap existing, already-tested services: `swapTodaySession`/`compressTodaySession` (plan edits), `fetchNutritionTargets`, `fetchTrainingLoad`, `fetchRaces`. (2) New `coach_conversations`/`coach_messages` tables (RLS: self-only, same pattern as every other user-owned table in this schema) to persist thread history so Ozzie has memory across a conversation, feeding off the `coach_memory` table already fixed this pass. (3) Rebuild `ask-ozzie.tsx` as an actual chat UI (message list + input, matching the existing screen's Ozzie-branded visual style) instead of the current read-only card.

**Effort:** Medium–Large (2–3 weeks) — the hard part is scoping which actions the model is allowed to take autonomously (read-only Q&A first, plan edits behind an explicit confirmation step) rather than the plumbing itself, since the underlying services already exist.

**Integration points:** new `supabase/functions/ozzie-chat`, new migration for conversation tables, `app/ask-ozzie.tsx` (full rewrite), `src/services/workouts.ts`/`nutrition.ts`/`races.ts` (reused as tool targets, not modified).

### 3. Training Crews — persistent small-group coaching pods

**The gap:** Challenges (mileage/workouts/duration/streak/lift_volume competitions) and the activity feed (just fixed this pass) are both one-off or feed-shaped — there's no persistent "your people" social unit with its own identity, just ad-hoc challenges and a scrolling feed. Strava has kudos and clubs but no coaching layer; solo AI-coach apps have no social layer at all.

**The pitch:** a standing "crew" (3–8 friends) gets a weekly Ozzie-generated digest comparing everyone's training load, streaks, and a fun highlight ("Sarah's your most consistent teammate this month — 6/6 planned sessions"), turning the freshly-fixed friends/activity/challenges infrastructure into an ongoing habit loop instead of isolated one-time challenges. This is a genuinely new category (AI-narrated group accountability), not just "add a leaderboard."

**Scope:** (1) New `crews`/`crew_members` tables (same ownership/RLS shape as `challenges`/`challenge_members`, which already have the right pattern to copy). (2) A new `ozzie-crew-digest` edge function that runs weekly per crew, pulling each member's `workout_logs`/`coach_memory`/streak data (via `get_challenge_leaderboard`-style `SECURITY DEFINER` aggregation) and generating a short narrated recap. (3) New `app/crew.tsx` screen (crew roster, weekly digest history, quick-create-challenge-with-this-crew shortcut that pre-fills `challenge_members` from `crew_members`). (4) Push notification when a new digest is ready, reusing the existing `expo-notifications` scheduling pattern from `supplements.ts`.

**Effort:** Medium (2 weeks) — almost entirely new-but-narrow surface area that closely mirrors two patterns (`challenges` schema, `get_challenge_leaderboard` aggregation, `ozzie-daily-brief` narration) already proven correct and secure elsewhere in this exact codebase.

**Integration points:** new migration for `crews`/`crew_members`, new `supabase/functions/ozzie-crew-digest`, new `app/crew.tsx` + `src/services/crews.ts`, `app/friends.tsx` (add "start a crew" from a friend list), `src/services/supplements.ts` (notification-scheduling pattern to reuse, not modify).

---

## Environment notes for future runs

- `node_modules` was not present in this sandbox; `npm ci` installed cleanly from the committed `package-lock.json` in ~30s with no version drift (pinned `eslint@8.57.1`, `expo@52.0.49` — matches what `.eslintrc.js`/`tsconfig.json` expect). If a future run reports lint/typecheck as broken, run `npm ci` first before concluding it's a repo bug.
- This sandbox has a local Postgres 16 cluster (`service postgresql start`) with no running Supabase stack. Migration-replay verification (creating a throwaway DB, stubbing `auth.uid()`/`auth.role()`/roles, then applying every file in `supabase/migrations/` in order) is cheap and caught a real bug (`saved_routes` duplication) that pure static reading missed — worth doing on every migration-touching change going forward, not just this one.
