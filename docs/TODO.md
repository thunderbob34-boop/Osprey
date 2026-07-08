# OSPREY — Master TODO

*The single living to-do list. Consolidates the former `LAUNCH_CHECKLIST.md`, `OSPREY_External_TODO.md`, and the ops checklist from `ROADMAP_9OF10.md` (all now in `docs/archive/`). The roadmap itself is a historical record of shipped features.*

*Bundle ID: `com.SillyGoose.OSPREY` · EAS Project: `efab587d-56da-4b0d-acec-e697c48b921a` · Supabase project: `jslbutpmgoushkzcghtg`*

*Last updated: 2026-07-10*

Legend: 🔴 blocks features from working · 🟡 needed before TestFlight/launch · 🟢 later

---

## 1. Backend go-live 🔴

- [x] **Sync migration history first.** Verified 2026-07-10 via `supabase migration list` — local and remote are in lockstep for every migration `20260628000001` through `20260709000031` (and `...032` after it was applied). No repair needed.
- [x] `supabase db push --linked` — all migrations through `032` applied (delete account, lift prescriptions, hydration, expanded exercise library, interval prescriptions, triathlon goal, workout-import source, saved routes, challenge types, leaderboard v2, coach memory, friend requests, friend search by phone, anon SELECT grants, TRUNCATE-grant revoke — see below).
- [x] Deploy all edge functions — confirmed 2026-07-10 via `supabase functions list`: `ozzie-daily-brief`, `ozzie-generate-plan`, `ozzie-nutrition-coach`, `ozzie-meal-photo`, `ozzie-voice-log`, `ozzie-race-briefing`, `ozzie-race-retro`, `ozzie-data-export` are all `ACTIVE`.
- [ ] Set secrets (Supabase → Edge Functions → Secrets):
  - [x] `OPENAI_API_KEY` — set 2026-07-05. Verify billing/credits are enabled on the OpenAI account (a key without billing 429s on every call).
  - [x] `ELEVENLABS_API_KEY` — confirmed set 2026-07-06 (verified via `supabase secrets list` 2026-07-10).
  - [ ] `RESEND_API_KEY` + verified sending domain in Resend (data export emails); optionally `EXPORT_FROM_EMAIL` — **still not set**, confirmed missing 2026-07-10.
- [ ] Supabase → Auth: enable Apple + Google providers.
  - [x] Add `osprey://auth-callback` redirect — added 2026-07-10 (Redirect URLs allow-list was empty before this).
  - [x] Site URL — updated 2026-07-10 from the `http://localhost:3000` dev default to `https://osprey.app`.
  - [x] Apple provider — **Enabled** 2026-07-10. Created Services ID `com.SillyGoose.OSPREY.signin` (domain `osprey.app`, return URL `https://jslbutpmgoushkzcghtg.supabase.co/auth/v1/callback`) and a Sign In with Apple key (Key ID `P54N2RM8UV`) in Apple Developer; Client IDs + generated ES256 client-secret JWT set in Supabase. **JWT expires 2027-01-07 — must regenerate before then** (Apple caps these at 6 months; Supabase's own banner warns web sign-in breaks otherwise).
  - [ ] Google provider — confirmed **Disabled** in dashboard 2026-07-10. Needs a Google Cloud OAuth client ID/secret before it can be turned on. **Deferred** — user doesn't want to enable billing on a Google Cloud project yet.
- [x] Verify RLS is enabled on all tables — checked 2026-07-10: 31/33 public tables have RLS on. The 2 without (`exercises`, `food_items`) are pure shared reference data with no `user_id` column, so that's correct as-is, not a gap.
  - [x] **Found + fixed in the same pass:** every public table granted `TRUNCATE` to `anon`/`authenticated` (RLS doesn't govern TRUNCATE at all, so this was the one thing those policies could never stop). Not reachable through the app's normal PostgREST path, but closed as defense-in-depth via migration `032_revoke_truncate_grants.sql`. Confirmed 0 tables left with the grant afterward.
- [ ] **Fresh native build** — native modules (`expo-calendar`, `expo-sqlite`, `react-native-health`, `react-native-maps`, `react-native-purchases`) don't work in Expo Go or old dev clients: `npx expo prebuild --clean` then EAS dev-client build. Use Node 20 (Node 22+ breaks Expo SDK 52).
- [ ] **Verify SecureStore session migration on device** — 2026-07-06: Supabase auth session moved from plain AsyncStorage to encrypted storage (`src/services/secure-session-storage.ts`, AES key in Keychain/Keystore). On a device with an existing login, update the app and confirm you stay signed in across an app relaunch; also confirm fresh sign-in persists across relaunch.

## 2. Before TestFlight / launch 🟡

### Assets
- [x] `splash.png` — replaced 2026-07-06 with a real 1284×2778 splash (Ozzie mark centered on `#060912`, generated from `icon-1024.png`).
- [x] App icon — fixed 2026-07-02 (audit branch, merged 2026-07-05): `app.json` points at the 1024×1024 `icon-1024.png`.

### Crash reporting
- [ ] **Activate Sentry** — the SDK is fully wired as of 2026-07-07 (`@sentry/react-native` + Expo plugin + metro config + init in `app/_layout.tsx`) but no-ops until a DSN exists. Create a free Sentry project (React Native platform), then set `EXPO_PUBLIC_SENTRY_DSN` in `.env.local` and as an EAS environment variable for production builds. Optional but recommended before launch: add `organization`/`project` + `SENTRY_AUTH_TOKEN` to the plugin config so release builds upload source maps for readable stack traces.

### RevenueCat / monetization
- [ ] App Store Connect: create subscription group + two products — $9.99/mo and $89.99/yr.
- [ ] RevenueCat: entitlement `osprey_plus`, attach both products, default Offering = annual.
- [ ] Add App Store Connect API key to RevenueCat.
- [ ] Test purchase + Restore Purchases on TestFlight with a sandbox account (restore on a second device too).

### App Store Connect
- [ ] Register app (bundle `com.SillyGoose.OSPREY`).
- [x] `eas.json` → `ascAppId` = `6785572381`; confirm `appleTeamId` (`8YVWCVPW8J`).
- [ ] Enable HealthKit capability.
- [ ] Screenshots: 6.7", 6.5", 5.5".
- [ ] Fill metadata from `metadata/` (name, subtitle, description, keywords, promo text, release notes). Age rating 4+.
- [ ] Privacy policy URL live before review — `metadata/privacy-url.txt` is a placeholder; confirm `https://osprey.app/privacy` actually hosts `docs/privacy.html` and update `src/constants/links.ts` if not. Real support URL too.
- [ ] App Privacy declaration: Health & Fitness, Location, User Content, Identifiers; processors Supabase / OpenAI / ElevenLabs / RevenueCat.
- [ ] Change owner display name from "Augustas Johnson" to company name before submission.
- [ ] Add subscription metadata (blocks production review).
- [ ] `version` `1.0.0` / `buildNumber` `1` confirmed; no dev/placeholder copy visible to users.

### Ozzie voice
- [ ] Listen to `EXPO_PUBLIC_OZZIE_VOICE_ID` on a physical device; confirm it matches the casting brief (warm, Kronk-spirited). Re-cast + update `.env.local` if not.
- [ ] Confirm ElevenLabs quota covers real usage. (🟢 later: commission custom voice clone.)

### Build & submit
- [ ] `eas build --platform ios --profile production` → `eas submit --platform ios` → TestFlight internal testers first.

## 3. QA pass (after §1 is done)

- [ ] Clean-account onboarding: sign up → profile → plan generates (check lift + interval prescriptions and, for a triathlon goal, balanced swim/bike/run/lift days).
- [ ] GPS run: start, in-run guidance card + Ozzie cues, stop, route map. Verify slow steady walking accrues distance (GPS anchor fix, 2026-07-05).
- [ ] Lift log: prescribed workout preloads, plate math on set tap, PR detection + voice celebration, rest timer, recap ties back to plan intent.
- [ ] Food log: barcode (incl. timeout fallback), photo, manual, Quick Add recents, Copy yesterday. Macro card on Home matches Log.
- [ ] Weight trend: log weight across days → nutrition tip mentions trend, targets shift, training/rest-day chip shows.
- [ ] Hydration quick-add on Home and Log.
- [ ] Daily brief (morning), evening look-ahead (opt-in, 8pm), supplement reminder fires, race-week reminder 7 days out.
- [ ] Race hub: add race, countdown + goal pace, logistics, post-race retrospective → coach memory callback in a later brief.
- [ ] Challenges: create, friend sync, leaderboard incl. new `lift_volume` and `streak` types.
- [ ] HealthKit: workouts write to Health; Apple Watch/Garmin import (existing users re-prompted for the new Workout read scope); no duplicates on re-sync.
- [ ] Calendar blocking: "OSPREY: …" events appear; schedule-conflict note in brief.
- [ ] Offline: airplane mode after one load → Home/Stats/Log render from cache.
- [ ] Data export: button emails 5 CSVs (needs `RESEND_API_KEY`).
- [ ] Units toggle: Log weight chip follows preference.
- [ ] **Regression:** Performance Intelligence card (fitness/fatigue chart, injury risk, race predictor) renders for an OSPREY+ account — was silently broken by the `distance_meters` column bug, fixed Jul 3.

## 4. Later 🟢

- [ ] Swap `src/services/weather.ts` from Open-Meteo to Apple WeatherKit before charging users at scale (one-file change; Open-Meteo is non-commercial).
- [ ] USDA FoodData Central as barcode fallback.
- [ ] Units display sweep — Stats/recap/Activity/Routes still hardcode miles/lbs (~14 files).
- [ ] `injury_flag` coach-memory writer + reporting UI.
- [ ] Phase 2: music, gym locator, race auto-import APIs.

---

## Already set (no action)

- ✅ Supabase URL + anon key, ElevenLabs key + voice ID, RevenueCat iOS key — in `.env.local`
- ✅ EAS `projectId` in `app.json`; `UIBackgroundModes` and `associatedDomains` verified 2026-07-02
- ✅ ESLint config, barcode-lookup timeout, sign-in keyboard/autofill, onboarding a11y — merged from audit branch 2026-07-05
