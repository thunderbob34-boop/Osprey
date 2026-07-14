# OSPREY — Go-Live Deploy Checklist

> Backend deploy runbook (migrations + edge functions) plus the ordered path to the App Store.
> The backend steps below are precise and current as of 2026-07-14. For the detailed app-store
> launch-blocker sub-items, this doc points to [MASTER-PLAN.md](MASTER-PLAN.md) §3A (single source of truth).

**Prerequisites:** Supabase CLI installed and the project linked (`supabase link`), edge-function secrets
already set (OpenAI, ElevenLabs, Resend — per MASTER-PLAN §3A), and **Node 20** for the app build.

---

## 1. Database migrations — `supabase db push`

First see what's actually pending against the live project, then apply:

```bash
supabase migration list      # compare local vs remote; confirm what's unapplied
supabase db push             # applies all pending migrations in order
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

## 2. Edge functions — `supabase functions deploy`

Six functions changed this session. Deploy each:

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
