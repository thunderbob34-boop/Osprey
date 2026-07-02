# OSPREY — iOS Project Setup Guide
### From zero to running on your iPhone

---

## What you have
- Apple Developer Program ✅
- Team ID: `8YVWCVPW8J`
- Bundle ID: `com.SillyGoose.OSPREY`
- Expo project scaffold in `/OSPREY-app/`

---

## Step 1 — Install prerequisites

Open Terminal and run these one at a time:

```bash
# Install Node.js (if not already installed — use the LTS version)
# Download from https://nodejs.org or via Homebrew:
brew install node

# Install Expo CLI globally
npm install -g expo-cli

# Install EAS CLI (handles builds and App Store submission)
npm install -g eas-cli

# Log into your Expo account (create one free at expo.dev if needed)
eas login
```

---

## Step 2 — Set up the project

```bash
# Navigate to the OSPREY app folder
cd "/Users/gusjohnson/Documents/App Development/OSPREY 1.0/Project OSPREY/OSPREY-app"

# Install all dependencies
npm install

# Link the project to EAS (creates your EAS project ID)
eas init

# When prompted, choose: Create a new EAS project
# Name it: OSPREY
# Copy the project ID it gives you
```

After `eas init` gives you a project ID, open `app.json` and replace `REPLACE_WITH_EAS_PROJECT_ID` with it.

---

## Step 3 — Set up environment variables

```bash
# Copy the example env file
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase URL and anon key (from your Supabase project dashboard). Leave the others blank for now — you'll add them as you set up each service.

---

## Step 4 — Register your app on App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps → +** (top left)
3. Fill in:
   - **Platform:** iOS
   - **Name:** OSPREY
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** `com.SillyGoose.OSPREY` ← select from dropdown (may need a minute to appear after EAS init)
   - **SKU:** `osprey-ios-001` (internal only, never shown publicly)
4. Click **Create**
5. Copy the **App ID** number from the URL (it's the number in `appstoreconnect.apple.com/apps/XXXXXXXX`)
6. Open `eas.json` and replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` with that number

---

## Step 5 — Build and run on iOS Simulator

```bash
# Build for simulator (runs locally, no Apple account needed for this step)
eas build --profile development --platform ios --local

# Or just run directly in Expo Go for fast iteration:
npx expo start --ios
```

---

## Step 6 — Build for your physical iPhone

```bash
# This builds a development client you can install on your actual device
eas build --profile development --platform ios

# EAS will:
# 1. Ask if you want it to handle signing automatically → say YES
# 2. Create a provisioning profile tied to your Team ID (8YVWCVPW8J)
# 3. Register your device's UDID if needed
# 4. Build the app in the cloud
# 5. Give you a QR code to install it on your iPhone
```

---

## Step 7 — Submit to App Store (when ready, months from now)

```bash
eas build --profile production --platform ios
eas submit --platform ios
```

EAS will handle code signing, certificates, and upload to App Store Connect automatically using your Team ID.

---

## File structure reference

```
OSPREY-app/
├── app.json              ← Expo config, bundle ID, permissions
├── eas.json              ← Build profiles, Apple Team ID
├── package.json          ← All dependencies
├── tsconfig.json         ← TypeScript config
├── .env.example          ← Template for environment variables
├── .env.local            ← Your actual secrets (never commit this)
├── .gitignore
├── assets/
│   ├── images/           ← icon.png, splash.png, adaptive-icon.png
│   └── fonts/            ← custom fonts go here
└── src/
    ├── screens/          ← One file per screen (DailySummary, Workout, etc.)
    ├── components/       ← Reusable UI components (OzzieCard, BodyBattery, etc.)
    ├── navigation/       ← Tab navigator, stack navigators
    ├── hooks/            ← Custom React hooks (useWorkout, useRecovery, etc.)
    ├── services/
    │   └── supabase.ts   ← Supabase client (already configured)
    ├── store/            ← Zustand global state stores
    ├── utils/            ← Helper functions
    └── constants/
        └── colors.ts     ← Design system colors (already done)
```

---

## Keys you still need to collect

| Service | Where to get it | Priority |
|---------|----------------|---------|
| Supabase URL + anon key | supabase.com → your project → Settings → API | Do this first |
| OpenAI API key | platform.openai.com → API keys | Phase 1 |
| ElevenLabs API key | elevenlabs.io → Profile → API keys | Phase 1 |
| RevenueCat iOS key | app.revenuecat.com → your project | Phase 1 |
| App Store Connect App ID | appstoreconnect.apple.com (Step 4 above) | Do this soon |

---

*OSPREY iOS Setup Guide · June 2026 · Team ID: 8YVWCVPW8J · Bundle: com.SillyGoose.OSPREY*
