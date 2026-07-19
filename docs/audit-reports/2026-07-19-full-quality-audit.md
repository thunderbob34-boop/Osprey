# OSPREY Full Quality & UX Audit — 2026-07-19

**Scope:** phone app (`OSPREY-app/`), webapp (`webapp/`), marketing website (`website/`), App Store metadata (`metadata/`), coaching-engine fidelity vs `docs/coaching/`, and repo hygiene (local + GitHub branches).
**Method:** seven parallel audit passes (mobile UX flows, mobile copy, mobile design consistency, webapp UX/copy/design, cross-surface uniformity, coaching fidelity, repo hygiene), then deduplication and manual spot-verification of every P0 and headline P1 against the cited code. One claimed finding failed verification and was removed (a SignIn button-contrast bug — the current code is correct: `SignIn.tsx:347` uses `Theme.ink` on accent).
**Severity:** **P0** = broken, contradictory, or launch-blocking · **P1** = visibly unprofessional or inconsistent · **P2** = polish.

This report is findings-only. No code was changed. Items already tracked in `docs/MASTER-PLAN.md` are marked *(known)*.

---

## Executive summary — the ten things to fix first

1. **The website sells a product the app doesn't ship.** `pricing.astro` says "Free — $0 — Everything an individual needs" including "Ozzie AI coaching"; the homepage promises "No paywall on effort." The app paywalls AI coaching, analytics, race hub, challenges, and live run coaching behind OSPREY+ at $5.99/mo / $59.99/yr — which the App Store listing markets openly and the website never mentions. *(Pricing gap known; the "No paywall on effort" copy and total absence of OSPREY+ from the site are new.)*
2. **App Store submission is blocked by placeholders.** `metadata/privacy-url.txt` is `https://PLACEHOLDER.example.com/privacy` and `metadata/support-url.txt` points at Anthropic's GitHub issues page. The in-app privacy link targets `https://osprey.app/privacy` on a site whose launch is currently held.
3. **GPS permission denial is completely silent.** Deny location, start a run: the map sits on a hardcoded Chicago fallback, distance stays 0.00 forever, no message ever appears — and ending the run saves a 0-distance workout. This breaks the app's core promise on the first run for any user who taps "Don't Allow."
4. **A killed app loses the entire workout.** No workout state is persisted (`zustand` stores have no `persist`); an OS kill 45 minutes into a run or lift session returns the user to Home with no trace and no recovery.
5. **The webapp marks lifts "completed" the moment you start them.** `webapp/src/features/log/queries.ts:10` inserts `status: 'completed'` at launch; the calendar ✓s the planned session before a single set is logged, and abandoned launches pollute History and stats as phantom completed workouts.
6. **The safety engine is decorative at runtime.** The ≤10%/week progression cap can never fire (`prevWeekLoad` is hardwired to `null`), weekly volume is never validated against the target, blueprint red-flag rules are entirely unimplemented, and on `main` Peak-phase volume goes **up** 10% (`periodization.ts:11`) when every blueprint says it should ease. The correct 0.9 fix is stranded on unmerged branch `claude/eager-gauss-e9gkkr`.
7. **Visible nutrition targets contradict the blueprints.** The targets athletes see come from hardcoded grams (240/200/180 g protein by goal, no body-weight term) in `ozzie-nutrition-coach`; the blueprint-correct g/kg fuel is computed per session, stored on `training_sessions.fuel` — and never rendered anywhere.
8. **Two design systems still ship inside the phone app.** 28 screens import both the old teal/gold system and the new ink/amber theme. Old gold renders beside new amber (near-collision hues) in the Log tab and the Calendar day sheet; the Stats chart bars sit on the old frosted-glass surface. Most residual imports exist only because `theme.ts` has no status tokens (error/success/warning) — adding a `StatusPalette` retires ~20 of the 28 mixed files mechanically.
9. **Raw error internals leak to users in ~60 places.** 47 mobile alert sites show `error.message` verbatim ("JWT expired", "duplicate key value violates unique constraint…"), plus the home-screen error body; the webapp does the same in ~15 places including multi-line ZodError JSON dumps. One shared `friendlyError()` helper per surface fixes nearly all of it.
10. **Stale docs and branches are actively misleading.** MASTER-PLAN §3C's "calculators are dead code" is now false (they're wired into every plan build); `docs/audit-branch-map.md` misses 5 newer branches, three of which hold line-verified unharvested bug fixes; `webapp/README.md` says phases "not started" that shipped a week ago. This is exactly the crossover-error machine the cleanup checklist (§6) dismantles.

---

## P0 — Broken, contradictory, or launch-blocking

### P0-1 · Pricing contradiction across surfaces *(partially known)*
- `website/src/pages/pricing.astro:5-6` — `Free / Athletes / $0 / "Everything an individual needs."` with features including `'Ozzie AI coaching'`.
- `website/src/components/DualCta.astro:6-8` — `"Full coaching, running, strength & nutrition tracking. No paywall on effort."` — directly false.
- `OSPREY-app/app/paywall.tsx:90-97` — gates AI Race Briefings, Race Retrospectives, Group Challenges, Live Run Coaching, Performance Intelligence, AI Plan Generation. Paywall is pushed from challenges, races, stats, run, endurance, and home.
- `metadata/description.txt` — markets "OSPREY+ PREMIUM … Try it free, then decide."
- The website contains **zero** mentions of OSPREY+, Plus, premium, or subscription (grep-verified).
- **Fix:** rewrite pricing as three honest tiers (Free / OSPREY+ $5.99·$59.99 / Team), add OSPREY+ to the homepage, kill "No paywall on effort." Site launch is held, so this is fixable before anyone sees it.

### P0-2 · App Store submission blockers in `metadata/`
- `privacy-url.txt` = `https://PLACEHOLDER.example.com/privacy` (self-flagged; ASC rejects without a live URL). In-app link (`src/constants/links.ts:4`) targets `https://osprey.app/privacy` — currently a dead domain while site launch is held.
- `support-url.txt` = `https://github.com/anthropics/claude-code/issues` (self-flagged placeholder).
- **Fix:** launch the website (after P0-1), then point both files at real URLs. Chain: domain → site live → metadata URLs.

### P0-3 · Silent GPS-permission failure ends in a saved 0-distance run
- `OSPREY-app/src/hooks/useRunTracking.ts:67-68` — on anything but `granted`, the hook silently returns. No state, no callback, no UI.
- `app/workout/run.tsx:230-235` — map falls back to hardcoded downtown Chicago; distance stays `0.00 mi`, pace `--:--`, forever, unexplained. Same silent path for Outside Bike/Hike via `app/workout/endurance.tsx:127`. "End & Save" then logs a 0-distance workout.
- **Fix:** surface permission status from the hook; on denial show a blocking banner + `Linking.openSettings()` — the pattern `app/food-scanner.tsx:73-112` already implements exemplarily. Warn before saving a 0-distance workout.

### P0-4 · Mid-workout app kill loses everything
- `src/store/workoutStore.ts` is non-persisted zustand (zero `persist(` in `src/`, grep-verified); elapsed time lives in in-memory refs (`endurance.tsx:150`, `hyrox.tsx:76`).
- OS kill / crash / force-quit mid-session → no track points, no sets, no recovery prompt. Data loss in a tracking app.
- **Fix:** persist `workoutStore` to AsyncStorage with periodic track-point flush; offer "Resume workout in progress?" on relaunch.

### P0-5 · Paywall dead end when offerings fail to load
- `app/paywall.tsx:108-114` — `getOfferings()` failure is swallowed (`.catch(() => undefined)`); no loading or error state. On Android (RevenueCat never configured — `src/services/subscriptions.ts:24`), offline, or RC misconfig: features render, no prices, and tapping "Subscribe" alerts **"Purchase failed. Your payment was not completed."** for a payment never attempted.
- **Fix:** track offerings load state; spinner while loading; on empty/failed, replace the CTA with an explanatory retry state.

### P0-6 · Webapp: lifts are "completed" at start
- `webapp/src/features/log/queries.ts:10` — `useCreateWorkout` inserts `status: 'completed'` when the user clicks "Start logging". `useCompletions` (`features/calendar/queries.ts:27`) counts those rows, so the plan session gets its ✓ instantly; abandoned launches become phantom completed workouts in History, the dashboard stat band, and week-strip.
- **Fix:** create as `planned`/in-progress; flip to `completed` on finish (or first committed set).

### P0-7 · Website download funnel is circular
- Every "Get the app"/"Download" CTA links to `/#download` (`index.astro:27`, `Nav.astro:12`, `pricing.astro:6`), which is the footer — whose two buttons (`Footer.astro:4-7`) link back to `/#download`. Zero `apps.apple.com` URLs in the site. A visitor can never download anything. Also: **"Download for Android"** promises a platform that doesn't exist (`subscriptions.ts:15-16`: Android "never wired up").
- **Fix:** wire the iOS button to the real App Store/TestFlight URL at launch; remove or "coming soon" the Android button.

---

## P1 — Uniformity & professionalism

### 1A · Cross-surface brand and claims

| # | Finding | Where | Fix |
|---|---|---|---|
| 1 | Store listing promises **voice coaching** ("in your earpiece mid-run") while `OZZIE_VOICE_ENABLED = false` (`src/services/ozzie-audio.ts:20`) — App Review rejection risk | `metadata/description.txt`, `release-notes-1.0.txt` | Reword to on-screen cues or ship voice first |
| 2 | Store listing promises a Race Hub **"packing list"** — zero matches for `packing` in the app | `metadata/description.txt` | Cut the claim or build it |
| 3 | **"Try it free, then decide"** implies an intro offer; none is configured on the paywall | `metadata/description.txt` | Verify RevenueCat intro offer or cut the line |
| 4 | "unlimited food logging with photo analysis" sold as premium, but food/photo logging is **not gated** anywhere | `metadata/description.txt` vs `food-scanner.tsx` (no `useSubscription`) | Align: gate it or stop selling it as Plus |
| 5 | Website Team plan sells roster/assignment/reporting features that exist nowhere | `pricing.astro:7-8` | Remove or "coming soon" |
| 6 | Product name split: website copy writes "Osprey" (21×) except `privacy.astro` which writes "OSPREY" (12×); app + metadata write "OSPREY" | site-wide | Standardize the written form (recommend OSPREY, matching app + store) |
| 7 | **Three contact emails**: `Thunderbob34@gmail.com` (privacy.astro:117 — personal Gmail on a public legal page), `hello@osprey.app` (terms, pricing), `support@osprey.app` (app `links.ts:6`) | — | One support address; alias the rest |
| 8 | **Sport lists disagree**: docs/coaching has 9 blueprints; app onboarding offers 11 goals (no triathlon/powerlifting goal despite blueprints; hybrid/weight-loss/general have no blueprint); webapp knows 9 session types (no crossfit/ultra); website mentions only run/strength/nutrition; keywords claim `triathlon` | `src/types/onboarding.ts:4-15`, `webapp/src/lib/format.ts:3-6` | Publish one canonical sport matrix; make marketing claim only what onboarding offers |
| 9 | **Intensity colors disagree on 5 of 6 levels** between webapp calendar and app `IntensityPalette` — the webapp's *easy* color is the app's *rest* color, so the same session reads one intensity level apart across surfaces; two different reds for "race" (`#ff5f57` vs `#ff4444`) | `webapp/src/routes/_authed/calendar.tsx:18-21` vs `OSPREY-app/src/constants/theme.ts:60-91` | Port EffortPalette/IntensityPalette values into webapp tokens; delete the ad-hoc map |
| 10 | Privacy policy gaps: **Sentry** (crash processor) undisclosed; **camera/meal-photo → OpenAI** undisclosed; mic + calendar permissions unmentioned. **Terms** has no subscription/auto-renew/refund clauses despite being the paywall's linked "Terms of Use" (Apple requires them) | `website/src/pages/privacy.astro`, `terms.astro` | Legal-page update before submission |
| 11 | Core brand tokens are **fully unified** across all three surfaces (ink/panel/line/amber/text all match; radius 0-vs-4px is a documented deliberate deviation) — but tokens are hand-duplicated in three places with no shared source | `website/src/styles/tokens.css`, `webapp/src/styles/tokens.css`, `OSPREY-app/src/constants/theme.ts` | Fine for now; consider a generated shared token file later |

### 1B · Mobile app — UX flow findings

1. **Session-start routing drift between Home and Workout tab** *(the known duplication, now concretely divergent)* — Home never shows the Outside/Stationary mode picker, so a planned run always launches GPS and a planned outdoor bike silently gets no GPS; Home's Hyrox route drops `sessionId`, so planned Hyrox sessions are never marked complete against the plan. `app/(tabs)/index.tsx:49-74` vs `app/(tabs)/workout.tsx:134-163`. **Fix:** extract one shared `startSession()` helper; pass `sessionId` everywhere; run the mode picker from Home too.
2. **"No Session Planned" still shows an enabled "Start Session →"** that drops the user into a GPS run warm-up (`DailySummary.tsx:322-330`; only `rest` disables it). Hide or reroute to the Workout picker when `sessionId == null`.
3. **Apple Health connection state is tracked in two places that never agree** — onboarding stores it in a draft that's never persisted; Settings reads its own AsyncStorage key only its own button writes. Connect in onboarding → Settings says "Not connected" forever, Home nags to connect. Also `health.tsx:56-70` silently fakes `healthConnected = true` on simulator errors. (`app/(onboarding)/health.tsx`, `src/services/onboarding.ts:50-84`, `settings.tsx:49,104,240`.)
4. **Onboarding has no visible back affordance** and pre-selects answers (`DEFAULT_ONBOARDING_DRAFT` pre-picks hybrid/beginner/3+2 days) — a user can Continue through without ever choosing, and can't obviously go back to fix a mistake. Interruption also discards all answers (non-persisted store).
5. **Challenge creation paywall ambush** — free users fill in the entire form, then get silently redirected to the paywall; nothing marks the gate up front (contrast `races.tsx:210`'s "🔒 OSPREY+" pattern), and paywall copy says "unlimited challenges" when free users can create none. (`app/challenges.tsx:170-174`, `paywall.tsx:93`.)
6. **Password-reset deep link fails when the app is warm** — only `Linking.getInitialURL()` is read; no `url` event listener exists, so tapping the email link with the app backgrounded shows "This reset link is invalid or has expired" for a valid link. (`app/reset-password.tsx:49`.)
7. **Threshold anchors (FTP/CSS/2k/run threshold) are enterable once, then unreachable** — no screen exposes them after onboarding; a cyclist whose FTP improves has no path to correct it. (`app/(onboarding)/baseline.tsx` vs `app/preferences.tsx`.)
8. **Paywall copy leaks "GPT-4o-mini"** into a sales bullet (`paywall.tsx:96`) — vendor jargon that dates the copy and undercuts the Ozzie brand.
9. **Background-location promise unkept** — plist promises tracking "if you lock your screen mid-run" and declares `UIBackgroundModes: ["location"]`, but the code requests only when-in-use permission with no background task; Android has no foreground service. Verify on-device or drop the claim. (`app.json:24`, `useRunTracking.ts`.)
10. **Every workout exit lands on the Workout tab** even when started from Home — the recap dismisses to the "Start a Workout" picker, losing today's completed-session context. (`recap.tsx:69` et al.)
11. **Settings has no Terms of Use link** (App Review expectation for subscription apps; it exists on sign-up and paywall only). (`settings.tsx:575-606`.)

### 1C · Mobile app — design consistency

Migration state: **~24 screens fully on the new theme, 28 MIXED, 1 old-only** (`FieldError.tsx`). Teal is fully purged; what still renders old is gold, frosted-white surfaces, and old status red/green/amber. Highest-visibility residue (all spot-verified):

1. **Log tab renders old-brand gold** on rest-day chips and the copy-yesterday chip (`log.tsx:1110-1112, 1183-1185, 820-823`) — bypassing `IntensityPalette.rest`.
2. **Calendar day sheet mixes old gold/green frosted cards beside new amber cards** in the same sheet (`calendar.tsx:214, 242, 338-345`). Old gold `#c89a00` vs new accent `#c8793a` is a near-collision hue — reads as "slightly wrong orange."
3. **Stats chart bars sit on the old frosted surface** `rgba(255,255,255,0.04)` (`stats.tsx:668`).
4. **`run.tsx:510` still uses old text token** `Colors.textMuted` for live pace status.
5. **Two different Switch recipes** between Settings (old frosted track, `#f4f3f4` thumb) and Supplements (`Theme.line` track, `#fff` thumb).
6. **Root cause & highest-leverage fix:** `theme.ts` has **no status tokens** (error/success/warning) and no `Button variant="danger"` — the majority of remaining `Colors.*` imports exist only to reach `Colors.red/green/amber`, with the red-tint chip recipe hand-retyped in 4+ places at drifting alphas. Add `StatusPalette` + a `statusChip()` helper (mirroring the existing `intensityChip()`) and ~20 of 28 MIXED files convert mechanically.
7. Hand-rolled CTA buttons drift from the `ui/Button` primitive (different press physics, two dimming conventions): onboarding Continue, paywall subscribe, retry/reset/discover buttons. The `InputModal` comment claiming Button can't flex is stale — `wrapperStyle` exists now.
8. Radius/typography drift: three chip radii (20/24/`Radius.card`) across sibling screens; `SpaceGrotesk_500Medium` is loaded but used zero times; the eyebrow-label recipe is retyped ~60× with some sites missing the brand font (`plan-preview.tsx:612`, paywall has zero Space Grotesk). Add `Radius.pill`/`Radius.sheet` + a shared eyebrow text style.

### 1D · Mobile app — copy & grammar (exact strings, spot-verified highlights)

**Outright errors:**
| Location | Current | Problem → Suggested |
|---|---|---|
| `src/services/coaching-engine.ts:29` | "Five miles. Halfway there if this is a 10K. Stay steady." | **Factually wrong** (5 mi ≈ 80% of a 10K), spoken aloud mid-run → "Five miles in. Strong and steady — keep the effort honest." |
| `app/(onboarding)/mode.tsx:16` | "How would you describe yourself as a trainer right now?" | User is the athlete, not a trainer → "…describe your training right now?" |
| `src/services/warmup.ts:13` | A-skips `'15m'` | Reads as 15 minutes; means meters → `'15 meters'` |
| `src/services/plan.ts:193-194` | "…from ${session_type} to ${newType}" | Raw enums leak ("from run to **cross**") → map through display labels |
| `run.tsx:284` alert | "Save this run and see your recap." above a **Discard** button | Message ignores the destructive option → "…or discard it." (lift.tsx already gets this right) |
| `paywall.tsx:96` | "powered by GPT-4o-mini" | Vendor leak → "rebuilt by Ozzie every week" |
| `supabase/functions/ozzie-generate-plan/index.ts:666` | plan name `"general fitness plan"` | Lowercase internal tokens → title-case display labels |

**Raw error leakage (biggest single copy fix):** 47 sites of `err instanceof Error ? err.message : …` across 18 files, plus `log.tsx:102` `getErrorMessage()` and the home screen rendering `error?.message` directly (`(tabs)/index.tsx:126` → `DailySummary.tsx:135`). One shared `friendlyError()` fixes ~60 surfaces.

**Terminology decisions to codify** (usage counts in parentheses): **plan** (45) not schedule (7); **race** (87) not event (9); planned-**session** / logged-**workout** rule (49/63) — then fix the two sibling End alerts that disagree (`'End workout?'` vs `'End session?'`); **Races** not "Race Hub" (the destination screen is titled Races); **deload** unhyphenated; **HYROX** (currently `hyrox`/`Hyrox`/`HYROX` all appear; `preferences.tsx:227` even lowercase) and **CrossFit** (`preferences.tsx:236`, `baseline.tsx:156` lowercase).

**Voice:** three competing taglines — "Your coach, your hype man, your guy" (SignIn — gendered), "AI Fitness Coach" (loading screen), "Your AI coach, fully unleashed" (paywall). Pick one, non-gendered. Onboarding mode cards flip narrator ("I" = Ozzie on card 1, "I" = the athlete on card 2). `PLAN_SYSTEM_PROMPT` mandates "Ozzie's warm/direct voice" but never defines it — no jargon ban (beginner notes can get TSS/CTL despite onboarding promising "pace and effort, not TSS and CTL"), no unit/format rules; add a short style block.

**Units/punctuation to standardize:** `…` over `...` (6 strings, both appear on the food-scanner screen simultaneously); `min` for minutes (plan-preview shows `12m` minutes one card above `800 m` meters); en-dash ranges; `lb` vs `lbs` (Log Weight card uses both within inches of each other); `cal` vs `kcal` vs `Calories` (three labels for one quantity); watts `W` not `w`; "metres" → "meters" (2 sites); metric users still see hardcoded `mi` on the live run screen, recap, and spoken debrief (`run.tsx:370`, `recap.tsx:110`, `workouts.ts:467`) and enter 1RMs in kg while logging sets in lbs.

### 1E · Webapp findings

1. **Dashboard is unreachable from the nav** — the 311-line home page at `/` is only reachable via the unstyled logo link; login always lands on `/calendar` and drops deep-link destinations. (`NavRail.tsx:6-16`, `login.tsx:8,26`.)
2. **Three forms have no cancel/dismiss path**: add-race, add-session, manual-food — once opened, the only exits are submitting or leaving the page. (`calendar.tsx:287-296`, `SessionEditor.tsx:131-140`, `nutrition.index.tsx:127-150`.)
3. **Silent failures & silent coercion**: effort/notes save failures never render; typing `abc`/`11` into Effort silently saves `null` while the field still shows "11"; recipe create/delete failures invisible; SessionEditor turns garbage input into `null` on save and accepts negative minutes/distance; history detail shows "No sets logged" during load and on error. (`log.$workoutId.tsx:45,53`, `nutrition.recipes.index.tsx:15,57`, `SessionEditor.tsx:15-17,45-46`, `history.$workoutId.tsx:45-56`.)
4. **Recipe delete has no confirmation** (permanent, cascades ingredients); the only confirm in the app is a native `window.confirm` — off-brand. (`nutrition.recipes.index.tsx:57`, `SessionEditor.tsx:62`.)
5. **Keyboard a11y gaps vs the spec's AA promise**: the exercise/food/ingredient type-aheads are mouse-only (no arrow keys, `onMouseDown` selection, no listbox roles; two of three don't close on outside click); most form controls lack programmatic labels (History's two bare date inputs don't even indicate from/to visually). (`SetsGrid.tsx:130-146`, `history.index.tsx:34-39`.)
6. **History stat band is quietly wrong** — "Total distance" and "Avg effort" are computed from the current 50-row page only but read as lifetime totals; numbers change when you page. (`history.index.tsx:24-27,47-51`.)
7. **UTC day-boundary bugs the codebase itself forbids** — `lib/day.ts:1-3` bans `toISOString().slice(0,10)`, yet `features/log/queries.ts:104`, `features/calendar/queries.ts:29`, and the History filters all do it: wrong week in the launcher dropdown and off-by-one completion ✓s for evening users. Reuse `localDayRange`.
8. **No session-expiry handling** — expired JWT mid-use fills every panel with raw "JWT expired" ErrorPanels retrying forever; user is never bounced to login. Zod parse failures dump full ZodError JSON into ErrorPanels. (`_authed.tsx:6-9`, `__root.tsx`.)
9. **Design-token leaks**: `#232329` ×14 (needs `--line-soft`), `#ff5f57`, `#2c2f36`, three `rgba(200,121,58,…)` amber literals; 118 inline `style={{}}` objects across 17 files — worst: **login.tsx is 100% inline** and visibly drifts from `.btn`/`.card` (no hover/press states, wrong padding). The dashboard re-implements the week strip, MacroBar, and race countdown inline — duplicating `calendar.tsx` code. Extract `WeekStrip`/`MacroBar`/`RaceCountdown` components.
10. **Responsive**: calendar layout refuses to wrap below ~1100px (fixed 320px aside, cells unusable at phone width); the 860px rail collapse **hides sign-out entirely** on mobile; SetsGrid and nutrition tables lack `overflow-x` wrappers. `color-scheme: dark` is missing, so native date pickers render in light chrome.
11. **The gated `/chat` route: keep it.** It's finished, high-quality (best error handling in the webapp), blocked only on OpenAI billing, and documented for re-enable. Two cheap pre-enable fixes: turn on router `autoCodeSplitting` (the dead page currently ships in the entry bundle) and fix `className="muted"` which matches no CSS rule.
12. Copy: ErrorPanel's "Something failed" headline; "Nothing logged today" shown on past dates; "workout/session" mixed in one sentence ("No workouts match … log your first session"); `en-US` hardcoded everywhere except one nutrition date.

---

## P2 — Polish & recommendations (condensed)

**Mobile UX:** weight-loss onboarding visibly skips "Step 4 of 5" (renumber dynamically); Chicago default map region; "End & Save" alert puts Discard one mis-tap from Save; lift "Finish Workout →" saves an empty workout without confirmation; endurance sessions have no pause (run does); Hyrox has no undo for a mis-tapped split; calendar month-load failure renders as an empty grid; races "Link to plan" error points to the wrong screen; lift silently drops prescribed exercises that don't match library names; `ask-ozzie` is a routable dead screen (deep link lands on an apology stub) — guard the route or accept the copy.

**Mobile design:** progress-track radius zoo (2/3/6); micro-radius one-offs; `Spacing` token essentially unadopted; 9px text in stats/races; paywall "Cancel anytime" at ~2.4:1 contrast; Terms/Privacy links on the paywall are the app's smallest tap targets with no link role; icon conventions (outline vs filled) accidental on several cards; two hand-copies of the session-emoji map (calendar + plan-preview) — drift risk; empty states split between carded and bare-text treatments with per-file font-size drift — generalize plan-preview's message+CTA pattern; Stats colors TSB with binary green/red while Home colors the same number with the six-tone `ReadinessPalette` — same physiological value, two color stories.

**Webapp:** login page has no "account is created in the app" hint or password reset; zip code can't be cleared and is US-only; stacked triple "LOADING…" on dashboard (skeletons); macro bars clamp at 100% so overeating reads as calm success; "Duplicate last (⏎)" works only from the weight cell; set numbering interleaves confusingly; recipe-title amber-highlights the last word of user-generated names ("Chicken **rice**").

**Website/SEO:** no og/Twitter meta, no sitemap, no robots.txt, no og-image; StatStrip presents single-athlete sample numbers ("26.2 miles tracked") as product stats under "Osprey by the numbers"; tagline case drifts ("Hunt Your Limits" / "Hunt your Limits" / "hunt your limits"); Ozzie — the store listing's entire hook — is never introduced by name on the homepage; keyword dupes (`AI coach`/`fitness coach`, `run tracker`/`GPS running`) waste App Store keyword budget — swap for `hyrox`, `crossfit`, `marathon`.

**Brand voice recommendation:** keep the brutalist visual system and "Hunt Your Limits" as headline campaign language; make Ozzie the named voice of body copy on every surface; retire copy that personifies the app as a watcher ("an eye that never drifts") — the product's actual personality is a friendly coach, and the site's own device mock already writes Ozzie correctly.

---

## Coaching-engine fidelity assessment

**Architecture:** every plan build runs the deterministic calculators (`computeEnvelope`) → results are injected into the GPT-4o-mini prompt as "hard constraints" → output passes three real clamps (`validate.ts`: 80/20 hard-session share, run/swim/row pace rescale, comp-lift %1RM band) plus deterministic back-to-back long-run placement. So the engine is **calculator-parameterized LLM generation with three guardrails** — MASTER-PLAN §3C is out of date in letter (calculators are wired, taper timing is deterministic, ultra's progressive taper runs) but only ~half met in spirit.

**Verdicts on §3C claims:**
- "Calculators are dead code / 100% LLM" — **refuted** (wired via `envelope.ts`, `strength.ts`, `fuel.ts` into every plan build; zones render on plan-preview). Genuinely dead: `hyroxRunZones`, `attemptJumpRangePercent`, `runningDailyCarbGrams` (race-week tier), `computeLTHR`, `sodiumMgPerHourFromSweatRate`, and the barrel `calculators/index.ts`.
- "No real periodization/taper" — **partially true in effect**: `baselineLoad` hardcoded to 200 and `prevWeekLoad` to `null` (`build-envelope.ts:137-138`), so the ≤10%/wk cap **never fires**, every athlete gets the same phase-scaled constants, and weekly volume is never clamped — the load target is prompt text only. **Peak factor is 1.1 on main** (`periodization.ts:11`, verified) vs blueprint "volume easing"; the 0.9 fix sits on unmerged `claude/eager-gauss-e9gkkr`.
- "Nutrition ignores g/kg" — **confirmed for everything visible**: `ozzie-nutrition-coach` `computeTarget` hardcodes 240/200/180 g protein by goal with no body-weight term (verified) — 3.3 g/kg for a 55 kg runner, 2.4 for a 100 kg lifter vs blueprint 1.6–2.2. The blueprint-correct per-session fuel IS computed and stored on `training_sessions.fuel` — and rendered nowhere; the webapp even nulls it on edit (`session-edit.ts:46`).

**Top 5 gaps by athlete impact:** (1) progression/volume safety unenforced + red-flag rules unimplemented anywhere; (2) visible nutrition off-blueprint while correct numbers sit unrendered; (3) Peak 1.1× + flat non-ultra taper off a hardcoded baseline mis-shapes race-week freshness; (4) `baselineLoad=200` means onboarding input #1 (experience & current load) never actually scales volume; (5) hyrox/powerlifting specificity (compromised splits, station weights, Prilepin caps, attempt cards) is prompt-only — correct numbers reach the athlete only if the LLM chooses to echo them, and hyrox bypasses its own zone table for generic run zones. Two zone systems can also disagree: in-run guidance derives threshold independently of the plan's anchor (`run-guidance.ts:22-49`), so plan-preview and mid-run can state different "easy" paces. **Contradiction risk: medium-high.**

---

## Cleanup checklist — repo hygiene (delete / archive / keep)

*(Read-only inventory; nothing was deleted. Full 43-row detail preserved from the hygiene pass; condensed here to the actionable core.)*

### Local code
| Item | Verdict | Reason |
|---|---|---|
| `src/services/calculators/*` (all sport files) | **KEEP** | Live runtime code — §3C's "dead code" claim is outdated; update MASTER-PLAN |
| `src/services/calculators/index.ts` (barrel) | **DELETE** | Zero importers |
| `src/constants/colors.ts` | **KEEP until migration done** | 30 runtime importers remain; retire via StatusPalette work (§1C-6) |
| `app/ask-ozzie.tsx` + webapp `/chat` + `features/chat/*` | **KEEP-GATED** | Finished features awaiting OpenAI billing; re-enable paths documented |
| Session-routing duplication (Home vs Workout tab) | **REFACTOR to shared helper** | Already diverged (§1B-1) |
| `MEAL_LABEL` ×2 (webapp) | **HOIST to `lib/format`** | Character-identical duplicates with latent order drift |
| App↔webapp type duplication (session-type has 4 different member sets across files) | **FLAG** | Needs a canonical vocabulary doc before a shared package |
| Unused deps: `ajv`, `react-hook-form`, `@opentelemetry/api` (0 imports each); `expo-sensors` (plugin wired, never imported) | **DELETE** (confirm expo-sensors intent) | Verified zero imports |
| Orphaned components | **NONE FOUND** | Every component in both apps has runtime importers |

### Stale files & docs
| Item | Verdict | Reason |
|---|---|---|
| `website-mockups/` (4 HTML explorations) | **ARCHIVE → docs/archive/** | Design decided and shipped |
| `docs/TODO.md` | **ARCHIVE after migrating ops facts** | Superseded by MASTER-PLAN — but it holds live launch facts (domain not owned, go-live steps, IDs); confirm they're in MASTER-PLAN first |
| `docs/MASTER-PLAN.md` §3C | **UPDATE** | "Calculators are dead code" is now the most misleading sentence in the repo |
| `webapp/README.md` | **UPDATE** | Says phases "not started" that shipped (nutrition, chat, dashboard) |
| `docs/audit-branch-map.md` | **UPDATE** | Missing 5 `eager-gauss-*` branches; 3 of its "still OPEN" items are fixed on main |
| `docs/OSPREY-feature-plans-deload-watch.md` | **ARCHIVE** | Unimplemented proposals, overlaps branch-map notes |
| `docs/archive/`, `OSPREY-app/audit-reports/` (2 files), `docs/superpowers/` specs+plans | **KEEP** | Historical record; cited by CLAUDE.md/READMEs/PRs |
| `webapp/routeTree.gen.ts` committed | **KEEP** | Standard TanStack practice |
| `website/public/videos/` (~15.7 MB) | **KEEP** (consider LFS) | Live site assets |
| `.DS_Store` / stray `.env` / build artifacts | **CLEAN** | None found |

### GitHub branches (20 non-main branches, all unmerged; current session branch excluded)
| Branches | Verdict | Reason |
|---|---|---|
| `claude/quirky-volta-l97mrv`, `-wn6bek` | **DELETE** | Fully superseded; their one residual (date.ts) exists on main |
| `claude/great-pascal-{52gd08,7bp9g6,bdwpoj,rgi4i4}`, `quirky-volta-4qskjf` | **DELETE after 30-min skim** | Security fixes superseded by main's migration; their obsolete `…33` migrations must never merge |
| `claude/great-pascal-i40rhu` | **DELETE last** | Its three headline fixes verified on main; branch map's reference diff |
| `claude/eager-gauss-torngm` | **KEEP — unharvested fixes** | Line-verified still missing on main: hyrox/crossfit `onSkip` discards goalParams; soft-delete reschedule bug; webapp plan-editing fixes; 07-17 audit report |
| `claude/eager-gauss-e9gkkr` | **KEEP — unharvested fixes** | Line-verified: Peak 1.1→0.9 periodization fix (blueprint correctness), entitlement-leak authStore fix, 07-15 audit report |
| `claude/eager-gauss-n5d3r8` | **ARCHIVE pending verification** | Mostly superseded by merged PR #6; 15 fixes not individually line-checked |
| `claude/eager-gauss-37w1s2` | **DELETE after cherry-picking `c7f0c06`** | PR #6 merged its fixes; one 93-line feature-status doc unharvested |
| `claude/eager-gauss-0v6h9u` | **DELETE** | 2-line `.env.test` stub |
| `claude/quirky-volta-{ruhdld,djz47h,9lpdro,y77uxz}` | **KEEP — unharvested features** | Only copies of: Apple Watch bridge, Ozzie Live voice + Life Load, meal-prep/live-race, return-to-training/physique. Product call needed |
| `feat/reanimated-screen-animations` (draft PR #3) | **ARCHIVE; close PR** | 377 commits behind; DailySummary fully re-skinned since — guaranteed conflicts |
| `worktree-tsb-engine-advisor-plans` | **DELETE after harvesting docs** | 3 TSB advisor plan docs (1,403 lines), no code |

**Cleanup order to prevent crossovers:** ① harvest the cheap wins (feature-status doc, TSB plans, then port the verified-open fixes from `torngm` + `e9gkkr` as fresh commits — never merge those branches; obsolete-migration hazard); ② delete the superseded branches, close PR #3; ③ update the three stale docs (MASTER-PLAN §3C, webapp README, branch map); ④ make the product call on the four feature branches, then delete them too.

---

## Suggested execution order (if/when fixes are approved)

1. **Pre-launch blockers (P0):** pricing page rewrite + OSPREY+ on the website; real privacy/support URLs; store-listing claims (voice, packing list, free trial); download links.
2. **Core-promise bugs (P0):** GPS-permission UX; workout persistence; paywall offerings state; webapp `status:'completed'`.
3. **Safety & substance:** port the Peak 0.9 fix + entitlement fix from `eager-gauss-e9gkkr`; thread real `baselineLoad`/`prevWeekLoad` so the 10% cap works; render `training_sessions.fuel`; make `computeTarget` weight-based.
4. **One-helper, many-fixes:** `friendlyError()` on both surfaces (~60 sites); shared `startSession()`; `StatusPalette` + `Button variant="danger"` (retires ~20 mixed-token files); webapp `localDayRange` adoption.
5. **Copy pass:** the (a)-list outright errors, terminology decisions, unit standardization — mostly mechanical once decided.
6. **Design polish:** remaining P1 design residue (log gold, calendar sheet, stats bars, switches), then P2s.
7. **Hygiene:** the cleanup checklist above, in its stated order.

---

## Appendix A — mobile route coverage (39 route files audited)

All routes in `OSPREY-app/app/` were walked; per-route status: **audited-clean** — `_layout`, `index`, `(auth)/*`, `(onboarding)/welcome`, `(tabs)/_layout`, `(tabs)/log`†, `(tabs)/stats`†, `plan-preview`†, `race-search`, `activity`, `friends`, `supplements`, `food-scanner` (exemplary permission flow), `routes`, `workout/_layout`. **Findings** — `(onboarding)/name·mode·goals·baseline·health`, `(tabs)/index·workout·settings`, `workout/run·endurance·lift·hyrox·recap`, `calendar`, `races`, `race-event`, `challenges`, `preferences`, `paywall`, `reset-password`. **Dead** — `ask-ozzie`. († clean on UX flow; design/copy findings apply.)

Positive patterns worth propagating: food-scanner's permission flow, profile-error retry on the entry gate, plan-preview's empty state, double-confirm account deletion, notification permission requested only on explicit toggle, consistent `dismissTo` (no modal traps), and the migration's self-documenting FUNCTIONAL/KEEP comments.

## Appendix B — webapp route coverage

All 14 route files + features + components audited: `/login`, `/` (dashboard), `/calendar`, `/log` + `/log/:id`, `/history` + `/history/:id`, `/nutrition`, `/nutrition/recipes` + `/:recipeId`, `/settings`, `/chat` (gated), shell (`_authed`, `__root`, NavRail, ErrorPanel, EmptyState). Best-in-class to propagate: the settings zones forms (live preview, disabled-until-valid, specific inline errors) and the chat error taxonomy.

## Appendix C — corrections to prior beliefs

- MASTER-PLAN §3C "calculators are dead code": **refuted** (wired 07-14→07-16).
- `docs/audit-branch-map.md` "still OPEN" items paywall `/mo`, session routing mis-route, missing `date.ts`: **all fixed on main** (routing *divergence* remains — §1B-1).
- MASTER-PLAN "8 audit reports": 2 exist on main; 6 live only on unmerged branches.
- One audit claim removed after verification: SignIn submit-button contrast (code is correct on main).
