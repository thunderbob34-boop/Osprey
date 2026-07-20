# Audit Branch Map & Reconciliation

> Companion to [MASTER-PLAN.md](MASTER-PLAN.md) Section 2. Created 2026-07-13, rewritten 2026-07-20
> after the full audit-remediation pass on `claude/osprey-quality-audit-qa446v`.
> Maps every `origin/claude/*` audit branch to what it fixes/adds and its status vs `main`.

## TL;DR — the current story

Every fix-oriented `claude/*` branch has now been individually re-verified against current `main` and
harvested where the bug was still real. Nothing here is "verify later" anymore — each branch below has a
concrete disposition. The only branches with real remaining value are the four that contain genuine
**unshipped feature work** (Apple Watch bridge, Ozzie Live voice coaching, Fuel Plan/meal-prep, physique
coaching, etc.) — those are a product call, not a bug-fix harvest, and are called out separately below.

### What's fixed on `main` as of this pass
All of the following landed as fresh, re-verified commits on `claude/osprey-quality-audit-qa446v` (not
merges — every branch's diff was checked against current code first, since several turned out to be stale
or already independently superseded by a different, more robust fix):

- **Postgres schema bugs**: `coach_memory`'s partial unique indexes broke `.upsert(onConflict:...)`;
  `saved_routes` had drifted out of sync between the repo's migration files and the live production schema
  (fixed directly against production via Supabase MCP — the table was empty, no data lost); `workout_logs`/
  `plan_adjustments` FKs defaulted to `RESTRICT`; `friendships_insert` allowed reciprocal duplicate requests.
- **Edge functions**: unvalidated LLM enum values inserted raw into `training_sessions`; triathlon day-split
  rounding overallocated at ≤3 days/week; `ozzie-generate-plan`'s ATL/CTL formula diverged from the app's
  own `performance.ts`; `load_scores` had no writer anywhere, so the daily brief's train/easy/rest
  recommendation never fired.
- **Mobile services**: HealthKit workout writes silently dropped distance/calories (wrong field nesting) and
  were missing swim/bike/rowing/hyrox activity types; HRV synced with the wrong unit; sleep duration
  double-counted overlapping HealthKit samples; PR detection returned a false positive on no-history/query
  error; mile splits discarded GPS overshoot; quick-added food wrote total macros as if they were a per-100g
  density; onboarding's `user_goals` insert wasn't retry-safe; several `:60` time-rollover bugs; the
  race-time predictor picked "best effort" by distance instead of pace; `ozzie-audio.ts`'s `Buffer.from()`
  would crash on real devices (no Buffer polyfill in Hermes) and its cache-key collided across texts sharing
  a prefix; `authStore.signIn()` raced `onAuthStateChange`; lift-PR tie-breaks were nondeterministic.
- **Mobile UI**: missing error states on Friends/Calendar; Google sign-in shown despite the provider being
  disabled; dropped coaching cues with no visual-banner fallback; stale Lift-card copy and a mislabeled
  "Recalibrate" button that's actually destructive; the race-search "Half" filter matched nothing and
  distances were never fetched for search results; distance/pace stat displays ignored the metric/imperial
  preference; none of the four workout-finish screens invalidated Home/Stats/Calendar's query caches; the
  session-swap sheet listed the current session as a selectable no-op; a food-search race condition.

See the branch's own commit history on `claude/osprey-quality-audit-qa446v` for the full list — every fix
above is traceable to a specific commit with a "why" explanation.

### What was investigated and found to be non-issues
Several branch commits targeted code that had since been refactored or independently fixed more robustly on
`main` — these were deliberately **not** re-applied:
- A stale `totalSteps=4` onboarding fix that would have overshot progress now that a 6th onboarding screen
  exists (main's actual fix, `hasBaselineStep()`/`onboardingTotalSteps()`, is more correct).
- A duplicate `updateLiftSet` Zustand action — `lift.tsx` already solves the same bug via `updateSetFields`.
- A `fuel.ts` protein-ceiling narrowing that targeted a since-refactored function and would have incorrectly
  narrowed triathlon's ceiling (sport blueprints genuinely disagree on the right value per sport).
- The paywall "/mo" mislabel and RevenueCat fail-open-vs-closed bugs several branches flagged — both are
  already fixed on `main` (verified via the code's own comments documenting the fix).
- The friend/race-partner IDOR and challenge-roster leak — already closed by
  `20260713000001_fix_social_rpc_idor_and_consent.sql`, confirmed live in production.

---

## Per-branch disposition

| Branch | Real bug-fix content | Disposition |
|---|---|---|
| `eager-gauss-0v6h9u` | `.env.test` stub for vitest | **Harvested** (webapp .env.test). Safe to delete. |
| `eager-gauss-37w1s2` | Feature-status tracker doc | **Harvested** (`docs/audit-feature-status.md`). Safe to delete. |
| `eager-gauss-e9gkkr` | Peak-phase volume inversion, entitlement leak, onboarding step count | **Harvested**, and improved on (shared `hasBaselineStep()` helper closes a gap the original fix had). Safe to delete. |
| `eager-gauss-n5d3r8` | 15-bug fix commit across mobile/webapp/edge functions | **Harvested** (individually verified, not blindly merged — several pieces were stale or superseded and skipped). Safe to delete. |
| `eager-gauss-torngm` | Hyrox onboarding data loss, plan-editing UX, cross-sport zone bugs | **Harvested**. Safe to delete. |
| `great-pascal-52gd08` | Friend-RPC IDOR (already superseded), coach_memory writes, migration replay, paywall, HealthKit data loss, PR/reset-link bugs | **Harvested** (coach_memory, migration replay, HealthKit, PR detection). Paywall already fixed independently. Safe to delete. |
| `great-pascal-7bp9g6` | Friend IDOR (superseded), sub-cache leak, paywall, hide-Google, cue a11y, dismiss touch target | **Harvested** (hide-Google, cue banners + a11y). Sub-cache leak already fixed independently (authStore identity-change guard). Safe to delete. |
| `great-pascal-bdwpoj` | Social IDOR (superseded), activity-feed RPC, coach_memory upsert, race-search "Half Marathon", onboarding back-nav | **Harvested** (coach_memory, race-search filter). Safe to delete. |
| `great-pascal-i40rhu` | Multi-session crash, UTC "today", Start-Session routing, endurance persistence, PR tie-break, debounced search, paywall, onboarding progress | **Harvested** (PR tie-break, debounced search). Most others already independently fixed on main across earlier waves. Safe to delete. |
| `great-pascal-rgi4i4` | nutrition-coach timezone, paywall, stale post-workout caches, ATL/CTL formula alignment, `load_scores` writer | **Harvested** (stale caches, ATL/CTL alignment, `load_scores` writer). Safe to delete. |
| `quirky-volta-4qskjf` | RLS recursion (superseded), Buffer TTS crash, fail-closed subs (superseded), timezone, food-density, PR detection, swim/bike routing | **Harvested** (Buffer crash, food-density, PR detection). Safe to delete. |
| `quirky-volta-l97mrv` | Challenge-members RLS (superseded), activity-feed RPC, `src/utils/date.ts` helper | `src/utils/date.ts` already exists on main (`localDateString()`/`parseLocalDate()`) — the branch's own claim that it's missing was stale. Nothing left to harvest. Safe to delete. |
| `quirky-volta-wn6bek` | Activity-feed fix, ozzie-audio bugs, performance.ts, race-partners | **Harvested** (ozzie-audio Buffer/cache-key/race fixes, performance.ts fixes). Safe to delete. |

**Status**: all 13 branches above are confirmed fully superseded. Deletion (`git push origin --delete
claude/<branch>`) was blocked by this session's permission classifier as a destructive action — run it
manually, or grant the Bash permission, when ready.

## Branches NOT to delete

| Branch | Why |
|---|---|
| `claude/osprey-quality-audit-qa446v` | This session's own active branch. |
| `claude/quirky-volta-ruhdld` | Apple Watch bridge (`modules/watch-connectivity/`) + full periodization onboarding — unshipped feature work, product call. |
| `claude/quirky-volta-djz47h` | Ozzie Live two-way voice coaching + Life Load fused readiness score — unshipped feature work, product call. |
| `claude/quirky-volta-9lpdro` | Fuel Plan/meal-prep + grocery list, live squad race tracking, spoken morning check-ins — unshipped feature work, product call. |
| `claude/quirky-volta-y77uxz` | Return-to-training ramp, verified effort, physique coaching — unshipped feature work, product call. |
| `feat/reanimated-screen-animations` | Flagged for the user — conflicts with a since-reskinned `DailySummary`, needs reconciliation before merge. |
| `worktree-tsb-engine-advisor-plans` | Flagged for the user — docs-only (TSB/training-load engine advisor plans), harvest first if keeping. |
| `main` | — |
