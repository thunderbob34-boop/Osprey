# OSPREY — Launch Checklist

*Everything that must be done before submitting to the App Store.*
*Bundle ID: `com.SillyGoose.OSPREY` · EAS Project: `efab587d-56da-4b0d-acec-e697c48b921a`*

---

## Supabase

- [ ] Apply migration 011 (race logistics) — `supabase db push` or run `011_race_logistics.sql` in Supabase Dashboard → SQL Editor
- [ ] Apply migration 012 (race retrospective) — `012_race_retrospective.sql`
- [ ] Apply migration 013 (friend race sync) — `013_friend_race_sync.sql`
- [ ] Apply migration 014 (challenges) — `014_challenges.sql`
- [ ] Deploy `ozzie-nutrition-coach` — `supabase functions deploy ozzie-nutrition-coach`
- [ ] Deploy `ozzie-generate-plan` — `supabase functions deploy ozzie-generate-plan`
- [ ] Deploy `ozzie-race-briefing` — `supabase functions deploy ozzie-race-briefing`
- [ ] Deploy `ozzie-race-retro` — `supabase functions deploy ozzie-race-retro`
- [ ] Deploy `ozzie-daily-brief` — `supabase functions deploy ozzie-daily-brief`
- [ ] Verify `OPENAI_API_KEY` secret is set in Supabase Dashboard → Edge Functions → Secrets
- [ ] Verify `ELEVENLABS_API_KEY` secret is set in Supabase Dashboard → Edge Functions → Secrets
- [ ] Enable RLS on all tables — verify in Supabase Dashboard → Table Editor → each table

---

## RevenueCat

- [ ] Create OSPREY+ subscription group in App Store Connect
- [ ] Create two products: `$9.99/month` and `$89.99/year`
- [ ] Set entitlement ID to `osprey_plus` in RevenueCat dashboard
- [ ] Attach both products to the `osprey_plus` entitlement; set default Offering to annual
- [ ] Add App Store Connect API key to RevenueCat
- [ ] Test purchase flow on a TestFlight build with a sandbox Apple account
- [ ] Test "Restore Purchases" flow

---

## App Store Connect

- [ ] Register app with bundle ID `com.SillyGoose.OSPREY`
- [ ] Fill `ascAppId` in `eas.json` → `submit.production.ios.ascAppId` (currently `REPLACE_WITH_APP_STORE_CONNECT_APP_ID`)
- [ ] Confirm `appleTeamId` in `eas.json` is correct (`8YVWCVPW8J`)
- [ ] Enable HealthKit capability in App Store Connect → App → Capabilities
- [ ] Upload screenshots — required sizes: 6.7" (iPhone 15 Pro Max), 6.5" (iPhone 14 Plus), 5.5" (iPhone 8 Plus)
- [ ] Fill app name from `metadata/app-store-name.txt`
- [ ] Fill subtitle from `metadata/subtitle.txt`
- [ ] Fill description from `metadata/description.txt`
- [ ] Fill keywords from `metadata/keywords.txt`
- [ ] Fill promotional text from `metadata/promotional-text.txt`
- [ ] Fill "What's New" from `metadata/release-notes-1.0.txt`
- [ ] Set age rating to 4+
- [ ] Add real privacy policy URL (replace placeholder in `metadata/privacy-url.txt`)
- [ ] Add real support URL (replace placeholder in `metadata/support-url.txt`)
- [ ] Complete App Privacy data types declaration:
  - Health & Fitness (HealthKit: heart rate, workouts, body metrics)
  - Location (GPS run tracking)
  - User Content (food logs, workout notes)
  - Identifiers (user account)
  - Third-party processors: Supabase, OpenAI, ElevenLabs, RevenueCat
- [ ] Change developer/owner display name from "Augustas Johnson" to intended company name before submission
- [ ] Submit for review

---

## ElevenLabs

- [ ] Listen to current Ozzie voice output (`EXPO_PUBLIC_OZZIE_VOICE_ID`) on a physical device
- [ ] Confirm voice matches the casting brief (`Ozzie_ElevenLabs_Casting_Brief.md`) — warm, Kronk-spirited, not robotic
- [ ] If voice needs adjustment: finish casting in ElevenLabs and update `EXPO_PUBLIC_OZZIE_VOICE_ID` in `.env.local`
- [ ] Verify `ELEVENLABS_API_KEY` is set in Supabase edge function secrets (not just `.env.local`)
- [ ] Confirm ElevenLabs plan has sufficient monthly character quota for real-world usage
- [ ] (Optional) Commission Ozzie custom voice clone for a fully original persona

---

## EAS Build

- [ ] Run `eas build --platform ios --profile production`
- [ ] Confirm build completes without errors in EAS dashboard
- [ ] Run `eas submit --platform ios` after successful build
- [ ] Distribute to TestFlight internal testers before App Store submission

---

## Testing

- [ ] Invite TestFlight internal testers; confirm they can install the build
- [ ] Run through full onboarding on a clean account (sign up → complete profile → plan generated)
- [ ] Test OSPREY+ purchase flow with a sandbox Apple account
- [ ] Test "Restore Purchases" on a second device with the same sandbox account
- [ ] Test GPS run: start, live Ozzie coaching cues firing, stop, route map renders
- [ ] Test lift log: add exercise, log sets, rest timer, volume history
- [ ] Test food log: barcode scan, photo log, manual entry
- [ ] Test daily brief: fires correctly in the morning with relevant coaching note
- [ ] Test race hub: add race, view logistics, complete post-race retrospective
- [ ] Test group challenge: create challenge, confirm friend sync works
- [ ] Test HealthKit sync: workouts writing to Health app, reading heart rate
- [ ] Test Calendar blocking: toggle on, confirm "OSPREY: ..." events appear on device calendar
- [ ] Test offline behavior: load app, enable airplane mode, confirm Home/Stats/Log render from cache
- [ ] Verify app icon and splash screen are not placeholder assets (check physical device)

---

## Pre-Submission Sanity

- [ ] `version` in `app.json` is `"1.0.0"` and `buildNumber` is `"1"` — confirmed
- [ ] All `UIBackgroundModes` in `app.json` are correct (no duplicates — there are currently duplicates in `location` and `audio`; clean those up before production build)
- [ ] `associatedDomains` in `app.json` has no duplicate entries (currently duplicated — clean up before production build)
- [ ] Privacy policy URL is live and publicly accessible before submitting for review
- [ ] App does not reference internal/dev tooling or placeholder copy visible to users
