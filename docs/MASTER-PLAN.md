# OSPREY — Master Plan

> **Single source of truth.** Created 2026-07-13. Opens with the **Vision** (where we're going and why),
> then the **execution path** (what's done, what's open, how we get there).
> This document **supersedes** `docs/TODO.md`, `docs/archive/*`, and the 8 dated audit reports in
> `OSPREY-app/audit-reports/`. Those files are retained as historical record only — do not track work in them.

---

# PART I — VISION & NORTH STAR

**OSPREY is the expert coach in your pocket — real sport science, every endurance and strength sport, one app.**

Not a chatbot with a workout skin. The product is a genuine coaching engine — periodization, training zones,
fueling, taper — the kind of thinking a $200/mo human coach does. Ozzie is the *voice* that delivers it; the
engine is the *substance*. If we ever can't tell whether a plan came from our sport science or from an LLM
guessing, we've lost the thread.

**And it's all-in-one.** Training, nutrition, racing, and the social layer live together across nine sports.
The differentiator is depth *and* breadth: expert coaching that also happens to cover your lifting, your Hyrox,
your marathon, and your fuel — without four different apps.

## Who it's for

Every endurance + strength athlete, **met where they are and grown from there.** The same engine hand-holds a
beginner to their first finish line and feeds CTL/TSB/ACWR to a data optimizer. Our wedge — where we're most
clearly better than anyone else — is the **committed, event-driven, hybrid athlete** the market underserves:
Runna is run-only, TrainerRoad is bike, Strava tracks but doesn't coach. We win them deeply first.

## The three surfaces, one coach

- **Mobile app** (`OSPREY-app/`) — **the product.** Where coaching happens every day: the plan, the workout, the log, the brief.
- **Web app** (`webapp/`) — **the analyst surface.** Deep dashboards, trends, and plan-editing a phone screen can't do well. Complements the phone; never a worse copy of it.
- **Website** (`website/`) — **the front door.** Earns trust in the expert-coach promise and converts visitors into athletes. Every page should feel like it was made by people who actually understand training.

## Where we're going

A **sustainable indie product** — profitable, focused, athlete-first. Success is measured in **happy athletes
and healthy MRR**, not downloads or a funding round. That choice is a compass: we win a niche deeply before
going broad, we say no to features that don't serve *our* athlete, and we keep the surface area small enough
for a tiny team to keep excellent.

- **Now:** ship the app (it's built — the blockers are logistics), and make the engine truly coach (wire the sport-science calculators; real periodization).
- **Next:** close the loop — the coach that watches your load and adapts (proactive de-load), the analyst web surface, the harvest-worthy features already built on spec.
- **Someday:** the definitive home for the hybrid athlete, earning its keep one renewed subscription at a time.

## Principles that keep us honest

1. **The engine must actually coach.** No faking depth with a clever prompt.
2. **Meet the athlete where they are** — scale from first-timer to optimizer without dumbing down or overwhelming.
3. **Every surface has one job** — don't make the web a worse phone, or the phone a worse spreadsheet.
4. **Indie discipline** — say no. A smaller, excellent product beats a bloated one.
5. **Earn the trust** — we're asking athletes to swap a human coach for us. Get the coaching right first, everything else second.

---

# PART II — WHAT OSPREY DOES (Core Feature Pillars)

> The go-to hub for an athlete's whole training life, and a scheduling assistant that actually knows them. Six pillars.

### 1. Train — the coaching core
- **Track every workout** — runs, lifts, and all nine sports, with the recap that ties back to plan intent.
- **Build a plan for any event, any distance out** — and in a *style the athlete's comfortable with*, so it feels like their training, not a stranger's.
- **Off-season doesn't mean off** — when there's no event on the calendar, keep them on a healthy, maintainable lifestyle plan so fitness never falls off a cliff.

### 2. Race — the event layer
- **Find events and where to sign up**, with deep intel past date/time/location: **elevation profiles rendered like a Garmin/Coros post-run chart**, the **course map**, and a **projected finish time** for *this* athlete — with more to come.
- **Find tune-up events that fit the plan** — races that match a training block so the work is more fun and race-sharp, not just miles.

### 3. Fuel — nutrition & hydration
- **A nutrition + hydration plan matched to the whole athlete** — emotional, mental, and physical: macros, the *timing* of macros and hydration across the day, and their supplements.
- **Meal planning to Ozzie's macros and the athlete's budget**, producing an **exportable grocery list**.
- **Intra-day fuel timing** — snacks, how much water, and when, mapped through the day.

### 4. Schedule — the assistant that knows your life
- **Connects to work, hobby, and personal calendars**, and feeds that into every scheduling decision.
- **Learns the best times to train** — both from the athlete's schedule *and* from their data (which days and hours they actually perform best).
- **Weather-adaptive** — shifts a session's time to dodge heat, cold, or rain, and **suggests a better place** when needed (gym treadmill, indoor track, a shaded trail).
- **Proactive heat prep** — if a hot day is coming, nudge **2 days early** to start hydrating, walk through electrolytes, and set a pre-hydration alarm.

### 5. Explore — routes & places
- **Maps running routes, especially when traveling**, surfacing the *good* ones first — greenways, cool paths, known running routes.
- **Finds the right nearby gym** for that athlete's workouts — which days it's open and what a **day/week pass costs**.

### 6. Together — the social layer
- **Share, follow, and challenge friends** — compare efforts, and **invite each other to workouts, races, and events.**

> **Reality check (keep us honest):** Pillars 1, and much of 3 & 6, ship today. **Tune-up event matching (2) is
> already live in the webapp.** **Meal-planning-to-budget + grocery export (3) and live/social race features were
> built on unmerged branches** — harvest candidates, not from-scratch (see [audit-branch-map.md](audit-branch-map.md)).
> The genuinely new frontier is: **deep event intel** (elevation/map/projected finish), **calendar integration +
> learned best-training-times** (4), the **traveling route-mapper + gym finder** (5), and the **2-days-out heat protocol** (4).

---

# PART III — EXECUTION PATH

## Orientation

**Coaching logic is authoritative in `docs/coaching/`.** Before changing any plan-generation, training-zone,
fueling, or taper logic, read `docs/coaching/_index.md` first, then the specific sport file. The "Expert Coach"
engine turns four onboarding answers into a personalized, periodized plan — this is the substance behind Part I.

### Three surfaces

| Surface | Path | Stack | State |
|---|---|---|---|
| **Mobile app** | `OSPREY-app/` | React Native / Expo (SDK 52, RN 0.76) | Feature-complete, **pre-TestFlight** |
| **Web app** | `webapp/` | Vite + React + TanStack + supabase-js | Phase 1 + 2 shipped; localhost + Cloudflare deploy |
| **Marketing site** | `website/` | Astro | Merged to `main`, **launch HELD** (Pages disabled) |

Shared backend: Supabase (Postgres + RLS + edge functions).

---

## SECTION 1 — OLD: the milestone that is DONE ✅

This is the "old" side of old → new. All of the following is built and merged to `main`.

### Mobile app (`OSPREY-app/`)
- Full app shipped Jul 2–3: Home, Workout (run/lift/endurance/hyrox), Log (food/hydration/weight), Stats, Settings, onboarding.
- Coaching engine: 9-sport onboarding, plan generation, daily brief, race hub, challenges, friend system (with live add-friend UI).
- Infra that genuinely landed: **Jest + 72 passing tests**, ESLint baseline (0 errors), **Sentry wired** (behind DSN), `expo-secure-store` session storage (`secure-session-storage.ts`).
- Backend live: all migrations through `032` applied; 8 edge functions `ACTIVE`; RLS on 31/33 tables; secrets set (OpenAI, ElevenLabs, Resend).
- Monetization configured: real ASC products (`osprey_plus_month` $5.99/mo, `osprey_plus_annual` $59.99/yr), entitlement `osprey_plus`, RevenueCat key wired.
- Ozzie voice **intentionally disabled** for launch (`OZZIE_VOICE_ENABLED = false`) — ElevenLabs free-plan licensing.

### Web app (`webapp/`) — all four plans merged
- **Website (marketing)** — Astro site: homepage, pricing, blog, privacy/terms, hero + athlete stock video. `.github/workflows/deploy-website.yml` present.
- **Phase 1 (Foundation + Workout Desk)** — login gate, training calendar, keyboard-first sets-grid logging, history, settings/units. Vitest-tested.
- **Tune-Up Races** — client-side race-candidate detection on `/calendar`, RunSignup deep links, `users.location_zip` migration, add-race form. **Built, live-verified, in `main` (NOT pending).**
- **Phase 2 (Nutrition / Fuel Desk)** — `/nutrition` food logging + macro band + Ozzie tip, recipes builder with per-serving math. New `user_recipes` tables. Merged via PR #4.

---

## SECTION 2 — the audit branches (RESOLVED — see full map)

> **Investigated 2026-07-13 → [audit-branch-map.md](audit-branch-map.md).** The original worry
> ("fix-branches never merged, bugs re-appearing") turned out to be half-true, and the good half matters.

**What's actually true:** all 12 `claude/*` branches are unmerged — but `main` got the important fixes as
**hand-ported, re-authored commits**, not by merging the branches. Each nightly audit re-found the same bugs
because each branch was cut from an *older* `main` snapshot that predated the hand-port.

**Verified against current `main`:**
- ✅ **Security is fixed** — IDOR / friend-consent / roster-leak / open OpenAI proxy closed by
  `20260713000001_fix_social_rpc_idor_and_consent.sql` (`8f8dfe4`). **Supersedes every branch's `...33` migration.**
- ✅ **Tests (72) + Sentry + encrypted session** landed via `3d1cb48`. Migrations renumbered cleanly (no collision).
- ❌ **UX/correctness fixes were NOT ported** — paywall "/mo", Start-Session mis-routing, UTC "today"
  (no `src/utils/date.ts` helper on main) are all still live. Security landed; the rest didn't.

### Task 2.1 — What to do (revised)
1. **Do NOT merge any `claude/*` branch** — their fixes are obsolete or need re-doing; merging resurrects dead migrations.
2. **Fix the confirmed-open UX/correctness bugs directly on `main`** (§3B), using branch `great-pascal-i40rhu`
   (the 07-12 audit) as the reference diff. Harvest `src/utils/date.ts` from `quirky-volta-l97mrv` to kill the timezone class.
3. **Product decision — harvest unmerged FEATURES** before deleting branches. Several branches built net-new
   features on spec that never reached main: Apple Watch bridge + periodization onboarding (`ruhdld`),
   Ozzie Live two-way voice + Life Load readiness (`djz47h`), Fuel Plan/meal-prep + Live race tracking (`9lpdro`),
   return-to-training + physique coaching (`y77uxz`). See the map for the full list.
4. **Then delete all 12 `claude/*` remote branches** to end the confusion.

The full branch-by-branch table, verification status, and harvest list live in [audit-branch-map.md](audit-branch-map.md).

---

## SECTION 3 — OPEN WORK (the "new" side, prioritized)

### 3A. 🔴 Launch blockers (mobile app → TestFlight)

- [ ] **Buy a real domain.** `osprey.app` is NOT owned (nameservers = `dan.com` parking). Root blocker — cascades to:
  Supabase Auth Site URL, Apple Sign In Services ID + return URL, Resend sending domain, privacy/support URLs,
  and `src/constants/links.ts`. **Do this first.**
- [ ] **Fresh native build** — `npx expo prebuild --clean` + EAS dev-client build. Native modules
  (calendar, sqlite, health, maps, purchases) don't run in Expo Go. **Use Node 20** (Node 22+ breaks Expo SDK 52).
- [ ] **Verify SecureStore session migration on a real device** — confirm existing logins survive app update + relaunch.
- [ ] **Activate Sentry** — create RN project, set `EXPO_PUBLIC_SENTRY_DSN` in `.env.local` + EAS prod env. (Code already wired.)
- [ ] **Verify OpenAI billing/credits enabled** (key without billing 429s every call).
- [ ] **Verify Resend sending domain** (blocked on domain) — else data-export email only reaches the account owner.
- [ ] **App Store Connect:** register app (`com.SillyGoose.OSPREY`), enable HealthKit capability, screenshots (6.7/6.5/5.5"),
  fill metadata from `metadata/`, live privacy + support URLs, App Privacy declaration, change owner name
  from "Augustas Johnson", add subscription metadata, confirm version 1.0.0 / build 1.
- [ ] **Production build → submit → TestFlight** — `eas build ... --profile production` → `eas submit`.
- [ ] **TestFlight QA matrix** — purchase + Restore Purchases (sandbox, 2 devices) + full flow QA
  (onboarding→plan, GPS run, lift log, food log, weight trend, hydration, briefs, race hub, challenges,
  HealthKit sync, calendar blocking, offline, units toggle, Performance Intelligence card regression).

**Time-bomb:** Apple Sign In client-secret JWT **expires 2027-01-07** — regenerate before then (Apple caps at 6 months).

### 3B. 🟠 Confirmed-open bugs (latest 07-12 audit — verify vs `main` per Section 2, then fix)

**Security / data (migration written but NOT run against live DB):**
- [ ] IDOR in 4 social `SECURITY DEFINER` RPCs (trusts client `p_user_id`). *The perennial finding.*
- [ ] Friend-request consent bypass (requester can self-accept).
- [ ] `get_challenge_leaderboard` leaks member roster to non-members.
- [ ] Subscription **fails open** (grants free Plus) off-iOS — needs product decision.
- [x] 8 edge functions leak raw `err.message` / Postgres internals in 500s. **Fixed** `7acdca2` (6 fns → generic message + server log). *Needs `supabase functions deploy`.*

**Correctness / crash:**
- [x] Home crash on multi-session days — `.maybeSingle()` on 2+ rows (`daily-summary.ts`). **Fixed** `fb80acb` (order + limit 1).
- [x] Voice-logging drops set weight → corrupts PR history (`lift.tsx`). **Fixed** `caf6b3c` (`updateSetFields` single-pass).
- [x] Endurance GPS tracks never persisted (`saveEnduranceWorkout`). **Fixed** `caf6b3c` (trackPoints param + `activity_logs` insert).
- [x] "Start Session" mis-routes swim/bike/rowing/cross/hyrox to the GPS run screen (`app/(tabs)/index.tsx`). **Fixed** `fb80acb` (per-sport switch mirroring Workout tab).
- [x] GPS watcher leak on fast unmount. **Fixed** `caf6b3c` (cancellation flag in `useRunTracking`).
- [x] UTC-vs-local "today" — **Fixed** `fb80acb`: added tested `src/utils/date.ts` `localDateString()`, applied in `daily-summary.ts`. `calendar.ts` stray-day leak **Fixed** in follow-up (tested `clampDaysToMonth`).
- [~] `ozzie-generate-plan` idempotency race. **Partially fixed** `79e676f`: the `.maybeSingle()` crash on duplicate weeks is resolved (order+limit). **Open decision:** the TOCTOU race still needs a DB unique constraint + violation recovery — is the invariant *one active plan per user*, or can a user train for two races at once? Decide before adding the constraint.
- [ ] Race-plan branch hardcodes `intermediate`/4-run/1-lift, ignores athlete profile.
- [ ] `toggleKudo` non-atomic race; activity-feed fallback query unscoped; `useSubscription` doesn't propagate refresh.

**UX:**
- [x] Onboarding progress bar never reaches 100% — **Fixed** `caf6b3c` (`totalSteps` 5→4 across the 5 screens).
- [x] Paywall shows annual price as "/mo" — **App Store risk.** **Fixed** `fb80acb`: suffix/label now derived from the package's real billing period. *(Follow-up available: paywall loading/error state.)*
- [ ] Day-picker touch targets <44px; broader units-display sweep (~14 files still hardcode miles/lbs).

### 3C. 🔵 The coaching-engine fidelity gap (biggest architectural item — flagged in 5 audits)

- [ ] **Sport-science calculators (`src/services/calculators/*`) are dead code.** Plan generation is 100% LLM prompt.
  Called "the single biggest gap." Wire the verified calculators (pace zones, carb targets, thresholds) into generation.
- [ ] **No real taper/periodization applied** — `computeRacePhase` is decorative; `ultraTaperWeeklyVolumes` never called.
- [ ] Nutrition targets ignore the bodyweight g/kg model.
- [ ] "Ask Ozzie" is still a read-only stub (over-promised as two-way chat; relabeled but not built).

### 3D. Systemic: timezone handling (a class of bug, not one bug)

New UTC-vs-local "today" bugs keep appearing in different files (`currentWeekStartDate`, `log_hydration`,
`ozzie-nutrition-coach`, `daily-summary`, `calendar`, `computeRacePhase`). **The real fix is a repo-wide
date-handling convention + lint rule**, not another one-off patch.

**Convention established + offenders migrated (2026-07-13).** `src/utils/date.ts` provides `localDateString()`
(local day) and `parseLocalDate()` (local-midnight parse of `YYYY-MM-DD`). Jest is pinned to `TZ=Asia/Kolkata`
(positive offset) so local-day regressions actually fail. Migrated: `plan.ts` (`currentWeekStartDate`,
`computeRacePhase` — TDD), `daily-summary`, `calendar`, `hydration` (read), `races`, `usePlanDeload`,
`weather-context`, `healthkit`, `stats`, and — server-side — `log_hydration` (new migration
`20260713000003`, client now passes its local day) and `ozzie-nutrition-coach` (client passes `clientDate` +
`dayStartUtc`; edge fn falls back to UTC if absent).

**Deliberately left** (internally-consistent, risk > reward): `performance.ts` daily-load series (keys + fill
are symmetric — needs a coordinated change + test update) and `body-metrics.ts` rolling N-day cutoffs (benign).

**⚠️ Deploy steps** (go-live): `supabase db push` the new `log_hydration` migration, and `supabase functions
deploy ozzie-nutrition-coach` — both must ship together with the app build (the client now passes params the
old DB/function don't expect; the edge fn is back-compat, the RPC is not until the migration applies).

**Lint rule added** (`no-restricted-syntax` in `.eslintrc.js`, commit in this batch): bans `x.toISOString().slice()` for calendar days → points to `localDateString()`/`parseLocalDate()`. `performance.ts` keeps an intentional UTC-symmetric keying via a justified `eslint-disable`.

### 3E. 🟢 Later / deferred (post-launch)

- [ ] Swap `src/services/weather.ts` Open-Meteo → Apple WeatherKit before charging at scale (non-commercial license).
- [ ] USDA FoodData Central as barcode fallback.
- [ ] `injury_flag` coach-memory writer + reporting UI.
- [ ] Re-enable Ozzie voice (upgrade ElevenLabs off Free, flip `OZZIE_VOICE_ENABLED`, re-test on device).
- [ ] Enable Google auth provider (needs Google Cloud OAuth client — user deferred, no GCP billing yet).
- [ ] Expo SDK upgrade (~4 majors behind) + npm audit findings (need breaking Expo bump). *Deferred every audit.*
- [ ] HealthKit HRV unit fix + sleep double-count (needs device).
- [ ] Endurance/hyrox pause controls; warm-up skip-gating (needs device/product judgment).
- [ ] Two unbuilt designed features (docs exist, nothing implemented):
  - **Trend-Based Proactive De-Load** (`docs/OSPREY-feature-plans-deload-watch.md`, ~1–2 wk) — `computeAcwrTrend` + `DeloadSuggestionCard`.
  - **Real Apple Watch Bridge** (~3–4 wk) — the JS bridge has *regressed to absent*; `watch-connectivity.ts` is a stub.

### 3F. Web app / website (own workstreams, not in the mobile TODO)

- [ ] **Website launch is HELD** — GitHub Pages source + deploy workflow disabled. To go live: flip repo
  Settings → Pages → Source = "GitHub Actions"; get **legal review of Terms copy** (`website/src/pages/terms.astro`);
  optional Lighthouse re-run.
- [ ] Web app hardening (deferred from Phase 1): self-host fonts (vs Google CDN), responsive polish.
- [ ] Phase 2 nutrition housekeeping: `useDeleteRecipe` orphans `source='recipe'` shadow `food_items` rows
  (needs cleanup + auto-delete); add `food-lookup.test.ts` for `searchFoodByName`; minor `macros.ts` polish
  + numeric validation on manual food-add inputs.

---

## SECTION 4 — NEXT: brainstorm / proposed direction

Grounded in the review above. These are **proposals to refine**, not commitments.

### Proposed sequencing
1. **Stabilize the base (1–2 wks).** Do Section 2 reconciliation → clean audit → fix the confirmed-open
   security + crash bugs. Everything downstream depends on a trustworthy `main`.
2. **Ship the mobile app (2–3 wks).** Buy domain → native build → ASC → TestFlight → QA. The app is
   feature-complete; the blockers are logistics + verification, not code.
3. **Close the credibility gap (parallel track).** Wire the coaching calculators + real periodization (3C).
   This is what makes OSPREY a *coach* rather than an LLM wrapper — arguably the product's whole thesis.
4. **Launch the website** once the app is in review (3F).

### Open questions worth a real brainstorm
- **Coaching-engine architecture:** should plan generation be calculator-first with the LLM as a *presenter*,
  or LLM-first with calculators as *guardrails/validators*? This is the core product-defensibility decision.
- **Web app scope:** is `webapp/` a companion (log-from-desktop) or a full second product? That changes how
  much hardening/feature investment it warrants.
- **De-load vs Watch:** the de-load feature is cheaper and reinforces the "coach that watches your load" thesis;
  the Watch bridge is expensive and table-stakes-y. Recommend de-load first.
- **Voice (Ozzie):** worth the ElevenLabs commercial cost at launch, or keep text-only until revenue justifies it?

> To pressure-test any of these, run a dedicated brainstorming session — this section is a starting point, not a decision.

---

## Appendix A — File cleanup log (2026-07-13)

- **Deleted:** `.DS_Store` × 3 (gitignored junk).
- **Removed:** `OSPREY-app/.claude/worktrees/reanimated-anim` git worktree (**726 MB reclaimed**). Branch
  `feat/reanimated-screen-animations` and its 1 feature commit (`e0bc69b`) are preserved — merge it any time.
- **Kept (owner decision):** `.superpowers/sdd/` Phase 2 process artifacts, retained as a record.
- **Left untouched (intentionally):**
  - `.claude/worktrees/tsb-engine-advisor-plans` — **locked by an active claude session** (pid 13868). Do not remove while in use.
  - `OSPREY-app/src/services/subscriptions.ts` — **59 lines uncommitted.** Review and commit before it's lost.
  - `OSPREY-app/audit-reports/*`, `docs/archive/*` — historical record; superseded by this plan but retained.

## Appendix B — Unmerged branches (as of 2026-07-13)
- `feat/reanimated-screen-animations` — 1 commit: Reanimated animations for Home/Exercise/Nutrition tabs. **Decide: merge or drop.**
- `worktree-tsb-engine-advisor-plans` — 1 commit: TSB-engine correctness/cleanup advisor plans (001–005). Docs only; review then merge or drop.
- Many `origin/claude/*` — the audit fix-branches. See Section 2.
