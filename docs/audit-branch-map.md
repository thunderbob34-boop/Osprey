# Audit Branch Map & Reconciliation

> Companion to [MASTER-PLAN.md](MASTER-PLAN.md) Section 2. Created 2026-07-13.
> Maps every `origin/claude/*` audit branch to what it fixes/adds and its status vs `main`.

## TL;DR — the real story

The audits did **not** rot on the vine, and `main` is **not** unmerged-branch soup. What actually happened:

1. **Every one of the 12 `claude/*` branches is unmerged** (none is an ancestor of `main`). Confirmed.
2. But `main` received the important fixes as **hand-ported, re-authored commits** — not by merging the branches.
   The branches were parallel throwaway explorations cut from older `main` snapshots.
3. This is why each nightly audit "re-found" the same bugs: each branch was cut from a main that *predated*
   the hand-port. The bug was live *on that snapshot*, but may already be fixed on today's `main`.

**Therefore the branches are mostly obsolete for bug-fixes.** Their real residual value is the **unmerged
feature work** several of them contain (built on spec, never productized) — see the harvest list below.

### What's already fixed on `main` (verified) — branches are redundant here
- ✅ **IDOR / friend-request consent / challenge-roster leak / open OpenAI proxy** — closed by
  `20260713000001_fix_social_rpc_idor_and_consent.sql` (354 lines, commit `8f8dfe4`) + edge-function auth gates.
  This **supersedes every `...33` IDOR migration** across all branches.
- ✅ **Test suite (72 tests) + Sentry + encrypted session storage** — landed via `3d1cb48` (hand-ported from ruhdld).
- ✅ **Real friend system + add-friend UI** — on main (`48933f5`, `1ddaa1a`, `a5387c8`).

### What's still OPEN on `main` (verified) — never ported from the branches
- ❌ **Paywall labels the annual price as "/mo"** — `OSPREY-app/app/paywall.tsx:195` (App Store risk).
- ❌ **"Start Session" mis-routes** swim/bike/rowing/hyrox to the GPS run screen — `app/(tabs)/index.tsx:52-55`.
- ❌ **UTC-vs-local "today"** — `src/services/daily-summary.ts:13` uses `toISOString()`; **no `src/utils/date.ts`
  helper exists on main** (the branches added one; never ported). The whole timezone class is unaddressed at the util level.
- ❌ Remaining 07-12 correctness/UX items (voice-log drops weight, endurance track persistence, GPS watcher leak,
  onboarding progress bar, etc.) — verify individually, but the pattern holds: **security landed, UX/correctness didn't.**

### Migration collisions — already resolved on main
Main renumbered cleanly: `…032` → `20260712000033_exercise_sets_write_grants` → `…034_users_location_zip`
→ `20260713000001_fix_social_rpc_idor_and_consent` → `20260713000002_recipes…`. The branches' three different
`…33` files (`fix_friend_rpc_idor`, `fix_social_rpc_idor`, `fix_social_idor_and_consent`) are **all superseded**.
Do not merge them.

---

## Merge topology

None merged. The 12 branches fan out from **4 `main` snapshots**:

| Snapshot (on main) | Date | Branches cut from it |
|---|---|---|
| `a824d67e3` | 07-02 | quirky-volta-9lpdro, -djz47h, -l97mrv, -wn6bek, -y77uxz (5 — parallel audits) |
| `d22d49180` | 07-05 | quirky-volta-4qskjf, -ruhdld (2) |
| `9afbd5589` | 07-08 | great-pascal-52gd08, -7bp9g6, -bdwpoj, -rgi4i4 (4 — parallel audits) |
| `c13359b46` | 07-12 | great-pascal-i40rhu (1 — latest) |

Multiple branches per snapshot = **parallel independent audit attempts** of the same code, not a sequence.

---

## Per-branch map

Legend — **Fixes**: bug work (mostly superseded/ported). **Features**: net-new unmerged functionality (harvest candidates).

### Snapshot 07-08 (`9afbd5589`) — the 4 "great-pascal" parallel audits

| Branch | Audit | Fixes (what it targets) | Status vs main |
|---|---|---|---|
| **great-pascal-i40rhu** | 07-12 (latest, biggest — 25 fixes) | Multi-session Home crash, UTC "today", calendar stray day, voice-log drops weight, GPS watcher leak, **Start-Session mis-routing**, endurance track persistence, race-plan profile, PR tie-break, debounced-search races; migration `…33_fix_social_idor_and_consent`; edge-fn error-text leak; **paywall /mo**, onboarding progress, units, contrast, touch targets | Security → **superseded** by main `20260713000001`. UX/correctness → **still OPEN** (verified: paywall, start-session, UTC). **This branch is the best fix reference.** |
| **great-pascal-52gd08** | 07-10 | Friend-RPC IDOR, coach_memory indexes, migration replay, paywall, HealthKit data loss, PR/reset-link; migrations `…33/34/35` | IDOR → **superseded**. HealthKit/paywall → verify (likely open). |
| **great-pascal-bdwpoj** | 07-08 | Social IDOR, activity-feed RPC, coach_memory upsert, race-search "Half Marathon", `sanitizeDays` enum guard, onboarding back-nav; migrations `…33/34/35` | IDOR/activity-feed → **superseded**. sanitizeDays/race-search → verify. |
| **great-pascal-7bp9g6** | 07-09 | Friend IDOR + self-accept, sub-cache leak across accounts, paywall /mo, hide Google sign-in, cue a11y live-region, dismiss touch target; migration `…33` | IDOR/consent → **superseded**. sub-cache/Google-hide/a11y → verify. |
| **great-pascal-rgi4i4** | 07-11 | nutrition-coach timezone, paywall, stale post-workout caches, ATL/CTL formula alignment, `load_scores` writer, Ask-Ozzie relabel | Ask-Ozzie relabel → **on main**. Timezone/caches/ATL-CTL → verify (likely open). |

### Snapshot 07-05 (`d22d49180`)

| Branch | Audit | Contents | Status vs main |
|---|---|---|---|
| **quirky-volta-ruhdld** | 07-06 (12 commits — the big implementation session) | **Fixes:** RLS, migrations, coach_memory, fail-closed subs. **Infra:** test suite + `jest.config.js`, `ActionSheetModal`. **Features:** full 4-input onboarding (`constraints.tsx`, `event.tsx`) + multi-week periodization, closed-loop coach memory (`coach-log.tsx`), **Apple Watch bridge** (`modules/watch-connectivity/` Swift+podspec) | Test suite/Sentry/session → **landed on main** (`3d1cb48`). **Watch bridge + full periodization onboarding → NOT on main = prime harvest candidates.** |
| **quirky-volta-4qskjf** | 07-07 (7 commits) | RLS infinite-recursion, IDOR, coach_memory, **Buffer TTS crash**, fail-closed subs, timezone, food-density, PR detection, **route swim/bike→endurance**, auth-gate edge fns; migration `…027` | Security → **superseded**. Buffer-fix/routing/timezone → verify (routing confirmed still open). |

### Snapshot 07-02 (`a824d67e3`) — the 5 "quirky-volta" parallel audits + speculative features

| Branch | Contents | Status vs main |
|---|---|---|
| **quirky-volta-9lpdro** (8) | Audit fixes + **Features:** Fuel Plan / macro-matched meal-prep + grocery list (`meal-prep.tsx`), **Live squad race tracking** (`live-race.tsx`), spoken morning check-ins, "Recalibrate" real mid-week adaptive rebuild, anticipation layer (`OzzieAheadCard`) | Fixes → superseded/verify. **Features → NOT on main = harvest candidates.** |
| **quirky-volta-djz47h** (5) | Audit fixes + **Features:** Crew Challenges (friend requests + AI-narrated activity), **Ozzie Live two-way voice coaching**, **Life Load** fused readiness score (`LifeLoadCard`); migrations 016–021 | Friend system → landed on main (re-authored). **Ozzie Live / Life Load → NOT on main = harvest candidates.** |
| **quirky-volta-y77uxz** (3) | Security RLS + **Features:** return-to-training ramp (`return-to-training.tsx`, `RampBanner`), verified effort, physique coaching (`physique.tsx`) | Security → superseded. **Features → NOT on main = harvest candidates.** |
| **quirky-volta-l97mrv** (2) | Fixes only: challenge-members RLS, activity-feed RPC, adds `src/utils/date.ts` timezone helper | Superseded, **except `src/utils/date.ts` is worth harvesting** (main still has no local-day helper). |
| **quirky-volta-wn6bek** (2) | Fixes only: activity-feed fix, ozzie-audio, performance, racePartners | Superseded/verify. |

---

## Recommended action

1. **Do NOT merge any `claude/*` branch.** Their bug-fixes are either already on main (security, infra) or need
   re-doing against current main (UX/correctness) — merging would resurrect obsolete migrations and conflicts.
2. **Fix the confirmed-open UX/correctness bugs directly on main** (MASTER-PLAN §3B), using **great-pascal-i40rhu**
   as the reference diff for the 07-12 set. Start with: paywall "/mo", Start-Session routing, and a real
   `src/utils/date.ts` local-day helper (fixes the whole timezone class at once).
3. **Harvest decision (product call):** review the unmerged *features* before deleting branches —
   Apple Watch bridge + periodization onboarding (ruhdld), Ozzie Live two-way voice + Life Load (djz47h),
   Fuel Plan/meal-prep + Live race tracking (9lpdro), return-to-training + physique (y77uxz). None are on main.
4. **Then delete all `claude/*` remote branches** to end the confusion. `git push origin --delete <branch>` ×12.

## Verification status
- **Verified by inspection of main:** all 12 unmerged; IDOR/consent superseded by `20260713000001`; tests/Sentry
  on main; paywall "/mo", Start-Session routing, daily-summary UTC, and missing `src/utils/date.ts` all still open.
- **Inferred from commit messages + audit reports (not line-verified):** the per-branch fix contents and the
  "verify" items above. Confirm each against current main before acting.
