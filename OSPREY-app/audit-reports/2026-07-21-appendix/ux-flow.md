# OSPREY Mobile — IA / Navigation / First-Run Audit (2026-07-21)

Dimension: information architecture, navigation graph, onboarding, empty states, copy voice.
All paths relative to `/Users/gusjohnson/App Development/Osprey/OSPREY-app` unless absolute.
Benchmark citations refer to `/Users/gusjohnson/.claude/skills/hyrox-trainer-experience/` and
`/Users/gusjohnson/.claude/skills/hybrid-trainer-experience/`.

---

## 1. Full navigation graph (from grep of router.push/replace/Redirect across app/)

### Entry / auth / onboarding spine
- `app/index.tsx` → redirects: no session → `(auth)/sign-in`; incomplete profile → `(onboarding)/welcome`; else `(tabs)`.
- `(auth)/sign-in` (src/screens/SignIn.tsx) → sign in/up; `reset-password` reached only via emailed deep link.
- Onboarding chain: `welcome → name → mode → goals → (baseline | skip) → health → (tabs)` (health.tsx:44 `router.replace('/(tabs)')`).

### Tab bar (app/(tabs)/_layout.tsx) — 5 tabs
Home (`index`) · Workout · Log · Stats · Settings.

### Outbound edges per tab
- **Home** (`(tabs)/index.tsx`): Start Session → `/workout/{lift|hyrox|endurance|run}` (55-73); Activity icon → `/activity` (140); "Full week ›" → `/plan-preview` (145); Body-Battery empty card → `/(tabs)/settings` (146); BuildPlanBanner → `/preferences` (BuildPlanBanner.tsx:16). **Ask Ozzie edge commented out** (143-144).
- **Workout** (`(tabs)/workout.tsx`): 7 static sport cards → `/workout/*`; plan-adaptation banner → `/preferences` (115). No edge to plan, races, or calendar.
- **Log** (`(tabs)/log.tsx`): → `/food-scanner` (848). Everything else is in-screen forms.
- **Stats** (`(tabs)/stats.tsx`): nav chips → `/races` (228), `/challenges` (237), `/calendar` (246), `/routes` (255); upsell → `/paywall` (439); "View all ›" → `/calendar` (517).
- **Settings** (`(tabs)/settings.tsx`): → `/paywall` (354), `/supplements` (447), `/plan-preview` (525), `/preferences` (538), `/hyrox-quiz` (579, under "About & Support").

### Second-level edges
- `/activity` → `/friends` (activity.tsx:84). Friends reachable ONLY through Activity.
- `/races` → `/race-search` (891), `/paywall` (1016, 1090); race build-plan action (673, REC-001).
- `/race-search` → `/race-event` (212); `/race-event` → `/races` (88, 247), plan flow (171).
- `/calendar` day sheet → `/races` (206).
- `/plan-preview` empty state → `/preferences` (402); done → `(tabs)` (284).
- `/workout/*` live screens → `/workout/recap` on finish.

### Orphans
- **`app/ask-ozzie.tsx` — fully orphaned.** Sole entry point is commented out at `(tabs)/index.tsx:143-144`. If deep-linked, the screen itself is a dead end: "Two-way conversations with Ozzie aren't live yet" (ask-ozzie.tsx:35-38).

### Dead ends
- `ask-ozzie` (above).
- `hyrox-quiz` result card: only "Try Again" (hyrox-quiz.tsx:129-136) — no onward action to a Hyrox plan, stations, or races.
- `calendar` (fullScreenModal, ScreenHeader assumed back) is otherwise fine; `plan-preview` empty state got its Build-plan CTA in the F2 fix.

### Overloaded hub
- **Stats** fronts four whole product areas (Races, Challenges, Calendar, Routes) as chips above its own charts, PLUS the paywall upsell, lift analytics, predictors and recent workouts (stats.tsx:225-262, 437-451). Social is split across two hubs: Challenges under Stats, Friends under Home→Activity.

---

## 2. Onboarding audit (app/(onboarding)/*)

Order: `welcome (step 0/5, hidden bar) → name (1/5) → mode (2/5) → goals (3/5) → baseline (4/5, conditionally skipped) → health (5/5)`.

- **What's asked:** name → experience tier (3 cards) → primary goal (10 options + run/lift day pickers) → optional sport-specific baseline (threshold anchors, ultra/hyrox/lift/crossfit params) → Apple Health connect. Finish calls `completeOnboarding` + best-effort `generateInitialPlan` (health.tsx:36-44) so the user usually lands on Home with a real plan. Genuinely strong flow: 90-second promise (welcome.tsx:22-23), skip affordances (baseline.tsx:308-310), plain-language tier descriptions (mode.tsx:23 "pace and effort, not TSS and CTL").
- **Sport promise:** the 10-goal grid (goals.tsx:10-21) includes Hyrox, CrossFit, rowing, ultra, cycling, swim — the 9-sport breadth IS visible, but only at step 3. `welcome` and `sign-in` show zero sport promise.
- **BUG-level gap: no triathlon.** `goals.tsx` GOALS and `src/types/onboarding.ts` `PrimaryGoal` both lack `'triathlon'`, while `app/preferences.tsx:49` offers "🏊 Triathlon / Multisport" and `src/services/coaching/goal-map.ts:4` comments the discrepancy ("additionally includes 'triathlon'"). `docs/coaching/triathlon.md` is a full blueprint and stats.tsx:378+ ships a triathlon predictor. A new triathlete cannot state their sport at first run; they must onboard as something else, then find Settings → Training Preferences and rebuild.
- **Step-counter skip:** for goals with no baseline screen (hybrid, weight_loss, general), routing jumps goals→health (goals.tsx:71-77), so the label goes "Step 3 of 5" → "Step 5 of 5".
- `general_fitness` exists in `PrimaryGoal` but has no GOALS card — selectable nowhere in onboarding.

---

## 3. Empty states (brand-new user, zero data)

- **Home** (src/screens/DailySummary.tsx): Body Battery "No score yet" card with a tappable connect-Health CTA (239-247, good). BuildPlanBanner shows when no plan (index.tsx:160-162, good). **BUT** the session card falls back to the default prop `{type:'No Session Planned', duration:'Free day', ozzieNote:"Ozzie is still crunching today's read."}` (64-71) and the primary button stays **enabled** ("Start Session →", disabled only for `sessionType==='rest'`, 321-330). `handleStartSession`'s switch default routes to `/workout/run` (index.tsx:71-73) — a brand-new user tapping the page's biggest CTA is dropped into a GPS run tracker for a session that doesn't exist. The ozzieNote also implies a plan is coming when none was built.
- **Log**: "Nothing logged yet today." (log.tsx:587) — inert text; the action cards are below but the empty state doesn't point at them.
- **Workout**: static launcher, always functional; no plan awareness at all (see finding below).
- **Stats**: three zero StatBlocks, an empty volume chart, the OSPREY+ upsell as the most visually prominent card (437-451), then "No workouts logged yet this period." (556-558) with no CTA to the Workout tab.
- **Sub-screens** mostly have instructive empties (races.tsx:1030, routes.tsx:227, friends.tsx:274, supplements.tsx:154, challenges.tsx:359) — the tab-level empties are the weak ones.

---

## 4. Copy voice vs docs/coaching blueprint voice

Standard: `docs/coaching/_index.md` "Voice is athlete-facing and plain-language" + root CLAUDE.md same rule.

- `(tabs)/workout.tsx:106` — "GPS run, set-by-set lift, or timer-based endurance — everything saves to your training load." System/data-model voice.
- `races.tsx:633` — "No active training plan to link yet — generate one from the home screen first." Developer voice, cross-app pointer instead of an action.
- `DailySummary.tsx:70` — "Ozzie is still crunching today's read." shown indefinitely to a no-plan user; wrong promise.
- `stats.tsx` FITNESS/FATIGUE/FORM with CTL/ATL/TSB sublabels is a reasonable compromise, but `mode.tsx:17` promises "This sets how I talk to you and what metrics I focus on" and `experience_tier` never gates any mobile display (only echoed at settings.tsx:545-546).
- `races.tsx:886-887` — "Search 50,000+ running events — 5K to marathon." Run-only framing in a 9-sport app; a Hyrox athlete's race discovery has no Hyrox events (hyrox skill audit-checklist row 3: hyroxlab's public event directory = Missing in OSPREY).

---

## 5. Design-system status of the graph (context for coherence)

Files still importing old `Colors`: 22 in app/ (incl. every `workout/*` live screen, stats, log, settings, races, calendar, challenges, friends, routes, activity, plan-preview, preferences, supplements, food-scanner) + 8 in src/components|screens (DailySummary, SignIn, NutritionCard, HydrationCard, WeatherCoachCard, ZonesCard, InputModal, FieldError). Everything a new user touches in the first 10 minutes crosses old/new boundaries repeatedly (Home ink/amber → Workout live screens old → recap old). Full-file migration status is another dimension's job; noted here because the *journey* crosses systems mid-flow.

---

## 6. Benchmark deltas specific to IA/first-run

- hyrox skill `structural-gaps.md` G2: "OSPREY's first screen for a stranger is a login box." Mobile confirms: SignIn.tsx:112-115 is wordmark + tagline, no value preview; the 9-sport promise first appears at onboarding step 3.
- hyrox skill `audit-checklist.md` row 5: OSPREY *exceeds* competitors on race-day personalization (countdown, morning checklist, Ozzie briefing/retro in races.tsx) — yet that entire surface hangs off a chip row inside Stats. The product's benchmark-verified strongest feature is 2 taps deep behind an analytics tab; Home never mentions the next race.
- hybrid skill `audit-checklist.md` row 1 + "Ask Ozzie dead-end" note: chat is architecturally read-only and hidden; mobile's IA has zero conversational entry point while onboarding is fully Ozzie-voiced ("What should Ozzie call you?", "This is how I'll greet you every morning" — name.tsx:29). The persona promise made in the first 90 seconds is never fulfilled in the shipped IA.
- hyrox skill REC-003 status: the quiz shipped to Settings → About & Support (settings.tsx:576-588) — the least discoverable location in the app, unconditioned on the athlete's sport.
- REC-002 (hyrox session type) will emit `hyrox` sessions once Phase-3 deploys, but `app/calendar.tsx:19-27` SESSION_ICON has no `hyrox`/`rowing` keys (legend at :177 omits them too) — month cells for those sessions render blank; the identical drift was already found+fixed in plan-preview.tsx (REC-002 notes), calendar.tsx was missed.

---

## Ranked findings (mirrors StructuredOutput)

1. **Critical — home-start-session-empty-state**: Home's primary CTA on a no-plan account starts a GPS run for "No Session Planned". S.
2. **Critical — race-hub-buried-under-stats**: benchmark-exceeding race hub (countdown, checklist, briefing) is invisible from Home/Workout; lives behind Stats chips. M.
3. **Important — triathlon-missing-from-onboarding**: 1 of 9 blueprint sports unavailable at first-run; only via Settings rebuild. M.
4. **Important — workout-tab-plan-blind**: the Workout tab is a static launcher with no today's-session or weekly-plan presence. M.
5. **Important — ozzie-promise-unfulfilled**: Ozzie-voiced onboarding → zero conversational surface in shipped IA; ask-ozzie orphaned dead-end. M (IA mitigation S; real fix blocked on billing).
6. **Important — hyrox-quiz-buried-and-dead-end**: shipped benchmark content in Settings→About & Support; result screen has no onward action. S.
7. **Important — signin-zero-value-preview**: pre-auth screen shows no sport breadth/value (G2). M.
8. **Important — calendar-icon-drift-hyrox-rowing**: calendar month view can't render hyrox/rowing sessions. S.
9. **Important — tab-empty-states-inert**: Stats/Log empties are text-only, no CTA; Stats empty state leads with a paywall. S.
10. **Minor — dev-voice-copy**: races.tsx:633, workout.tsx:106, DailySummary.tsx:70, races.tsx discover blurb. S.
11. **Minor — step-counter-skip**: "Step 3 of 5" → "Step 5 of 5" for non-baseline goals; `general_fitness` unselectable. S.
12. **Minor — experience-tier-inert**: mode.tsx promise ("what metrics I focus on") never gates any mobile display. M.
13. **Idea — race-countdown-on-home**: surface races.tsx "NEXT UP" countdown as a Home strip; pairs with benchmark finish-time bands (audit-checklist row 17). M.
14. **Idea — sport-aware-IA**: post-onboarding IA is identical for all 10 goals; benchmark products are sport-immersive (hyroxlab nav = Calculator/Pacing/Calendar/Training). Sport-conditional Home/Workout modules (e.g. Hyrox pacing/stations card from existing `buildHyroxPrescription`). L.
