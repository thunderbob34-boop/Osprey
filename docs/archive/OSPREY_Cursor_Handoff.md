# OSPREY — Cursor Handoff Brief
*Last updated: June 2026 | Handoff from Cowork → Cursor*

---

## What Is OSPREY

OSPREY is a personal AI fitness coach iOS app. The AI coach is named **Ozzie** — he gives voice-based coaching via ElevenLabs TTS, tracks workouts (running + lifting), monitors recovery, and delivers a daily morning brief. Think: a smart coach who knows your body and talks to you like a real person.

**Monetization:** Freemium + OSPREY+ subscription ($9.99/mo or $89.99/yr via RevenueCat)  
**Target user:** Beginner and Advanced modes (user picks at onboarding)  
**Timeline:** Personal build, 3–6 months to MVP  
**Platform:** iOS first, Android later

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 52 |
| Navigation | expo-router v4 (file-based routing) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| State | Zustand v5 |
| Server state | TanStack Query v5 |
| Voice | ElevenLabs TTS (two profiles: workout, ambient) |
| Audio playback | expo-av |
| Subscriptions | RevenueCat (not yet configured) |
| Forms | react-hook-form + zod |
| Build/deploy | EAS (Expo Application Services) |

---

## Apple Developer Info

| Field | Value |
|---|---|
| Team ID | `8YVWCVPW8J` |
| Bundle ID | `com.SillyGoose.OSPREY` |
| Developer name | Augustas Johnson *(change to company name before App Store launch)* |
| EAS Project ID | `REPLACE_WITH_EAS_PROJECT_ID` — run `eas init` to fill this in |
| App Store Connect App ID | `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` — register app on ASC first |

---

## Supabase

| Field | Value |
|---|---|
| Project URL | `https://jslbutpmgoushkzcghtg.supabase.co` |
| Database | Live — 26 tables migrated, RLS enabled on all user-owned tables |
| Migration file | `Project OSPREY/001_initial_schema.sql` |

**26 tables across 10 domains:**
users, user_settings, user_mode_preferences, workout_sessions, workout_laps, workout_sets, exercises, training_plans, training_plan_weeks, training_plan_days, training_plan_exercises, daily_summaries, recovery_scores, ozzie_interactions, ozzie_preferences, body_metrics, nutrition_logs, nutrition_targets, music_sessions, music_preferences, social_connections, challenges, challenge_participants, achievements, user_achievements, notification_queue

Also includes: `v_daily_summary` computed view (used by Ozzie's nightly cron), exercise seed data (12 exercises), auto-`updated_at` trigger on all tables.

---

## Environment Variables

File: `OSPREY-app/.env.local` (never commit — in .gitignore)

```
EXPO_PUBLIC_SUPABASE_URL=https://jslbutpmgoushkzcghtg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (full key in file)

EXPO_PUBLIC_OPENAI_API_KEY=        ← not yet filled in
EXPO_PUBLIC_ELEVENLABS_API_KEY=    ← not yet filled in (waiting on voice casting)
EXPO_PUBLIC_OZZIE_VOICE_ID=        ← not yet filled in
EXPO_PUBLIC_REVENUECAT_IOS_KEY=    ← not yet filled in

EXPO_PUBLIC_APP_ENV=development
```

---

## Project File Structure

```
OSPREY-app/
├── app/
│   └── index.tsx              ← STUB — just says "Hello World", needs to be replaced
├── assets/
│   └── images/
│       ├── icon.png           ← placeholder 1x1 PNG — replace with real assets
│       ├── splash.png         ← placeholder
│       ├── adaptive-icon.png  ← placeholder
│       └── favicon.png        ← placeholder
├── src/
│   ├── constants/
│   │   └── colors.ts          ← ✅ Full OSPREY color token system
│   ├── screens/
│   │   ├── DailySummary.tsx   ← ✅ Built — frosted glass, Body Battery tank, Ozzie note
│   │   └── SignIn.tsx         ← ✅ Built — sign in / sign up toggle, wired to authStore
│   ├── services/
│   │   ├── supabase.ts        ← ✅ Built — Supabase client with AsyncStorage session
│   │   └── ozzie-audio.ts     ← ✅ Built — ElevenLabs TTS, two profiles, on-device cache
│   └── store/
│       └── authStore.ts       ← ✅ Built — Zustand auth store, initialize/signIn/signUp/signOut
├── .env.local                 ← ✅ Supabase keys filled in, others blank
├── .env.example               ← ✅ Safe template for git
├── .gitignore                 ← ✅ Excludes node_modules, .expo, .env.local, ios/, android/
├── app.json                   ← ✅ Bundle ID, permissions, HealthKit entitlements, EAS config
├── eas.json                   ← ✅ dev/preview/production build profiles
├── package.json               ← ✅ All deps installed (react@18.2.0, RN 0.76.5, Expo ~52)
└── tsconfig.json               ← ✅ Standard Expo TS config
```

---

## Color Tokens (src/constants/colors.ts)

| Token | Hex | Use |
|---|---|---|
| `Colors.teal` | `#00c8c8` | Primary brand, CTAs |
| `Colors.gold` | `#c89a00` | Secondary accent |
| `Colors.navy` | `#1B3A5C` | Deep accent |
| `Colors.bg` | `#060912` | Screen background |
| `Colors.bgCard` | `#0d1526` | Card/input background |
| `Colors.border` | `#1e2d45` | Borders |
| `Colors.textPrimary` | `#e8edf5` | Main text |
| `Colors.textMuted` | `#6b7fa3` | Secondary text |
| `Colors.green` | `#4cde80` | Success / good recovery |
| `Colors.amber` | `#f5a623` | Warning / moderate |
| `Colors.red` | `#ff4d6a` | Alert / low battery |

Design language: **frosted glass** — dark navy backgrounds, teal accents, translucent cards with subtle borders.

---

## What's Been Built (Ready to Wire Up)

### `src/screens/SignIn.tsx`
- Sign in / sign up toggle
- Calls `useAuthStore().signIn()` and `signUp()`
- Shows loading spinner and error messages
- OSPREY teal wordmark + tagline: *"Your coach, your hype man, your guy."*

### `src/screens/DailySummary.tsx`
- Full daily home screen matching the wireframe
- `BodyBatteryTank` component — vertical fill, color-coded green/amber/red
- Recovery card, session card with Ozzie's note, weekly mileage progress bar
- 5-item bottom nav (Home, Workout, Log, Stats, Settings)
- Props-driven — needs to be connected to real Supabase data via `v_daily_summary`

### `src/store/authStore.ts`
- `initialize()` — call once on app launch to restore session
- `signUp(email, password, displayName)` — creates Supabase auth user + inserts `users` row
- `signIn(email, password)`
- `signOut()`

### `src/services/supabase.ts`
- Supabase client ready — uses `.env.local` vars

### `src/services/ozzie-audio.ts`
- `ozzieSpeak(text, profile)` — 'workout' or 'ambient' profile
- `ozzieStop()` — interrupt mid-speech
- `ozziePrewarm()` — pre-cache 5 common mid-run cues at launch
- **Won't fire until `EXPO_PUBLIC_ELEVENLABS_API_KEY` and `EXPO_PUBLIC_OZZIE_VOICE_ID` are filled in** — gracefully skips with a console.warn in the meantime

---

## What Needs to Be Built Next (Priority Order)

### 1. Wire up expo-router navigation — `app/` directory
This is the most critical gap. The `app/index.tsx` is a stub. Build out:

```
app/
├── _layout.tsx          ← Root layout: initialize auth, set up fonts, splash screen
├── index.tsx            ← Auth gate: redirect to (auth) or (tabs) based on session
├── (auth)/
│   └── sign-in.tsx      ← Import and render src/screens/SignIn.tsx
└── (tabs)/
    ├── _layout.tsx      ← Bottom tab bar layout
    ├── index.tsx        ← Daily Summary (home tab)
    ├── workout.tsx      ← Workout tab (not built yet)
    ├── log.tsx          ← Log tab (not built yet)
    ├── stats.tsx        ← Stats tab (not built yet)
    └── settings.tsx     ← Settings tab (not built yet)
```

The root `_layout.tsx` must call `useAuthStore().initialize()` on mount.

### 2. Real data in DailySummary
Connect `DailySummary.tsx` to Supabase. Query `v_daily_summary` for the logged-in user. The view already exists in the DB. Use TanStack Query for fetching.

### 3. Active Workout Screen (Running)
- GPS map view using `expo-location` + `react-native-maps`
- Live stats: pace, distance, time, heart rate
- Ozzie mid-run cue button
- Pause/stop controls

### 4. Active Workout Screen (Lifting)
- Exercise list with set/rep/weight logger
- Rest timer
- Ozzie set encouragement

### 5. Onboarding Flow
Screen sequence:
1. Welcome / OSPREY intro
2. Name input (what should Ozzie call you?)
3. **Mode Select** — Beginner vs Advanced (this replaces the old "Fitness Level" screen)
4. Goals
5. Connect Apple Health

### 6. Post-Workout Recap Screen
- Run: mile splits, pace chart, zone breakdown, Ozzie debrief
- Lift: exercise log, volume summary, PRs flagged
- PR celebration state

### 7. RevenueCat Integration
- Install `react-native-purchases`
- Configure with `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- Gate OSPREY+ features behind entitlement check

---

## Known Issues / Things to Watch

- **Placeholder assets** — `assets/images/` contains 1x1 pixel PNGs. Replace with real OSPREY icon/splash before any TestFlight build.
- **`eas.json` projectId** — still says `REPLACE_WITH_EAS_PROJECT_ID`. Run `eas init` in the OSPREY-app directory to generate and auto-fill this.
- **App Store Connect App ID** — register the app on ASC, then update `eas.json` → `submit.production.ios.ascAppId`.
- **Node version** — must use Node 20. Node 22+ breaks Expo SDK 52. Use `nvm use 20` before running expo commands. Run `nvm alias default 20` to make it permanent.
- **npm install flag** — always use `--legacy-peer-deps` when adding new packages.
- **30 audit vulnerabilities** — all in Expo's own toolchain deps. Do NOT run `npm audit fix --force`. They'll resolve naturally with future Expo SDK updates.
- **Developer name** — `app.json` currently has "Augustas Johnson" in some places. Change to a company name before App Store submission.

---

## Wireframes Reference

File: `Project OSPREY/OSPREY_Wireframes.html` — open in any browser.

Tabs:
- **Daily Summary** — home screen, Body Battery, recovery, Ozzie note
- **Onboarding Flow** — 5 screens including Mode Select as screen 3
- **Active Workout** — running GPS view with urban SVG map
- **Post-Workout Recap** — run recap, lift recap, PR celebration

Design language from wireframes should be translated 1:1 into React Native using the color tokens in `colors.ts`.

---

## ElevenLabs / Ozzie Voice

Voice casting brief: `Project OSPREY/Ozzie_ElevenLabs_Casting_Brief.md`

- Male, late 20s–mid 30s, neutral American accent
- Warm, confident, direct — not a hype robot
- Two configs in the brief: `ozzie-workout` (Turbo v2.5) and `ozzie-ambient` (Multilingual v2)
- Once voice is cast, fill in `.env.local`: `EXPO_PUBLIC_ELEVENLABS_API_KEY` and `EXPO_PUBLIC_OZZIE_VOICE_ID`
- The audio service (`ozzie-audio.ts`) is fully built and ready — just needs the keys

---

## GitHub / Supabase

- **GitHub repo**: Not yet created. Create a private repo, push `OSPREY-app/` as root. Make sure `.env.local` is in `.gitignore` (it is).
- **Supabase GitHub integration**: Can be connected via Supabase dashboard → Settings → Integrations for database branching on PRs.

---

## Immediate First Steps in Cursor

1. Open `OSPREY-app/` folder in Cursor
2. Run `nvm use 20` in the integrated terminal
3. Build `app/_layout.tsx` — root layout with auth initialization
4. Build `app/index.tsx` — auth gate (redirect to sign-in or tabs)
5. Build `app/(auth)/sign-in.tsx` — wrapper for `SignIn.tsx`
6. Build `app/(tabs)/_layout.tsx` — tab bar
7. Build `app/(tabs)/index.tsx` — wrapper for `DailySummary.tsx` with mock data first
8. Run `npx expo start --ios` — should show the Sign In screen
9. Create a test account, confirm it lands on Daily Summary

That's a working shell of the app. Everything else builds on top of it.
