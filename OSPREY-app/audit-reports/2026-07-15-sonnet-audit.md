# OSPREY Comprehensive Audit — 2026-07-15

Branch: `claude/eager-gauss-e9gkkr` (off `main` @ `2d01634`)
Run: fully autonomous scheduled routine, no human present. Model: Sonnet 5, with four Opus-model subagents for the code-quality/UX/feature-testing analysis passes and a fifth Opus subagent for final verification.

## Scope

Full-repo audit covering `OSPREY-app/` (Expo/React Native), `webapp/` (Vite/React analyst surface), and `website/` (Astro marketing site). Dependencies were not installed in any of the three packages at session start — installed all three (`npm install`) to get real `typecheck`/`lint`/`test` signal rather than static-only review.

**Baseline (before any fixes):** OSPREY-app — 0 typecheck errors, 0 lint errors (5 pre-existing warnings), 136/136 tests passing. webapp — 0 typecheck errors, 85/85 tests passing. website — 0 `astro check` errors, 5/5 tests passing. This is a healthy repo; a prior nightly audit (`2026-07-02-fable-audit.md`) already landed 8 fixes, and two of its "not implemented" recommendations have since shipped independently: the trend-based proactive deload (`usePlanDeload.ts`, uses `computeAcwrTrend`) and a real watch bridge scaffold (`targets/watch/*.swift`, replacing the old fully-stubbed `watch-connectivity.ts`).

## Fixes implemented (10 commits' worth of changes, 15 files, +106/-44 lines)

### 1. Coaching-engine correctness (HIGH)

**Peak-phase volume factor was inverted** — `src/services/coaching/periodization.ts`. `PHASE_FACTOR.Peak` was `1.1`, higher than `Build`'s `1.0`, directly contradicting every sport blueprint (e.g. `running.md`: Build = "mileage peaks", Peak = "volume easing", Taper = "volume cut"). A race-goal athlete in the Peak block was getting the *highest* training volume of the entire macrocycle instead of easing toward taper — live in production, since `phase` comes from the real `computeRacePhase()` and `targetWeeklyLoad` ships straight to `ozzie-generate-plan`. Fixed to `0.9` (between Base's `0.85` and Build's `1.0`). Added a regression test asserting Peak load < Build load so this class of bug can't silently reappear.

### 2. Coaching-engine correctness (LOW)

- **Runner protein ceiling too high** — `fuel.ts`: `bodyWeightKg*2.2` → `*2.0`, matching `running.md`'s stated 1.6–2.0 g/kg/day (2.2 is the general cross-sport `_index.md` figure, not running-specific). Test updated to match.
- **Stale doc citation** — `plan.ts`: removed a comment referencing `audit-reports/2026-07-10-audit.md`, which doesn't exist in this repo.

### 3. Account/session correctness (MEDIUM)

- **Cross-account entitlement leak** — `src/hooks/useSubscription.ts`'s module-level cache never re-ran after mount except when the paywall explicitly called `refreshSubscription()`. Sign out and sign back in as a different user on the same device (without killing the app), and every OSPREY+ gate across the app kept showing the *previous* account's entitlement. Fixed in `authStore.ts`: `refreshSubscription()` now fires whenever `onAuthStateChange` reports an actual identity change.
- **Tab navigator blanked hourly** — `authStore.ts`'s `onAuthStateChange` unconditionally reset `profileReady: false` and refetched the profile on *every* auth event, including `TOKEN_REFRESHED` (fires ~hourly and on app foreground). Since `profileReady` gates the whole tab navigator, users saw a blank loading screen roughly once an hour. Fixed: same-identity events (token refresh, user-metadata update) now swap the session/user in place without touching `profileReady`.

### 4. Onboarding UX (HIGH)

- **Progress bar mislabeled steps for the most common path** — `OnboardingShell.tsx` + all five onboarding screens hardcoded `totalSteps={5}`, but the baseline-anchor screen (step 4) only renders for run/swim/rowing goals. The default goal is `hybrid`, so the majority of users saw the bar jump 3/5 → 5/5 and never saw "Step 4 of 5." Added `onboardingTotalSteps(goal)` (`services/coaching/baseline.ts`) and wired it through `welcome/name/mode/goals/health.tsx` so step count is correct on both paths.
- **No keyboard avoidance in onboarding** — the footer Continue button was a sibling of the ScrollView with no `KeyboardAvoidingView`, unlike `SignIn.tsx`'s equivalent form. On `name.tsx` (autofocused) the keyboard could cover Continue with no obvious way to proceed. Wrapped `OnboardingShell` in `KeyboardAvoidingView` (same `padding`/`height` pattern as SignIn) and added `returnKeyType`/`onSubmitEditing` to the name field.

### 5. Onboarding/paywall UX (MEDIUM)

- **Paywall leaked an implementation detail off-voice** — `paywall.tsx`: "Adaptive weekly training plans powered by GPT-4o-mini" → dropped the model name, per CLAUDE.md's athlete-facing plain-language convention.
- **Day-picker touch targets under 44pt** — `goals.tsx`'s eight weekly-schedule day buttons were 34×34 with 6px gaps. Added `hitSlop` to bring the effective tap target closer to the 44pt minimum without a layout change.

### 6. Documentation

- `webapp/README.md`'s Roadmap section claimed nutrition/recipes and Training Zones "not started" — both have shipped (Fuel Desk, recipe builder, Training Zones editor all present with passing tests). Corrected.

**Verification:** after all fixes — OSPREY-app typecheck 0 errors, lint 0 errors/5 pre-existing warnings, **137/137 tests passing** (136 + 1 new). An independent Opus subagent re-read the full diff and re-ran typecheck/lint/test; verdict PASS on all 11 fixes, no regressions, no unintended side effects found.

## Findings documented but NOT fixed (needs human judgment / larger scope)

- **Running fuel calculator applied to every sport** (`envelope.ts:76` calls `computeRunningFuel` unconditionally) — swim/rowing athletes currently get running-derived in-session carb targets (marathon 60–90 g/hr) instead of their own blueprint's numbers (swimming.md: 25–60/90 g/hr; rowing.md: 30–60 g/hr). Also, `computeRunningFuel` never reaches the 10–12 g/kg peak-week carb tier every blueprint defines. Not fixed tonight: this needs new per-sport fuel calculators (only running's exists today) built against each blueprint's fueling section — a multi-file feature addition, not a one-line correction, and the coaching engine currently only computes real zones for run/swim/rowing anyway (other sports get `zones: null`), so sport coverage is a known, larger gap. **Recommend a dedicated pass** building `computeSwimFuel`/`computeRowingFuel`/etc. and routing `envelope.ts` by `blueprintSport`.
- **Progression cap dormant landmine** — `periodization.ts`'s +10%/week cap coming out of a recovery week is currently a no-op because `build-envelope.ts` hardcodes `prevWeekLoad: null`; the moment real week-over-week load threading lands, every 3:1 cycle will ratchet load permanently downward after each recovery week. Flagging for whoever wires up `prevWeekLoad`.
- **Swim zone-parity test coverage gap** — `webapp/tests/zone-parity.test.ts` guards `swimPaceZones`/`runningPaceZones`/`rowingTrainingZones` against drift from the mobile originals, but not `computeCSSPer100`/`formatMinSec`/`midpoint`/`formatRunningPace`, which the webapp also duplicates. Recommend extending the parity assertions.
- **Ask Ozzie is a read-only placeholder behind a chat-looking entry point** (`ask-ozzie.tsx`) — the Home header avatar looks tappable-for-chat; the screen says two-way conversation isn't live yet. Relabel or hide until chat ships.
- **Paywall has no loading/error state for RevenueCat offerings** (`paywall.tsx:107-113`) — a slow/failed `getOfferings()` silently leaves the CTA priceless with no spinner or retry.
- **No back control in onboarding** and **race-phase track is color-only** (`plan-preview.tsx`) — both low-severity, noted for a future pass.
- `expo-secure-store`/Sentry/watch-bridge gaps flagged in the 2026-07-02 audit are now resolved (session storage encrypted via `secure-session-storage.ts`, Sentry initialized behind a DSN flag, native Swift watch target exists) — confirmed, not re-flagged.

## Feature recommendations

Three new features to differentiate OSPREY from single-sport AI-plan apps (Runna), recovery-only wearables (Whoop), and manual structured-plan tools (TrainingPeaks/Final Surge) — none of which combine a periodized multi-sport AI plan with live race-day pacing, adaptive in-session coaching, or automatic peer benchmarking.

### 1. Training Twin — anonymized cohort benchmarking

**What:** Show each athlete how their current block compares to similar athletes (same sport, goal-event tier, and experience level) without requiring them to add friends — "athletes like you following a similar marathon build are averaging 8% more weekly volume at this point" or "your ACWR trend is healthier than 70% of your cohort this week." Solves the "training alone with an AI coach has no social proof" gap that Strava fills with a follow graph OSPREY doesn't have and shouldn't build (privacy, cold-start).
**Scope:** A nightly aggregation job (Supabase edge function or scheduled query) buckets athletes by `(blueprintSport, goal event tier, experience_tier, plan week-number)` and computes anonymized percentile stats (weekly load, ACWR, adherence %) per bucket — never raw per-athlete data, opt-out flag on `users`. A new `usePerformance`-adjacent hook (`useCohortBenchmark`) fetches the athlete's bucket stats; a card on Stats/Home surfaces one comparison at a time, reusing the existing insight-card visual language (`usePlanAdaptation`'s alert styling).
**Effort:** Medium (2–3 weeks) — mostly a new aggregation query + one hook + one card; no new native code, reuses existing load/ACWR calculators server-side.
**Integration points:** `services/performance.ts` (ACWR/load already computed), a new Supabase materialized view or scheduled function, `(tabs)/stats.tsx` and `(tabs)/index.tsx` for card placement.

### 2. Race-Day Command Center — live watch-pushed pacing

**What:** Turn the existing static predictors (Hyrox compromised-split pacing, Riegel race-time prediction) into a *live* race-day tool: push target splits to the Apple Watch face in real time, recalculating the target for the *remaining* distance/stations whenever the athlete is ahead/behind pace or weather conditions (already fetched via `weather.ts`) change. This is the single most requested category of feature in endurance apps (Garmin/Stryd do it for running pace alone) and no competitor does it across run+hyrox+multi-sport with an AI-generated plan behind it.
**Scope:** Build on the native Swift watch target that already exists (`targets/watch/*.swift`, currently a scaffold) — add a `WCSession`-based live data channel from `useRunTracking.ts` (already tracks GPS/pace in real time) to the watch face, and a "remaining-distance re-pace" function reusing the existing Hyrox compromised-split calculator and Riegel predictor with the athlete's actual elapsed splits substituted in.
**Effort:** Large (4–6 weeks) — this is the biggest lift of the three: requires `WCSessionDelegate` wiring on both sides, background delivery for the always-on watch face, and physical-device testing (not possible in this sandboxed environment). Should be scoped as its own dedicated project, not a quick pass.
**Integration points:** `targets/watch/*.swift`, `src/hooks/useRunTracking.ts`, `src/services/weather.ts`, the Hyrox/running calculators in `src/services/calculators/`.

### 3. Adaptive live coaching cues (biometric-driven, not canned)

**What:** Evolve Ozzie's existing mid-workout cue system (`useCueBanner`, `ozzie-audio.ts`) from static per-workout-type messages into cues generated from real-time signal: HR drift vs. target zone, pace fade vs. planned split, and ACWR trend — "you're drifting into zone 4 ten minutes early, ease back" instead of a generic interval callout. This is what actually justifies the "AI coach" positioning during the workout itself, not just at plan-generation time.
**Scope:** A lightweight rules engine (pure function, easily unit-tested like the existing coaching calculators) that takes the live `useRunTracking` stream + the session's planned zone and returns a cue-or-null each N seconds; wire its output into the existing `showCueBanner`/audio-cue pipeline so no new UI surface is needed. Ship text-cue-only first (voice is already built but disabled pending the ElevenLabs paid plan per `OZZIE_VOICE_ENABLED`), flip voice on when that's resolved.
**Effort:** Medium (2–3 weeks) for the text-cue version; voice path is already wired and just needs the account upgrade.
**Integration points:** `src/hooks/useRunTracking.ts`, `src/hooks/useCueBanner.ts`, `src/services/ozzie-audio.ts`, `app/workout/run.tsx` / `endurance.tsx`.
