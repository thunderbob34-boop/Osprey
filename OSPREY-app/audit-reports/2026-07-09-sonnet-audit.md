# OSPREY Comprehensive Audit — 2026-07-09

Branch: `claude/great-pascal-7bp9g6` (off `main` @ `9afbd55`)
Run: fully autonomous, no human present. Analysis phases ran on Opus, execution on Sonnet, per task spec.

## Context brief

This is a follow-up to the 2026-07-02 audit (`2026-07-02-fable-audit.md`), which fixed a GPS distance-undercounting bug, added ESLint config, onboarding/SignIn accessibility, and a few smaller items. Since then, 7 commits landed: friend search by phone, a Friends screen UI polish pass, a TRUNCATE-grant revocation migration, Apple Sign-In enabled, RevenueCat confirmed fully wired, Ozzie voice disabled (ElevenLabs still on free plan, no commercial license), and an expo-sqlite web-bundle crash fix. This run gave the newly-shipped friends/social feature and the voice-disable change the most scrutiny, plus a general sweep.

**Baseline before any fixes:** `npm run typecheck` — 0 errors. `npm run lint` — 0 errors. `npm run test` — 72/72 passing (6 suites). All three gates were already clean going in — a real jest suite now exists (it didn't at the last audit).

## Method

Three parallel Opus agents did read-only analysis: code quality (bugs/logic errors), UX (usability/accessibility/clarity), and feature testing (end-to-end code-trace of every major flow against its data contracts). Findings were cross-checked against the actual source before any fix. Sonnet executed the fixes. A fourth Opus agent adversarially re-verified every fix against the diff and re-ran all three gates independently; it surfaced two real gaps in the first pass, which were then fixed and re-verified.

## Findings

### Code quality (Opus)
1. **HIGH — IDOR in friend RPCs.** `get_my_friends`, `get_pending_friend_requests`, `get_friends_at_race` (all `SECURITY DEFINER`) filtered on a client-supplied `p_user_id` instead of `auth.uid()`. Any authenticated user could pass an arbitrary user id and read that person's friend list, incoming friend requests, or race schedule (including race location/date — a physical-safety-relevant leak).
2. **HIGH — `friendships` accept bypassed consent.** The `friendships_update` RLS policy let the *requester* flip their own outgoing request to `accepted`, making two people "friends" with zero action from the addressee.
3. **MEDIUM — Subscription entitlement cache leaked across accounts.** `useSubscription`'s module-level cache was never reset on sign-out and could get stuck on a fail-open `true` (RevenueCat's intentional not-yet-configured fallback) if checked before init completed — either way, a value cached once persisted for the rest of the session/across accounts.
4. **LOW/MEDIUM — `get_race_partners` had no authorization check at all** (any authenticated user + any race UUID → partner list).
5. **LOW — Endurance auto-cue fired ~1s into a session** instead of at the intended 10-minute mark (ref initialized to epoch 0).
6. **LOW — Reciprocal friend requests** could produce duplicate `accepted` rows / duplicate list entries.

### UX audit (Opus)
1. **MEDIUM — Cue banners had no screen-reader live region.** With Ozzie voice disabled, the on-screen banner is the *only* coaching-feedback channel, and it auto-dismisses after 4.5s with nothing to announce it to VoiceOver/TalkBack.
2. **MEDIUM — Endurance interval-step coaching text silently dropped** when voice is off (sent only to the now-no-op `ozzieSpeak`, never to the banner).
3. **LOW/MEDIUM — "End workout?" alert copy didn't mention the destructive option discards the run**, while the visually-prominent red button did discard it.
4. **LOW — Workout-tab Lift card promised "Ozzie encouragement"** with zero delivery mechanism on that screen (voice off, no banner fallback).
5. **LOW — Sub-AA text contrast** on the smallest muted-text uses (9-10px `textMuted`); **LOW — dismiss button below 44px touch target** with no `hitSlop`; **LOW — no save confirmation** on the Friends phone-number field. (Not fixed this round — see Deferred.)

### Feature testing (Opus, end-to-end code trace)
Flows traced clean end-to-end: onboarding→plan pipeline, run/lift/endurance→training-load, nutrition (barcode/photo/coach), friends/phone search, the voice-disable change (no dangling callers, voice-log correctly unaffected), Apple Sign-In, RevenueCat purchase/restore.

Issues found:
1. **HIGH — Paywall mislabeled the pre-selected Annual price as "/mo".** `Start for $59.99/mo` was shown for a $59.99/**year** plan — a materially misleading price, and an App Store guideline 3.1.2 risk.
2. **MEDIUM — Live "Continue with Google" button always errored** (provider confirmed Disabled server-side per `docs/TODO.md`, deliberately deferred pending Google Cloud billing).
3. **MEDIUM — Advertised "pace alerts" mid-run feature was dead code** (`checkCues` is called with a hardcoded `null` goal pace — no code path ever supplies one), yet the paywall sold it as a paid feature.
4. **MEDIUM/LOW — Generated plans don't yet use the documented threshold-zone math** (`src/services/calculators/`) — `ozzie-generate-plan` has GPT-4o-mini guess paces instead of computing them. Design/spec gap, not a crash — flagged, not fixed (see Deferred).
5. **LOW — Nutrition tip can go stale within a day** (cached on first call, not re-evaluated against later same-day logging).

## Fixes implemented (10 commits' worth of changes, 8 files + 1 new migration)

1. **Security — friend RPC IDOR + accept-consent bypass.** New migration `supabase/migrations/20260711000033_fix_friend_rpc_idor.sql`: rebinds `get_my_friends`/`get_pending_friend_requests`/`get_friends_at_race` to `auth.uid()`, adds an ownership check to `get_race_partners`, restricts `friendships_update` so only the addressee can accept, and tightens `friendships_insert` to block a duplicate reciprocal *pending* request (status-scoped, so it can't over-block after a decline).
2. **Security — subscription cache leak.** `src/hooks/useSubscription.ts` always re-verifies on mount instead of trusting a stale cache; `src/store/authStore.ts` resets the cache on sign-out.
3. **App Store compliance — paywall price mislabel.** `app/paywall.tsx` adds a `packagePeriodSuffix()` keyed to the RevenueCat package type (`/yr`, `/mo`, `/wk`, etc.) instead of a hardcoded `/mo`; also removed the dead "pace alerts" claim from the feature list.
4. **Correctness — dead Google sign-in button.** `src/screens/SignIn.tsx` hides "Continue with Google" behind a `GOOGLE_SIGNIN_ENABLED` flag until the provider is actually enabled server-side; divider row only renders when a social option is actually visible.
5. **Correctness — endurance auto-cue timing.** `app/workout/endurance.tsx`: gate now requires 10 real minutes elapsed, not just a non-zero ref delta.
6. **Correctness — dropped coaching text with voice off.** Interval-step cues now route through the on-screen banner (matching the existing auto-cue pattern) in both `app/workout/endurance.tsx` and `app/workout/run.tsx` (3 call sites: first step, step transition, intervals-complete).
7. **Accessibility — cue/paused banners now `accessibilityLiveRegion="polite"`** in `run.tsx` and `endurance.tsx` so VoiceOver/TalkBack users get the same coaching feedback sighted users do. (Left the Lift rest-timer countdown alone — it re-renders every second, so a live region there would spam announcements instead of helping.)
8. **Clarity — "End workout?" copy** in `run.tsx`/`endurance.tsx` now says saving *or discarding* is on the table, matching `lift.tsx`'s existing correct copy.
9. **Clarity — Lift card copy** in `app/(tabs)/workout.tsx` no longer promises undeliverable "Ozzie encouragement"; swapped for "PR tracking," which the screen actually does.
10. **Accessibility — plan-alert dismiss button** gets `hitSlop={12}` (was ~21px touch target, below the 44px minimum).

All fixes were independently re-verified by a fresh Opus pass against the diff (adversarial, not just re-reading the same reasoning). It confirmed all 6 fix areas correct and caught two real gaps in the first pass — a status-unscoped insert check, and the identical interval-cue-drop bug still live in `run.tsx` — both of which are folded into the fix list above, not left open.

## Verification results

| | Before | After |
|---|---|---|
| `npm run typecheck` | 0 errors | 0 errors |
| `npm run lint` (`src/`) | 0 errors | 0 errors |
| `npm run test` | 72/72 passing | 72/72 passing |

No fix introduced a new error; two pre-existing-pattern `react-hooks/exhaustive-deps` warnings were added in `app/` (outside the linted `src/` tree) for the new `showCueBanner` calls — this mirrors an existing, already-tolerated pattern elsewhere in the same files (`showCueBanner` is a stable `useCallback`, safe to omit).

## Deferred (needs human judgment / larger scope)

- **`initRevenueCat` doesn't re-identify RevenueCat's `appUserID` across account switches** (only ever configures once). The cache-leak fix above closes the client-side symptom; the deeper RevenueCat identity-reset gap is a separate, larger change flagged by the verification pass.
- **Plan generation doesn't yet use the documented threshold-zone calculators** — this is Feature Proposal #2 below, not a quick fix.
- **Contrast on 9-10px `textMuted` text, no-toast on Friends phone-number save, Lift/Hyrox screens have zero visual fallback for voice cues** — real but lower-severity UX findings, left for a design-reviewed pass rather than blind text/style changes.
- **Nutrition tip staleness** — best-effort caching behavior, would need a cache-invalidation redesign for marginal benefit.

## Feature recommendations

### 1. Ask Ozzie Live — a real two-way coach grounded in your data
`app/ask-ozzie.tsx` is currently a stub ("Two-way conversations with Ozzie aren't live yet"). Wire it to a new `ozzie-chat` edge function that assembles the athlete's actual training load (`services/performance.ts`), current plan, and the relevant `docs/coaching/*.md` blueprint as grounding — so answers like "why is my long run on Sunday?" are anchored to real numbers and real methodology, not generic LLM advice. No competitor pairs a conversational coach with both your own training data and a documented periodization philosophy.
- **Scope:** chat UI in `ask-ozzie.tsx`, new `supabase/functions/ozzie-chat/`, reuse the system-prompt voice already established in `ozzie-daily-brief`, gate behind OSPREY+.
- **Effort:** medium, ~3-4 weeks.
- **Integration points:** `app/ask-ozzie.tsx`, `services/performance.ts`, `coach_memory` table, `docs/coaching/`, `services/subscriptions.ts`.
- **Risk:** token cost/latency of context assembly — needs retrieval of the one relevant sport file, not the whole `docs/coaching/` tree, plus rate-limiting.

### 2. Your Zones — verifiable, re-testable threshold zones that actually drive workouts
`src/services/calculators/` already computes real Daniels T-pace / swim CSS / bike FTP zones per the blueprints, but `ozzie-generate-plan` has GPT-4o-mini *guess* paces instead of calling them. Capture a threshold anchor at onboarding (or from a recent effort), persist computed zones, and thread them into interval prescriptions — plus a 4-6 week re-test nudge per the blueprint's own cadence. This delivers on OSPREY's actual "four answers → personalized plan" promise, which today it doesn't fully keep.
- **Scope:** onboarding capture, an `athlete_zones` table (or extend `user_goals`), pass concrete paces into `ozzie-generate-plan`'s interval prescriptions, a "Your Zones" card on plan preview/Stats.
- **Effort:** medium, ~3 weeks — calculators already exist and are tested.
- **Integration points:** `src/services/calculators/*`, `supabase/functions/ozzie-generate-plan/index.ts`, `app/plan-preview.tsx`, `user_goals`.
- **Risk:** beginners often don't know their threshold — needs a credible cold-start estimate and a graceful "zone unknown yet" plan-generation path.

### 3. Race Crew — shared coaching for friends training toward the same race
The plumbing already exists (`race_partners` table, `get_friends_at_race`/`get_race_partners` RPCs — now IDOR-fixed in this run — plus per-athlete `ozzie-race-briefing`/`ozzie-race-retro`). Bundle crewmates into a shared countdown, a multi-athlete Ozzie briefing, and a joint post-race retro. Strava has clubs with no coaching; TrainingPeaks is single-athlete only — nobody ties an AI coach to a *shared* race goal.
- **Scope:** crew surface on `race-event.tsx` using `fetchFriendsAtRace`, a multi-athlete variant of `ozzie-race-briefing`, an optional shared `challenges.ts` mileage challenge scoped to the build block, an aggregated group retro. Defer live race-day tracking past v1.
- **Effort:** large, ~5-6 weeks — new group data model + RLS, shared-thread UI, multi-athlete prompt variants.
- **Integration points:** `services/racePartners.ts`, `race_partners` table, `ozzie-race-briefing`/`ozzie-race-retro`, `services/challenges.ts`, `app/race-event.tsx`.
- **Risk:** privacy (goal times/location need explicit opt-in + careful RLS, following the pattern just fixed in this audit); cold-start depends on an existing friend graph.
