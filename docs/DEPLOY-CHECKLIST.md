# OSPREY — Go-Live Deploy Checklist

> Backend deploy runbook (migrations + edge functions) plus the ordered path to the App Store.
> For the detailed app-store launch-blocker sub-items, this doc points to [MASTER-PLAN.md](MASTER-PLAN.md) §3A.

## Status

- ✅ **Backend deployed 2026-07-14** to project `jslbutpmgoushkzcghtg` (OSPREY):
  - 6 edge functions deployed (`ozzie-generate-plan` first, then nutrition-coach, data-export, daily-brief, meal-photo, voice-log) — `verify_jwt=true` preserved.
  - `log_hydration_client_date` + `one_active_plan_per_user` applied and verified (index exists; 0 users with >1 active plan; 1 duplicate archived).
- ⚠️ **`supabase db push` is NOT usable** on this project — the repo's `supabase/migrations/` has **diverged** from the live `schema_migrations` history (many live migrations were applied via dashboard/MCP and never committed; some repo files are live under different version numbers). Migrations were therefore applied with **MCP `apply_migration`**, not `db push`. **`db pull` cannot auto-reconcile it** (it errors and suggests reverting real migrations — do not run that). Reconciliation is a **pending, separate task** (see below).

**Prerequisites:** Supabase CLI installed and the project linked (`supabase link`), edge-function secrets
already set (OpenAI, ElevenLabs, Resend — per MASTER-PLAN §3A), and **Node 20** for the app build.

---

## 1. Database migrations — ✅ done (via MCP, not `db push`)

> **Do NOT use `supabase db push` here until the migration-history drift is reconciled** (see the
> reconciliation appendix). Both pending migrations were applied 2026-07-14 via MCP `apply_migration`.
> The commands below are the *intended* workflow once the drift is fixed.

```bash
supabase migration list      # compare local vs remote; confirm what's unapplied
supabase db push             # applies all pending migrations in order — BLOCKED by drift for now
```

Migrations present locally after the last known-applied (`…032`). Confirm which are already on the
remote with `migration list` — do not assume:

| Migration | What it does | Coupling |
|---|---|---|
| `…33_exercise_sets_write_grants` | webapp grants | none |
| `…34_users_location_zip` | tune-up race zip | none |
| `20260713000001_fix_social_rpc_idor_and_consent` | **security** — IDOR/consent/leaderboard | apply ASAP (security) |
| `20260713000002_recipes_and_web_nutrition_grants` | webapp Phase 2 nutrition | none |
| `20260713000003_log_hydration_client_date` | `log_hydration` accepts client local day | ⚠️ **see §3 ordering** |
| `20260714000001_one_active_plan_per_user` | partial unique index (idempotency) + dedup | ⚠️ **see §3 ordering** |

The `one_active_plan_per_user` migration **archives any pre-existing extra active plans** (keeps the newest)
before creating the index, so it won't fail on live data — but you may want to eyeball affected rows first:
```sql
SELECT user_id, count(*) FROM training_plans
WHERE status='active' AND deleted_at IS NULL GROUP BY user_id HAVING count(*) > 1;
```

---

## 2. Edge functions — ✅ deployed 2026-07-14 · ⚠️ `ozzie-generate-plan` has PENDING changes (redeploy at go-live)

All six deployed 2026-07-14 (`verify_jwt=true` preserved). Commands, for reference / redeploy:

```bash
supabase functions deploy ozzie-nutrition-coach   # timezone: uses client-passed local day (UTC fallback)
supabase functions deploy ozzie-generate-plan     # idempotency 23505 recovery + generic error text
supabase functions deploy ozzie-data-export       # generic error text (was leaking err.message)
supabase functions deploy ozzie-daily-brief       # generic error text
supabase functions deploy ozzie-meal-photo        # generic error text
supabase functions deploy ozzie-voice-log         # generic error text
```

All six are **backward-compatible** with the current app build on their own (the error-text change is internal;
`ozzie-nutrition-coach` falls back to UTC if the app doesn't send `clientDate`). The one true coupling is the
`log_hydration` RPC — see §3.

### ⚠️ Pending since the 2026-07-14 deploy — `ozzie-generate-plan` must be REDEPLOYED at go-live

The coaching-engine work landed on `main` after that deploy, so the **live** `ozzie-generate-plan` is now stale.
Redeploy it (`supabase functions deploy ozzie-generate-plan`) as part of the app go-live, and apply the one new
migration. What changed and why the app + edge fn must ship together (atomic):

- **Phase 2a** — `computeEnvelope` now sends `envelope.zones` (a `ZoneSet` discriminated union) instead of
  `runZones`, and `validate.ts` clamps per-kind. **Coupling:** the app build sends `zones`; the *deployed* fn
  still reads `runZones`, so until redeployed, run pace guidance + the pace-clamp silently no-op (soft
  degradation — no error, just weaker plans).
- **Phase 2b-i** — sport routing: `PRIMARY_GOAL_MAP` gains swim/rowing/hyrox, a new pure `goals.ts`
  (`routeDisciplineDays`), `GoalsContext.weeklyRowDays`, and rowing prompt rules. Until redeployed, a user who
  selects Swimming/Rowing/Hyrox falls through `?? 'hybrid'` and their zones never fire.
- **Phase 2b-iii** — HR-fallback zones: the app sends a new `envelope.hrZones` field; the fn mirrors it (`Envelope`
  interface) and appends HR-zone guidance to the prompt via a new pure `guidance.ts`. Backward-compatible (old app →
  no `hrZones` → `hrGuidance` returns `''`), so this one degrades softly if the fn lags the app — but redeploy so
  weight_loss/general_fitness + cross-training cardio actually get HR guidance. `validate.ts` is unchanged.
  (2b-ii / 2b-ii-web added NO edge-fn changes — app-only and webapp-only respectively.)
- **Phase 2c-i-a** — cycling as a selectable sport: `PRIMARY_GOAL_MAP` gains `cycling`, and `routeDisciplineDays`
  (`goals.ts`) routes a cycling athlete's days to `weeklyBikeDays`. Until redeployed, a Cycling selection falls
  through `?? 'hybrid'` and gets a hybrid (run+lift) plan instead of a bike-focused one. `validate.ts` unchanged
  (cycling has no pace clamp; power/FTP zones are the deferred 2c-i-b).
- **Phase 2c-i-b** — cycling POWER zones: the app now sends a `{ kind: 'cycling', ftpWatts, bands }` envelope zone
  when a cyclist has an FTP, and **`validate.ts` gains the `cycling` kind + narrows the pace-clamp to
  run/swim/rowing** (first `validate.ts` change since 2a — cycling is prompt-only). `index.ts` mirrors the cycling
  ZoneSet + emits watt guidance. **App + edge MUST deploy together:** a new-app cycling zone hitting the *old* fn
  would fall through the `zoneGuidance` chain and be mis-described as rowing. No migration (the cycling enum is
  2c-i-a; FTP rides the existing `threshold_anchor` JSONB via a new `bike` key). Webapp Training Zones cycling
  section ships with the webapp's own deploy.
- **Phase 2c-ii** — triathlon composite: the app sends a `{ kind: 'triathlon', swim, bike, run }` envelope zone, and
  **`validate.ts` is refactored** so the pace-clamp dispatches per session type (`paceZoneForSession`) — single-sport
  clamping is byte-identical (verified), and a triathlon plan clamps swim/run by their sub-zones while bike stays
  advice-only. `index.ts` mirrors the composite + emits three-discipline guidance. **App + edge MUST deploy
  together:** a triathlon composite zone hitting the *old* fn would fall through `zoneGuidance` and be mis-read as
  cycling. No migration; no webapp change (triathletes set the 3 anchors on the 2c-i-b card).
- **Phase 2c-iii** — fuel per day-type: the app's `envelope.fuel` changes from a single `FuelTargets` range to a
  `FuelPlan` (a carb ladder keyed by day-type — easy/moderate/high/peak — plus a per-sport in-session rate), and
  **`validate.ts` step (c) now attaches each session its own carb range by post-polarization intensity** (a hard day
  gets high-day carbs, an easy or demoted day fewer). `index.ts` mirrors `FuelPlan` + the prompt states the by-day
  ranges. **App + edge MUST deploy together:** the envelope wire-shape changed (`FuelTargets`→`FuelPlan`), so a new
  edge fn (`validate.ts` reads `fuel.dailyCarbGByDayType`) hitting an *old* app's single-range `fuel` would throw,
  and an old fn reading a new `FuelPlan` for `.dailyCarbG` would emit a broken carb string. **No migration; no
  webapp/mobile.** The stored `training_sessions.fuel` shape is unchanged (`{ dailyCarbG, proteinG,
  longSessionCarbGPerHour }`) — only the `dailyCarbG` value now varies by the day's intensity, so no renderer or
  migration impact.
- **Phase 3-i (ultra)** — ultra becomes a selectable goal reusing run + HR zones: the app sends `envelope.sport='ultra'`
  (routed to run zones via `blueprintSport('ultra')='run'`) plus a new `envelope.ultraParams`-driven progressive
  25/25/30 taper, distance-scaled volume, and heavier fuel; the edge fn gains `enforceBackToBackLongRuns` (a
  deterministic post-`validateAndClamp` step that puts the two longest runs on consecutive days for ultra) + an ultra
  prompt block. A new `user_goals.goal_params` JSONB carries race-distance/vert/gut-trained. **App + edge MUST deploy
  together:** a new-app ultra plan hitting the *old* fn gets no back-to-backs + no ultra prompt (soft degrade), and
  the enum/`goal_params` need the migrations. **Non-ultra plans byte-identical** (all ultra logic sport-gated);
  `validate.ts` untouched. **⚠️ PRE-SHIP:** the ultra collection UI (React Native screens) needs a device/simulator
  smoke test — it could not be visually rendered in CI (pre-existing Expo Router static-SSR block).
- **Phase 3-ii (powerlifting)** — `lift` becomes a real powerlifting engine: the app sends a new `envelope.strength`
  field (phase→%1RM zone + Prilepin caps + kg loads + meet attempts, from the athlete's 1RMs stored in `goal_params`);
  the edge fn reworks the `lift_prescription` prompt to emit structured `loadKg`, adds a `strengthGuidance` block, and
  adds a `lift`-gated **load guardrail** in `validate.ts` (clamps a comp lift's `loadKg` into the %1RM band). Lift now
  routes lift-primary, and the shared prompt fuel line gains a protein target for ALL sports (additive). **NO
  migration** (the `lift` enum, `goal_params`, and `target_date` all already exist). **App + edge MUST deploy
  together:** a new-app lift plan hitting the *old* fn gets the generic bodybuilder prompt (soft degrade). **Non-lift
  plans byte-identical** (all strength logic `lift`-gated; `validate.ts` steps a/b/c untouched — the guardrail is a
  pure append). **⚠️ PRE-SHIP:** device smoke test the 2 lift collection screens (same Expo SSR headless-render
  caveat as ultra). **Follow-ups (non-blocking, filed):** (1) a plan-builder goal-*switcher*'s first generation reads
  a stale `primary_goal` (pre-existing, affects ultra too); (2) a lifter who *skips* the 1RM form gets 0 kg comp lifts.
  **→ Both RESOLVED in Phase 3 follow-ups (merged `9765833`), below.**
- **Phase 3 follow-ups** (fixes the two above). **Fix #1 (goal-switch stale envelope) — APP-ONLY:** `invokeGeneratePlan`
  now prefers the just-picked goal (POSTed `preferences.primaryGoal`, mapped via a new client `goal-map.ts` mirror of the
  fn's `PRIMARY_GOAL_MAP`) over the stale `user_goals.primary_goal` DB read, so a goal switch builds the right sport's
  envelope on the FIRST generation; **no edge change.** **Fix #2 (paramless-lift 0 kg):** Part A is APP-ONLY
  (`buildStrengthPrescription` returns null when a lifter has no 1RMs → falls back to the general strength prompt, which
  the *current* live fn already handles); **Part B is EDGE and rides THIS redeploy** — `validate.ts` step (d) skips
  clamping a comp lift with `orm ≤ 0`, and `strengthGuidance` (extracted from `index.ts` into `guidance.ts`) omits 0-orm
  lifts, so a *partial*-provide lifter is never told or clamped to 0 kg. **NO migration. Non-lift/single-sport
  byte-identical** (Fix #1 fallback is behavior-preserving; Fix #2 strength logic is `lift`-gated; `validate.ts` a/b/c
  untouched). Without the redeploy, the partial-provide half of Fix #2 stays broken (stale fn still says "bench 0kg" +
  clamps to [0,0]); the skip-the-form half (Part A) is correct regardless.
- **Phase 3 (hyrox)** — `hyrox` becomes a real hybrid engine by wiring the already-built (orphaned) hyrox calculators
  into the coaching engine: the app sends a new `envelope.hyrox` field (compromised run-pace split + division-fixed
  station weights + race electrolytes, from the athlete's division in `goal_params`); the edge fn gains a `hyroxGuidance`
  prompt block (compromised-running intervals + station strength-endurance + roxzone) and an `Envelope.hyrox` mirror.
  Hyrox **reuses run zones** (`blueprintSport('hyrox')='run'`) — **no ZoneSet variant, `validate.ts` untouched**. Station
  work is steered into session descriptions/ozzie_notes (NOT the `lift_prescription` whitelist). **NO migration** (the
  `hyrox` enum is already in `20260714000003` below; `goal_params` exists). **App + edge MUST deploy together:** a new-app
  hyrox plan hitting the *old* fn gets a generic run plan (soft degrade — no compromised-split/station guidance).
  **Non-hyrox plans byte-identical** (all hyrox logic sport-gated; `validate.ts` unchanged). **⚠️ PRE-SHIP:** device smoke
  test the 2 hyrox collection screens (division picker; same Expo SSR headless-render caveat as ultra/powerlifting).
  **Follow-up (non-blocking, filed):** `goal_params.targetTimeMinutes` is plumbed but not yet collected/consumed (both
  UIs hardcode `''`) — wire it to prompt pacing + `hyroxInRaceCarbGPerHour(targetTime)` in a later slice.
- **Phase 3 (crossfit) — the Phase 3 finale + the only sport needing a NEW migration.** `crossfit` becomes a real
  periodized 3-modality goal: full plumbing + a **new migration** (`20260716000001`, below), a composing
  `envelope.crossfit` field (strength %1RM reusing `intensityZoneForPercent1RM` + the wired energy-system zones +
  benchmark testing), and an edge `crossfitGuidance` block. Engine reuses `hrZones` (`blueprintSport('crossfit')=null`
  → NO ZoneSet change). **App + edge MUST deploy together:** a new-app crossfit plan hitting the *old* fn gets a
  generic plan (soft degrade). **Non-crossfit plans byte-identical.** **⚠️ PRE-SHIP:** device smoke test the crossfit
  collection screens (3 1RMs + compete toggle + Fran). **Follow-ups (filed):** (1) the `competing` toggle is collected
  but inert in the plan — a competing athlete is still periodized via a set `target_date`; wire its intensity-bias when
  the Open-week competition-peaking slice lands; (2) `primaryDayLabel('crossfit')` shows "Run days" (small label fix).
- **Webapp Ozzie chat (NEW edge fn `ozzie-chat` + NEW migration `20260717000001`) — INDEPENDENT of everything above.** A grounded, streaming
  coaching chat at the webapp's `/chat`. Adds the **ninth** edge function, `ozzie-chat` (the FIRST that streams SSE rather than
  returning JSON), and one migration creating `ozzie_conversations` + `ozzie_messages`. **This bundle touches no existing table,
  enum, view, or function**, so — unlike every coaching-engine item above — it can deploy **standalone without redeploying
  `ozzie-generate-plan` or applying the coaching migrations.** Deploy = `supabase functions deploy ozzie-chat` (it needs
  `verify_jwt` handling like the others AND, being browser-called, it sets its own CORS — the six phone-only fns don't) + apply
  `20260717000001` via MCP. **Chat is dark until BOTH land** (the webapp `/chat` renders + lists threads but a send fails at the
  network). The function reads only already-deployed columns — it deliberately does **NOT** select `user_goals.goal_params`
  (verified absent in prod 2026-07-17; it selects `primary_goal/target_race/target_date/total_weeks_planned/threshold_anchor`,
  all live), so it has **no dependency on the pending coaching bundle**. `OPENAI_API_KEY` is already set (same secret the other
  Ozzie fns use). **Webapp-only client** (no mobile change; the phone's Ask-Ozzie stays a stub). **⚠️ PRE-SHIP:** a ~2-min
  logged-in click-through of `/chat` once deployed — agents hit the login wall, so the streaming round-trip is unexercised.
- **Migrations `20260714000003_sport_primary_goals.sql` (swim/rowing/hyrox) + `20260715000001_cycling_primary_goal.sql`
  (cycling) + `20260715000002_ultra_primary_goal.sql` (ultra) + `20260716000001_crossfit_primary_goal.sql` (crossfit)
  + `20260715000003_goal_params.sql` (adds `user_goals.goal_params` JSONB)** — the four `*_primary_goal`/`sport_primary_goals`
  migrations add values to `primary_goal_enum`; `goal_params` is an additive nullable column. **All FIVE committed but NOT applied.** Apply via MCP `apply_migration` (idempotent
  `ADD VALUE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, backward-compatible). Each enum value must be applied
  **before/with** its redeploy — the fn upserts those enum values, and storing one before the enum has it would 500
  the request.

Each piece is backward-compatible on its own, but the app build that exposes sport selection needs **both** the
migrations applied **and** the fn redeployed, or a selected sport fails to persist / no-ops.

---

## 3. Ordering & coupling (read before pushing)

The safe sequence, because the app build and backend must agree:

1. **Deploy `ozzie-generate-plan` first**, *then* apply `20260714000001`. The new function handles the `23505`
   from the unique index gracefully; the old function would surface a raw error on the rare race. Deploying the
   function before the index exists is harmless (the 23505 simply never fires yet).
2. **Apply `20260713000003` (log_hydration) with — or before — the app build that ships it.** The updated app
   passes `p_log_date` to the RPC; the *old* 2-arg RPC would reject that call. The new 3-arg RPC is fine for
   an old app too (param defaults to `CURRENT_DATE`), so migration-first is always safe; **app-build-first is not.**
3. Everything else (security migration, the 5 error-text functions, nutrition-coach) can go in any order.
4. **Webapp all-sports coverage (merged 2026-07-16, `ea34af8`)** — the webapp's `useUserGoal` reads
   `user_goals.{primary_goal, goal_params, target_date, total_weeks_planned}` to drive the sport-aware calendar
   (run predictor gated to run/ultra/triathlon + a training-phase chip) and the editable strength/hybrid zones card.
   `goal_params` is in the pending migration bundle above, so **apply those migrations before/with the webapp's
   Cloudflare deploy.** Against the *current* deployed schema the `select` 400s and degrades gracefully (predictor
   hidden, no strength card; endurance rows unaffected via the separate `threshold_anchor` read) — no crash, but the
   feature stays dark until the columns land. **Webapp-only: no new migration, no edge change.** The strength math is a
   parity-tested copy of the mobile calculators (`webapp/src/lib/{race-phase,strength-loads,crossfit-zones,hyrox-loads}.ts`).
5. **Webapp Ozzie chat (branch `spec/webapp-ozzie-chat`)** — deploy `ozzie-chat` + apply `20260717000001` (see §2). Order
   between the two doesn't matter (the function 404s a thread-read against a missing table, the table is inert without the
   function), but **both must precede the webapp build that ships `/chat`**, or a send fails at the network. **This bundle is
   independent of the coaching bundle** (items 1–4) — it can go before, after, or without them; it shares only the already-set
   `OPENAI_API_KEY`. Nothing about it forces the held coaching go-live.

**Rule of thumb:** push migrations + deploy functions **before** promoting the app build that depends on them.

---

## 4. App build & store submission

The backend is now ready. The remaining path is the app itself — full sub-item detail in
[MASTER-PLAN.md](MASTER-PLAN.md) §3A. Ordered summary:

- [ ] **Buy the domain** (`osprey.app` is unowned) — unblocks Auth Site URL, Apple Services ID, Resend, privacy/support URLs, `src/constants/links.ts`.
- [ ] **Activate Sentry** — set `EXPO_PUBLIC_SENTRY_DSN` (`.env.local` + EAS prod env).
- [ ] **Verify** OpenAI billing enabled; Resend sending domain verified.
- [ ] **Fresh native build** — `npx expo prebuild --clean` + EAS dev-client build (Node 20).
- [ ] **Verify SecureStore session** survives update + relaunch on a real device.
- [ ] **App Store Connect** — register app, HealthKit capability, screenshots, metadata, privacy/support URLs, App Privacy declaration, owner-name change, subscription metadata.
- [ ] `eas build --platform ios --profile production` → `eas submit` → **TestFlight**.
- [ ] **TestFlight QA** — purchase + Restore Purchases (sandbox, 2 devices) + the §3 QA matrix.

---

## 5. Post-deploy verification

- [ ] `supabase migration list` shows everything applied; no drift.
- [ ] Trigger a hydration log from the app → row lands on the **local** day.
- [ ] Generate a plan → succeeds; a second rapid tap does not create a duplicate active plan.
- [ ] Force an edge-function error (e.g. bad input) → response body is generic, real detail only in function logs.
- [ ] Nutrition coach targets reflect the user's local "today", not UTC.

---

## Device-verify (typecheck-only fixes from this session)

These were verified by typecheck/tests but not exercised at runtime here — confirm on a real device:
- [ ] RevenueCat: unconfigured build does **not** grant Plus; sign-out + switch account clears entitlement.
- [ ] `useSubscription`: purchase on the paywall flips Home/Stats to Plus **without** navigating away.
- [ ] GPS: endurance (outdoor bike/hike) run persists its track to the recap map.

## Time-bomb
- [ ] **Apple Sign-In client-secret JWT expires 2027-01-07** — regenerate before then (Apple caps at 6 months).

---

## Appendix — migration-history drift (pending reconciliation)

**Symptom:** `supabase/migrations/` (repo) and `supabase_migrations.schema_migrations` (live DB) have diverged.
The live DB has ~22 migrations not in the repo (applied via dashboard/MCP — e.g. `create_waitlist_table`,
`harden_security_definer_functions`, `move_pg_trgm_out_of_public`, `add_activity_feed_rpc`,
`add_accept_friend_request_rpc`, `nutrition_targets_manual_override`, `create_recipes_and_meal_plans`), and
6 repo files are live under different version numbers (e.g. repo `20260713000001_fix_social_rpc_idor_and_consent`
= live `20260713123556`). `db pull` cannot merge this; its auto-suggested `migration repair --status reverted …`
would mark **real, applied** migrations as reverted — **do not run it.**

**The live DB is the source of truth** (`schema_migrations` stores each migration's SQL in its `statements`
column, so the repo can be rebuilt from it). Reconciliation options, to be chosen deliberately:

- **A — Rebuild repo from remote (surgical):** add the ~22 remote-only migrations (reconstructed from
  `statements`) as repo files, remove the 6 divergent repo files → repo file set == remote version set →
  `db push` becomes a no-op. Local-only, git-reversible. Loses the hand-written comments on rebuilt files.
- **B — Accept remote as truth, keep applying via MCP/dashboard:** document that `db push` is not used here;
  keep applying migrations with MCP `apply_migration`. Lowest effort; repo migrations stay partially historical.
- **C — Full squash/baseline reset:** collapse to a single baseline from the current remote schema. Cleanest
  long-term but the biggest change; best done deliberately pre-launch.

Until reconciled: **apply new migrations via MCP `apply_migration`, not `db push`.**
