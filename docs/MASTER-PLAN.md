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
- [x] IDOR in 4 social `SECURITY DEFINER` RPCs — **Fixed**, migration `20260713000001_fix_social_rpc_idor_and_consent.sql` (verified 07-14, still needs `supabase db push` against the live DB — see deploy note below).
- [x] Friend-request consent bypass — same migration.
- [x] `get_challenge_leaderboard` roster leak — same migration.
- [ ] Subscription **fails open** (grants free Plus) off-iOS (`subscriptions.ts:17-53`) — needs product decision, not auto-fixed by this audit (see 3G).
- [x] 8 edge functions leak raw `err.message` / Postgres internals in 500s — **Fixed** `3c860bf` (07-14): all 8 now log server-side via `console.error` and return a generic client-safe message. **Needs `supabase functions deploy` per function to take effect.**

**Correctness / crash:**
- [x] Home crash on multi-session days — `.maybeSingle()` on 2+ rows (`daily-summary.ts`). **Fixed** `fb80acb` (order + limit 1).
- [x] Voice-logging drops set weight → corrupts PR history (`lift.tsx`). **Fixed** `3c860bf`: added `updateLiftSet`, a functional Zustand action that reads live state instead of a stale render closure — the same-tick weight-then-reps voice-log calls no longer clobber each other.
- [ ] Endurance GPS tracks never persisted (`saveEnduranceWorkout`, `workouts.ts:291-353`) — confirmed still open 07-14; not fixed this pass (real feature work: needs a `trackPoints` param + `activity_logs` insert like `saveRunWorkout` has, not a one-line fix).
- [x] "Start Session" mis-routes swim/bike/rowing/cross/hyrox to the GPS run screen (`app/(tabs)/index.tsx`). **Fixed** `fb80acb` (per-sport switch mirroring Workout tab).
- [x] GPS watcher leak on fast unmount. **Fixed** `3c860bf`: `useRunTracking` now guards the async permission/watch setup with a `cancelled` flag so a late-resolving `watchPositionAsync` removes itself instead of leaking.
- [x] UTC-vs-local "today" — **Fixed** `fb80acb`: added tested `src/utils/date.ts` `localDateString()`, applied in `daily-summary.ts`. `calendar.ts` stray-day leak **Fixed** in follow-up (tested `clampDaysToMonth`).
- [ ] `ozzie-generate-plan` idempotency race (no unique constraint on one-active-plan-per-week) — confirmed still open 07-14; needs a DB migration (unique constraint on `training_weeks(plan_id, start_date)`), not fixed this pass.
- [x] Race-plan branch hardcodes `intermediate`/4-run/1-lift, ignores athlete profile. **Fixed** `3c860bf`: now looks up the athlete's real `user_goals` row first, falls back to the old defaults only if none exists. **Needs `supabase functions deploy ozzie-generate-plan`.**
- [x] `toggleKudo` non-atomic race. **Fixed** `3c860bf`: a losing INSERT under Postgres unique-violation (23505) is now treated as success instead of thrown to the user.
- [x] Activity-feed fallback query unscoped. **Fixed** `3c860bf`: `fetchActivityFeedSimple` now explicitly scopes to self + accepted friends via `friendships`, instead of relying solely on RLS.
- [ ] `useSubscription` doesn't propagate refresh across mounted screens — confirmed still open 07-14, not fixed this pass (needs a shared store/listener, not a local `useState` cache).

**UX:**
- [x] Onboarding progress bar never reaches 100% (`totalSteps` 5 vs 4 real steps). **Fixed** `3c860bf`: `totalSteps={4}` across all 5 onboarding screens — *third time's the charm, verified by two independent review passes this audit.*
- [x] Paywall shows annual price as "/mo" — **App Store risk.** **Fixed** `fb80acb`: suffix/label now derived from the package's real billing period.
- [x] Paywall loading/error state. **Fixed** `3c860bf`: added `offeringsStatus` (loading/loaded/error) with a spinner, error+retry UI, and the subscribe button now gates on offerings actually being loaded instead of silently showing a price-less generic button.
- [x] Day-picker touch targets <44px. **Fixed** `3c860bf`: added 5px `hitSlop` on all sides (34px visual → ~44px effective tap target).
- [ ] Broader units-display sweep — confirmed still partially open 07-14: `run.tsx` (live distance/pace/splits), `recap.tsx` (distance), and `lift.tsx` (volume/plate calc/defaults) still hardcode miles/lbs while the rest of the app honors `useUnitPreference`. Not fixed this pass — `lift.tsx` in particular is a real refactor (plate-calculator math, default weights), not a one-line swap; scope it as its own task rather than rushing it.
- [x] Pace-drift coaching cue never fired (new finding, not previously tracked — `goalPaceSecPerMile` was hardcoded `null` in `run.tsx`). **Fixed** `3c860bf`: wired to the athlete's own "easy" pace ceiling (`paceBands.easy.maxSecPerMile`) for steady runs; suppressed during structured intervals, which already cue per-step.

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

**Still worth doing:** a lint rule banning `new Date().toISOString().slice(0,10)` to prevent regressions.

### 3E. 🟢 Later / deferred (post-launch)

- [ ] Swap `src/services/weather.ts` Open-Meteo → Apple WeatherKit before charging at scale (non-commercial license).
- [ ] USDA FoodData Central as barcode fallback.
- [ ] `injury_flag` coach-memory writer + reporting UI.
- [ ] Re-enable Ozzie voice (upgrade ElevenLabs off Free, flip `OZZIE_VOICE_ENABLED`, re-test on device).
- [ ] Enable Google auth provider (needs Google Cloud OAuth client — user deferred, no GCP billing yet).
- [ ] Expo SDK upgrade (~4 majors behind) + npm audit findings (need breaking Expo bump). *Deferred every audit.*
- [ ] HealthKit HRV unit fix + sleep double-count (needs device).
- [ ] Endurance/hyrox pause controls; warm-up skip-gating (needs device/product judgment).
- [x] **Trend-Based Proactive De-Load — docs corrected 07-14, this is actually BUILT.** `src/services/performance.ts` has `computeAcwrTrend`, `src/hooks/usePlanDeload.ts` wires it to plan mutations, and `DeloadSuggestionCard` renders on Home (`app/(tabs)/index.tsx`). This doc previously (incorrectly) called it unbuilt — `docs/OSPREY-feature-plans-deload-watch.md` is stale on this point; verify against the code, not that doc, going forward.
- [ ] **Real Apple Watch Bridge** (~3–4 wk, still unbuilt, doc accurate on this half) — `watch-connectivity.ts` is a stub; see `docs/OSPREY-feature-plans-deload-watch.md` §2 for the design.

### 3F. Web app / website (own workstreams, not in the mobile TODO)

- [ ] **Website launch is HELD** — GitHub Pages source + deploy workflow disabled. To go live: flip repo
  Settings → Pages → Source = "GitHub Actions"; get **legal review of Terms copy** (`website/src/pages/terms.astro`);
  optional Lighthouse re-run.
- [x] Web app hardening — self-host fonts. **Fixed** `3c860bf`: `@fontsource/space-grotesk` replaces the Google Fonts CDN `@import` (matches what `website/` already does).
- [ ] Web app hardening — responsive polish. Still open, not addressed this pass.
- [ ] Phase 2 nutrition housekeeping: `useDeleteRecipe` orphans `source='recipe'` shadow `food_items` rows
  (needs cleanup + auto-delete — note: naive auto-delete on `food_log_entries.food_item_id` FK references is unsafe,
  needs a guarded/reference-counted cleanup, not a blind cascade); add `food-lookup.test.ts` for `searchFoodByName`
  (the load-bearing `.or('source.is.null,source.neq.recipe')` filter in `useFoodSearch` is currently untested).
  Still open, not addressed this pass.
- [x] Numeric validation on manual food-add inputs. **Fixed** `3c860bf`: `isValidMacroField` gates the submit button and `submitManual` on finite, non-negative macro values.
- [x] 3 new UTC-vs-local-day bugs found this pass (`useNextRaceEvent`, `useWeekSessions`, the new-workout "Started at" default) — bypassed the existing `lib/day.ts` convention. **Fixed** `3c860bf`; added `toDateTimeInputValue` to `lib/day.ts` for the datetime-local case.
- [x] `SetsGrid` could double-INSERT a set under rapid edits (select exercise, then edit+blur before the first INSERT resolves — both branches saw `dbId=null`). **Fixed** `3c860bf`: commits now serialize per row.

### 3G. New findings from the 2026-07-14 audit (not yet actioned — product/scope decisions needed)

- **Subscription fails open off-iOS** (`src/services/subscriptions.ts:17-53`) — on Android, or iOS before RevenueCat configures, `hasOspreyPlus()` returns `true` and `purchaseOspreyPlus()`/`restorePurchases()` return fake success. Every OSPREY+ feature is unlocked for free with no real transaction. **Deliberately not auto-fixed** — flipping this to fail-closed would lock out iOS users too if it ever misfires before RevenueCat configures, and there's no Android StoreKit fallback to fail *into*. Needs a product decision on Android monetization before a code fix, not a unilateral lock-out.
- **Race-search distances always empty** (`src/services/race-search.ts:183`) — the RunSignUp *list* endpoint never returns an `events` array (the file's own comment says so), so `distances` is always `[]` for every search result. Two effects: any distance filter chip (5K/10K/Half/Full) on `race-search.tsx` always shows "No races found," and distance badges never render on result cards. The race *detail* screen is unaffected (fetches distances separately). Needs either a second API call per result or a different endpoint — not a one-line fix.
- **Dead schema, fully built, zero app code:** `gear_items` + `gear_session_links` (shoe/gear mileage tracking with `retire_at_km`) and `soreness_logs` (body-area/severity logging) have complete tables + RLS policies in `20260628000001_initial_schema.sql` but no service, hook, or screen anywhere reads or writes them. `nutrition_targets` is similarly unused (targets are computed on the fly in `nutrition-estimate.ts` instead). These aren't bugs — they're paid-for, unused surface area. See feature proposal #1 below, which wires two of the three into a real differentiator.
- **Race-hub data-consistency gaps** (not fixed, low urgency): generating a briefing/retro before tapping Save sends stale form state (`races.tsx:193,389` reads the persisted `race` object, not the in-progress edit); a race dated *today* can't have its result recorded until it's rolled into "Past" the next day (`races.tsx:1003`).
- **Body-fat logging is dead end-to-end** — `logWeight`/`useWeightLog` plumb `bodyFatPct` all the way to the DB, but no screen ever supplies it (`log.tsx:485` only ever sends `weightKg`).
- **WOD score / floors climbed / hike elevation gain are write-only** — captured into `workout_logs` from Hyrox/endurance screens but `fetchWorkoutRecap` never selects them back; no screen ever shows them again.

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
- **De-load vs Watch:** *(update 07-14: de-load is now built — see 3E — so this question is resolved by default.
  Watch bridge remains the open, expensive, table-stakes-y item.)*
- **Voice (Ozzie):** worth the ElevenLabs commercial cost at launch, or keep text-only until revenue justifies it?

> To pressure-test any of these, run a dedicated brainstorming session — this section is a starting point, not a decision.

### Feature proposals (2026-07-14 audit) — three differentiators, not commitments

Screened against what's already scoped elsewhere in this doc (tune-up races, meal-budget export, Watch bridge,
de-load, live race tracking, calendar/heat protocol, route mapper) so these are genuinely additive, not repeats.
All three lean on what no single-sport competitor (Runna, TrainerRoad, Strava) can structurally replicate: one
app that already has the athlete's full cross-sport training history, a documented sport-science rulebook
(`docs/coaching/`), and a working friend graph.

**1. Gear + Soreness → Injury-Risk Correlation ("Is it your shoes, or is it you?")**
- **Why it's a differentiator:** Strava has bare-bones shoe mileage; nobody ties gear age to a live injury-risk
  signal. OSPREY already computes `InjuryRisk`/ACWR (`performance.ts`) — pairing it with gear wear and logged
  soreness turns a mileage counter into an actual coaching insight only a multi-signal coach could give.
- **What's already built and unused:** `gear_items` + `gear_session_links` (full schema + RLS, `retire_at_km`,
  auto-incrementable `distance_km`) and `soreness_logs` (body-area/severity) both exist in
  `20260628000001_initial_schema.sql` with **zero app code** reading or writing them — confirmed dead this audit.
- **Scope:** (1) Gear CRUD screen (add/retire shoes, bikes, etc.) + auto-link active gear to each workout by
  `session_type`/`category`, incrementing `distance_km` on save (mirrors how `saveRunWorkout` already writes to
  `activity_logs`). (2) A quick soreness-log affordance on the post-workout recap (body area + 1-5 severity,
  writes `soreness_logs`). (3) A correlation card on Home/Stats: when `injuryRisk.level` is `moderate`/`high`
  *and* a piece of active gear is past ~80% of `retire_at_km` *and* recent `soreness_logs` cluster on a
  gear-relevant body area (e.g. knee for shoes), surface "Your risk is climbing and your shoes are at 380/400km —
  consider retiring them" instead of three separate, unconnected signals.
- **Integration points:** new `src/services/gear.ts` + `src/services/soreness.ts` (schema already has RLS, so
  this is pure client work), a `GearScreen.tsx` + `SorenessLogSheet.tsx`, one new correlation function in
  `performance.ts`, and a card component following the existing `DeloadSuggestionCard.tsx` pattern.
- **Effort:** Medium, ~1.5–2 weeks. The hard part (RLS, schema, injury-risk math) already exists; this is CRUD UI
  + one new correlation function + wiring auto-link into the existing `saveXWorkout` calls.

**2. "Why This Plan?" — Explainable Coaching Rationale**
- **Why it's a differentiator:** MASTER-PLAN's own north star warns: *"if we ever can't tell whether a plan came
  from our sport science or from an LLM guessing, we've lost the thread."* Right now that sport science
  (`docs/coaching/`) is an internal reference doc the athlete never sees, and `plan_adjustments.ozzie_reason`
  (a plain-English explanation column that's already populated on every automated swap/de-load/taper) is written
  to the DB but never surfaced in the UI. Competitors' AI plan adjustments are black boxes; showing the actual
  rule ("3:1 loading — this is your scheduled recovery week," "ACWR crossed 1.3, capping volume per the red-flag
  threshold") is a trust feature no black-box competitor can copy without redoing their own coaching logic.
- **What's already built:** `plan_adjustments` table with `triggered_by`/`original_json`/`adjusted_json`/
  `ozzie_reason` columns, written on every swap (`plan.ts`), de-load (`usePlanDeload.ts`), and race-plan
  generation. The data exists; there is no UI that reads `plan_adjustments` back.
- **Scope:** (1) A "Why?" tap-through from any plan card (Home brief, Workout tab, calendar day) that fetches
  the most recent `plan_adjustments` row for that session and renders `ozzie_reason` plus a one-line citation of
  the underlying rule from `docs/coaching/_index.md` (3:1 loading, taper length, ACWR threshold, red flags).
  (2) Extend `ozzie_reason` generation (currently a single hardcoded sentence per trigger type in `plan.ts`) to
  parameterize with the athlete's actual numbers (their ACWR value, their taper week number) instead of a
  generic sentence. (3) A lightweight "Plan History" screen listing recent adjustments chronologically — turns
  an audit-log table into athlete-facing transparency.
- **Integration points:** `src/services/plan.ts` (extend reason strings), a new `WhyCard.tsx`/bottom-sheet
  component, one new read-only query against `plan_adjustments`, no new tables or migrations needed.
- **Effort:** Small–Medium, ~1 week. Almost entirely UI + copy work against data that already exists; the only
  new logic is parameterizing the existing reason strings.

**3. Squad Training Sync — coordinated rest/hard days across mixed-sport training partners**
- **Why it's a differentiator:** the "Together" pillar today is kudos + a feed (Strava-shaped). No competitor
  can coordinate *training* across partners doing *different sports* — Runna only knows runners, TrainerRoad only
  cyclists. OSPREY already has the friend graph (`friendships`) and every partner's full cross-sport plan in one
  schema — this is the one social feature that's structurally only possible here.
- **Scope:** Let two-plus friends opt into a "squad" (reuses `friendships`, `status='accepted'`, no new social
  primitive needed). When squad members' plans are generated/adjusted, softly bias rest-day and key-session
  placement to overlap — e.g. if partner A's taper week and partner B's normal build week collide on a rest day,
  Ozzie proposes aligning B's rest day to A's for that week ("training buddy" accountability), without touching
  either athlete's actual periodization math. Surface it as an opt-in nudge on plan generation, not a silent
  auto-edit (same consent pattern as the de-load card: propose, don't rewrite).
- **Integration points:** new `training_squads`/`squad_members` tables (small schema addition, mirrors
  `friendships`' RLS pattern), a hook into `ozzie-generate-plan`'s session-placement step to check squad-mate
  rest days before finalizing the week, and a squad-aware variant of `DeloadSuggestionCard`-style propose/accept
  UI. Read-only awareness (showing "2 squad-mates also resting today") is a much smaller first slice than
  actually re-negotiating session placement — ship that first, real coordination second.
- **Effort:** Large, ~3–4 weeks for the full negotiated-placement version; **~1 week for a read-only "squad
  awareness" first slice** (surface squad-mates' rest/key-session days on the calendar, no plan mutation) that
  validates demand before investing in the harder scheduling-conflict logic.

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
