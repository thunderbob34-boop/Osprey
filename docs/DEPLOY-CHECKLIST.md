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
- **Migration `20260714000003_sport_primary_goals.sql`** — adds swim/rowing/hyrox to `primary_goal_enum`.
  **Committed but NOT applied.** Apply via MCP `apply_migration` (idempotent `ADD VALUE IF NOT EXISTS`,
  backward-compatible). Must be applied **before/with** the 2b-i redeploy — the fn upserts those enum values, and
  storing one before the enum has it would 500 the request.

Each piece is backward-compatible on its own, but the app build that exposes sport selection needs **both** the
migration applied **and** the fn redeployed, or a selected sport fails to persist / no-ops.

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
