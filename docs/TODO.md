# OSPREY — Master TODO

*The single living to-do list. Consolidates the former `LAUNCH_CHECKLIST.md`, `OSPREY_External_TODO.md`, and the ops checklist from `ROADMAP_9OF10.md` (all now in `docs/archive/`). The roadmap itself is a historical record of shipped features.*

*Bundle ID: `com.SillyGoose.OSPREY` · EAS Project: `efab587d-56da-4b0d-acec-e697c48b921a` · Supabase project: `jslbutpmgoushkzcghtg`*

*Last updated: 2026-07-05*

Legend: 🔴 blocks features from working · 🟡 needed before TestFlight/launch · 🟢 later

---

## 1. Backend go-live 🔴

- [ ] **Sync migration history first.** All SQL now lives in `supabase/migrations/` (001–010 were moved from the repo root on 2026-07-05 and renamed to `20260628000001`–`...010`). Since 001–015 were originally applied by hand, run `supabase migration list` and mark any already-applied ones with `supabase migration repair --status applied <version>` **before** pushing.
- [ ] `supabase db push --linked` — applies migrations 016–026 (delete account, lift prescriptions, hydration, expanded exercise library, interval prescriptions, triathlon goal, workout-import source, saved routes, challenge types, leaderboard v2, coach memory).
- [ ] Deploy all edge functions: `ozzie-daily-brief`, `ozzie-generate-plan`, `ozzie-nutrition-coach`, `ozzie-meal-photo`, `ozzie-voice-log`, `ozzie-race-briefing`, `ozzie-race-retro`, `ozzie-data-export`.
- [ ] Set secrets (Supabase → Edge Functions → Secrets):
  - [ ] `OPENAI_API_KEY` — **currently empty; every Ozzie AI feature is dead without it.** Confirm OpenAI billing/credits are enabled.
  - [ ] `ELEVENLABS_API_KEY` (must be set server-side, not just `.env.local`)
  - [ ] `RESEND_API_KEY` + verified sending domain in Resend (data export emails); optionally `EXPORT_FROM_EMAIL`
- [ ] Supabase → Auth: enable Apple + Google providers; add `osprey://auth-callback` redirect.
- [ ] Verify RLS is enabled on all tables (Dashboard → Table Editor).
- [ ] **Fresh native build** — native modules (`expo-calendar`, `expo-sqlite`, `react-native-health`, `react-native-maps`, `react-native-purchases`) don't work in Expo Go or old dev clients: `npx expo prebuild --clean` then EAS dev-client build. Use Node 20 (Node 22+ breaks Expo SDK 52).

## 2. Before TestFlight / launch 🟡

### Assets
- [ ] **Replace `splash.png` — it is a 1×1px placeholder and will ship a blank splash screen.**
- [x] App icon — fixed 2026-07-02 (audit branch, merged 2026-07-05): `app.json` points at the 1024×1024 `icon-1024.png`.

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
