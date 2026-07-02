# OSPREY — External / Human To-Do List

*Things Claude can't do from code — they need you, an account dashboard, a paid service, or a device.*
*Last updated: 2026-07-02 (icon/ascAppId items verified and corrected by nightly audit)*

Legend: 🔴 blocks the new features from working · 🟡 needed before TestFlight/launch · 🟢 nice-to-have / later

---

## 1. Apply database changes to Supabase 🔴

Two new migrations were written this session but **have not been run** against the live project (`jslbutpmgoushkzcghtg`). The new features will throw "relation does not exist" until they're applied.

- [ ] Run `009_supplement_reminders.sql` (supplement/medication reminders table)
- [ ] Run `010_body_metrics.sql` (weight log for adaptive nutrition)
- [ ] Apply in order, via Supabase Dashboard → SQL Editor, or `supabase db push` if using the CLI.
- [ ] Confirm RLS is on and the `service_role` grant took (both scripts include it).

## 2. Deploy the edge functions 🔴

`ozzie-nutrition-coach` was **modified** (weight-trend logic) and must be redeployed. The others should be deployed too if they aren't already.

- [ ] `supabase functions deploy ozzie-nutrition-coach`  ← changed this session
- [ ] Verify these are deployed: `ozzie-daily-brief`, `ozzie-generate-plan`, `ozzie-meal-photo`, `ozzie-voice-log`
- [ ] Set the function secret **`OPENAI_API_KEY`** in Supabase → Edge Functions → Secrets. The OpenAI key is currently **empty** and every Ozzie AI feature (plan generation, daily brief, nutrition tips, meal photo, voice log) calls OpenAI server-side. Nothing works without it.
  - `supabase secrets set OPENAI_API_KEY=sk-...`
- [ ] Confirm OpenAI account has billing/credits enabled.

## 3. New native build required 🔴

Two **native modules** were added (`expo-calendar`, `expo-sqlite`) on top of the existing native deps (`react-native-health`, `react-native-maps`, `react-native-purchases`). These do **not** work in Expo Go or in an old dev-client binary — you need a fresh build.

- [ ] `npx expo prebuild --clean` then `npm run build:dev` (EAS dev client), or run `npm run ios` on a Mac with Xcode.
- [ ] Reinstall the dev client on your device before testing calendar blocking / offline mode.
- [ ] (Use Node 20 — Node 22+ breaks Expo SDK 52.)

---

## 4. Ozzie's voice (ElevenLabs) 🟡

The audio service is fully built and the API key + voice ID are already set in `.env.local`. What remains is a human judgment call.

- [ ] Listen to the current `EXPO_PUBLIC_OZZIE_VOICE_ID` output and confirm it matches the casting brief (`Ozzie_ElevenLabs_Casting_Brief.md`) — warm, Kronk-spirited, not robotic.
- [ ] If not right, finish voice casting/tuning in ElevenLabs and update `EXPO_PUBLIC_OZZIE_VOICE_ID`.
- [ ] Confirm the ElevenLabs plan has enough monthly character quota for real usage.

## 5. Monetization — RevenueCat 🟡

Code gates OSPREY+ behind the entitlement id **`osprey_plus`** and expects an annual + monthly offering. The iOS API key is set in `.env.local`; the products are not configured.

- [ ] In App Store Connect: create the two subscription products — **$9.99/mo** and **$89.99/yr**.
- [ ] In RevenueCat: create entitlement `osprey_plus`, attach both products, build the default Offering (show **annual by default** per the plan).
- [ ] Verify the paywall purchase + restore flow on a real device with a sandbox account.

## 6. App Store Connect / release prep 🟡

- [ ] Register the app in App Store Connect (bundle id `com.SillyGoose.OSPREY`).
- [x] Fill in `eas.json` → `submit.production.ios.ascAppId` — done, set to `6785572381`.
- [ ] Confirm Apple Developer capabilities: HealthKit (entitlement already in `app.json`), and that Calendar usage strings are present (they are, added this session).
- [ ] Change the developer/owner name from "Augustas Johnson" to a company name before submission (per handoff).
- [ ] Verify real app icon & splash — **checked 2026-07-02: `icon.png` is actually 192x192/1.8KB (not ~60KB as previously noted here) and `splash.png` is a 1x1px placeholder.** `app.json`'s `icon` field was repointed to the existing 1024x1024 `icon-1024.png` this session (Apple/EAS requires a 1024x1024 source), but splash.png still needs real artwork before submission — it will currently ship a blank splash screen. `adaptive-icon.png` (Android) is a real 1024x1024 asset and looks fine.

---

## 7. Data / API accounts 🟢

- [ ] Food barcode lookup uses **OpenFoodFacts** (`world.openfoodfacts.org`) — public, **no key needed**. Just confirm it's acceptable for your coverage; consider USDA FoodData Central as a fallback later.
- [ ] (Phase 2) Music, gym locator, race auto-import APIs — not built yet; nothing to do now.

## 8. QA checklist once 1–3 above are done 🟢

- [ ] Sign in, complete onboarding, confirm a plan generates for the week.
- [ ] Add a supplement reminder → confirm a notification fires at the set time.
- [ ] Log weight a few times across days → confirm the nutrition tip mentions the trend and targets shift.
- [ ] Toggle Calendar Blocking on → confirm "OSPREY: …" events appear on your phone calendar.
- [ ] Put the phone in airplane mode after one online load → confirm Home/Stats/Log still render from cache.
- [ ] Add a race in the new Races screen → confirm countdown + goal pace, and "Link to plan".

---

## Quick status of what's already set (no action needed)
- ✅ Supabase URL + anon key — set in `.env.local`
- ✅ ElevenLabs API key + Ozzie voice id — set (quality check still pending, item 4)
- ✅ RevenueCat iOS key — set (products still need configuring, item 5)
- ✅ EAS `projectId` — set in `app.json`
