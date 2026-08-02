# RUNNA-app-teardown.md: Runna iOS app — onboarding, plan generation, and the gaps

## Source
- Product: Runna iOS (Strava-owned), account linked via Strava (`STRAVA-TP: 2 weeks free` promo)
- Evidence: **43 first-party screen captures of the complete flow**, 30 Jul 2026, 10:35–11:12 — signup → goal → race select → profiling → schedule → strength add-on → summary → paywall → generation → plan delivery → workout-type explainers. All observations below are **from the captured screens**, not from marketing copy.
- Analysis date: 2 Aug 2026
- Companion doc: [`DESIGN-runna.md`](./DESIGN-runna.md) covers the **marketing site** (runna.com). This file covers the **app**.
- Not captured: the training calendar, individual workout cards, and post-run analysis. Conclusions below are scoped to what the flow demonstrably does.

---

## Part I — Gap Analysis

### Summary

Runna's onboarding is a **form**. It collects 23 static declarations, generates one plan, and then spends the rest of the relationship letting the athlete rearrange that plan on a calendar. Everything they built is upstream of the athlete actually training. Everything hard is downstream — and the product largely stops there.

### The observed flow (23 screens)

| # | Screen | What it collects |
|---|---|---|
| 1 | What is your goal? | 12 options: Race, Specific distance, Start running, Get back into running, 5k improvement, General training, parkrun, Postpartum, Functional fitness, … |
| 2 | Find your race | Searchable race DB w/ Dates/Distance/Country/City filters; "add it manually" fallback |
| 3 | Race detail | Distance chips, date, location, **elevation profile tag** ("Rolling"), social proof ("1,786 other Runnas") |
| 4 | Race distance | Bottom sheet, one distance per date |
| 5 | Running ability | 4 self-rated buckets: Beginner / Intermediate / Advanced / Elite, each with a concrete definition |
| 6 | Injury history | 3 buckets + "Prefer not to say"; medical disclaimer + privacy consent |
| 7 | Confirm injury history | Read-back screen w/ edit pencil |
| 8 | Estimated **current** race time | Distance toggle (5k/10k/HM/M) + h:m:s wheel picker; copy warns against using a stale PB |
| 9 | Days per week to run | 2/3/4; helper: "at most once more than you currently run per week" |
| 10 | Which days free to run | 7-day checklist, min = chosen frequency |
| 11 | Long run day | (implied by summary) |
| 12 | Plan start date | Now/16wk · 12wk · 10wk · Custom + inline calendar; Today/Tomorrow/Monday chips |
| 13 | Training preferences | Volume + Difficulty, pre-set, badged "Adjusted for your injury history" |
| 14 | What else are you interested in? | Strength · Stretching & mobility · Injury management · **Nutrition advice** · Connecting with others · Sleep & recovery |
| 15 | Add strength? | Toggle + rationale copy |
| 16 | Strength goal | 2 options: Running Focus / All Round Strength |
| 17 | Strength session length | 30 / 45 / 60 min |
| 18 | Strength sessions per week | 1–4; helper: "More isn't always best!" |
| 19 | Which days free to train | **Identical 7-day checklist as #10** |
| 20 | Equipment available | Stretch band, Barbell, Box, Bench, Dumbbell, Kettlebell, Pull-up bar, Swiss ball |
| 21 | Plan summary | All 11 collected values echoed as bullets → "Generate my plan" |
| 22 | **Paywall** | $119.99/yr or $19.99/mo, 2-week trial, trial timeline, 30k reviews carousel |
| 23 | Generation | Two staged loaders → welcome → estimated race time **range** → coaching team → workout-type explainers |

**Three inputs carry the entire physiological model:** the self-rated ability bucket (#5), the self-typed race time (#8), and the 3-option injury dropdown (#6). Everything else is scheduling logistics.

---

### Gap 01 — The model is one-shot and self-reported

The athlete *types* their current half-marathon time. That number anchors every pace target for 15 weeks. There is no field test, no re-anchoring session, no recalculation from completed work.

Runna syncs with Garmin, Apple Watch and Strava — but for pushing workouts out and pulling completed runs in, not for computing starting fitness. **The athlete is asked to self-diagnose the one input that determines everything.**

> **OSPREY:** HealthKit is wired (`src/services/healthkit.ts`) plus a watchOS target. Derive the anchor instead of asking for it, show the athlete what was derived, and re-derive on a cycle.

### Gap 02 — Injury history is a volume multiplier and nothing else

Three buckets (rarely / minor-or-past / frequent-or-recent) plus "prefer not to say," wrapped in a *not medical advice* disclaimer. The payoff screen reads, verbatim:

> **Adjusted for your injury history** — TRAINING VOLUME: `Custom` · DIFFICULTY: `Custom`

No body region. No tissue type. No current symptoms. No return-to-run progression. No downstream load monitoring that would catch an injury developing. A history of posterior tibial tendinopathy and a history of a femoral stress reaction produce the same output: slightly less volume.

> **OSPREY:** every blueprint in `docs/coaching/` already has a red-flags section. That content is a differentiator currently sitting unused in a docs folder.

### Gap 03 — Nutrition is a checkbox, not a system

"Nutrition advice" appears exactly once in the entire flow — as one of six items on an **interests** checklist, between "Injury management" and "Connecting with others." It is a content-targeting flag that routes the user to articles.

No sweat-rate input, no carbohydrate-per-hour prescription, no sodium target, no long-run fueling protocol, no gut training, no race-day fuel plan. For a company selling marathon plans this is the largest structural hole in the product — the wall at mile 20 is a fueling failure, and they do not model fueling.

> **OSPREY:** `ozzie-nutrition-coach`, `ozzie-meal-photo`, `app/food-scanner.tsx`, `app/supplements.tsx`, plus fuel calculators in all nine blueprints. Already built. Runna cannot bolt this on quickly — it requires a domain they haven't hired for.

### Gap 04 — Strength is bolted on with no interference model

The strength flow asks four things: sessions/week, session length, equipment, and one binary goal toggle. **It never asks a single load the athlete can move.**

Selecting *All Round Strength · 60 min · 3×/week* alongside a 4-day half plan yields seven quality-adjacent sessions in a seven-day week, prescribed by two systems that don't talk to each other. Concurrent-training interference is handled by spacing items on a calendar.

> **OSPREY:** `calculators/powerlifting.ts`, `crossfit.ts`, `hyrox.ts` sit alongside the endurance calculators. OSPREY is uniquely positioned to prescribe both sides of the ledger from one load model.

### Gap 05 — The onboarding schema is a running schema

"Booked a running **or triathlon** race" is offered at screen 1 — and every subsequent screen asks about running: *which days are you free to **run***, *which day for your **long run***, *current race time* in 5k/10k/HM/Marathon.

Multi-sport isn't a feature Runna is missing; it's a schema they would have to rewrite. That's a rebuild, not a sprint.

> **OSPREY:** nine sports, nine calculators, one shared 10-section blueprint structure driving a common plan-generation schema. This gap is structural and durable.

### Gap 06 — "Adaptation" means dragging a workout to a different day

The three tips surfaced on the plan-introduction screen, verbatim:

1. *Shuffle your week in the Training Calendar* — drag and drop
2. *Personalise with Training Preferences* — tweak intensity and weekly mileage
3. *Adapt instantly with Plan Adjustments* — "heading on holiday or not feeling 100%"

All three are **the athlete adjusting the plan**. None is the plan responding to the athlete. Nothing reads yesterday's session, this morning's HRV, last night's sleep, or today's heat and changes the prescription before being asked. The plan is generated once and then defended.

> **OSPREY:** `ozzie-daily-brief`, `weather-coach.ts`, `daily-summary.ts`, `ozzie-race-briefing`, `ozzie-race-retro`. The loop exists — it just isn't the product's center of gravity yet.

### Gap 07 — "Your coaching team" is three bios everyone gets

One screen after *"Your plan has been personalized for you,"* the app introduces Colleen Quigley, Ben Parker and Kayla Jeter — with the same welcome text every user reads. Workout explainers are one YouTube video per session type plus a Spotify playlist.

Beautifully produced, and identical for 100% of the user base. The personalization narrative breaks at the exact moment they introduce the coach.

> **OSPREY:** Ozzie — `ozzie-voice-log`, `ozzie-daily-brief`, `ozzie-meal-photo`, `ozzie-race-retro`, ElevenLabs voice. A coach who knows what you did yesterday is a different category of thing than a coach who recorded a video.

---

### Positioning table

| Dimension | Runna | OSPREY (built or blueprinted) |
|---|---|---|
| Sports | Running; triathlon on a running schema | 9, each w/ calculator + blueprint |
| Fitness anchor | Self-typed race time, set once | HealthKit-derivable, re-anchorable |
| Fueling | Interest checkbox → articles | Nutrition coach, meal photo, scanner, per-sport fuel math |
| Injury logic | 3 buckets → volume multiplier | Per-sport red flags; **not yet shipped** |
| Strength | Add-on; no loads, no interference model | Powerlifting / CrossFit / Hyrox engines |
| Adaptation | User drags workouts on a calendar | Daily brief + weather + summary loop |
| Coach | 3 static bios, shared video library | Ozzie: per-athlete, voice, conversational |
| Distribution | Strava-owned, ~$120/yr, huge install base | **Zero — the one category where they win** |

### Verdict

> **Runna prescribes. OSPREY should respond.**

The prescription layer — the 16-week grid — is a commodity. Strava's balance sheet owns it and any model can generate one. Do not fight there.

The differentiated 10% is everything that happens *after* the plan exists: what today should be given how you slept, what you ate, what yesterday cost you, what the weather is doing, and whether that niggle is getting worse. Runna's entire adaptation surface is a drag-and-drop calendar, and that is downstream of a one-shot model they would have to replace.

**The single move:** make the daily loop the home screen. Runna opens to a plan. OSPREY should open to *"here's what your body says today, here's what I changed, here's what to eat."* The 16-week grid becomes a tab you rarely visit — because a real coach doesn't hand you a calendar, they tell you what to do this morning.

**Corollary:** this framing is additive rather than substitutive. An athlete with a Runna plan they like can bring it to OSPREY for the fueling, readiness and strength-integration layer. Being the coach on top of anyone's calendar is a larger market than being a better calendar, and it removes the switching cost that would otherwise be fatal against Strava's distribution.

---

## Part II — UX & Design Teardown

23 screens should feel like a slog and doesn't, because of a small number of repeatable decisions.

### Patterns to adopt

**One question per screen, always.** Every screen holds exactly one decision: a headline in large bold type, one line of supporting text, a stack of full-width tap targets, one bottom-pinned CTA. Never two questions.

**Coaching embedded in the constraint.** Helper text under "How many days per week would you like to run?": *"This should be at most once more than you currently run per week to reduce the risk of injury."* Under strength sessions: *"More isn't always best!"* The form field teaches while it constrains — the cheapest coaching surface in the app, one line of copy per screen. OSPREY has nine blueprints' worth of rationale to draw on here; do this on **every** input.

**Self-correction at the point of selection.** The Beginner ability card contains its own escape hatch: *"If you can't complete a 3mi run in under 60 mins, no problem! Please go back and select the 'Start running' goal first."* Mis-selection is caught inside the option rather than validated later.

**Echo every input back before committing.** The pre-generation screen lists all eleven collected values as plain bullets, then one button: *Generate my plan*. Cheap to build, large trust payoff — it says *I was listening* right before asking the user to believe the output.

**Generation theater.** Two staged loading screens instead of a spinner: a colored bar-chart of a training block (*"Selecting your workouts based on our coaching philosophy…"*), then a partial calendar rendering real session names (*"Finalizing your perfect training schedule…"*). Makes four seconds feel like labor. Natural fit for Ozzie generation — show the reasoning.

**A consistent color-coded session taxonomy.** Green Easy · orange Intervals · yellow Tempo · green Hills · purple Long. The same chip appears on the calendar, the workout card and the explainer sheet. Athletes learn to read a week's shape at a glance — it's the visual grammar that makes polarized training legible.

**Predictions as a range.** Estimated race time shown as **2:08:00 – 2:16:00**, not a point. Honest about uncertainty and it hedges the promise.

**Progress bar + back arrow + X on every screen.** The X is an escape hatch that doesn't destroy progress.

**Explainer sheets on first encounter.** Each session type gets a modal: intro video, several paragraphs of plain-language rationale, curated Apple Music/Spotify playlist.

### Patterns to avoid

**The paywall before the plan.** Eight minutes of onboarding, a summary screen, "Generate my plan" — then a hard paywall before a single session is visible. It converts on sunk cost and it's the most-complained-about moment in the funnel. With RevenueCat already wired: **show week one in full, paywall at week two.** Convert on demonstrated value.

**Asking what could be inferred.** Roughly half the screens are scheduling logistics. With HealthKit, propose a default from actual training history and let the athlete correct it. *Propose, don't interrogate.* Every screen removed is conversion kept.

**The same screen twice.** The 7-day picker appears once for running days and again, identically, for strength days. Reads as a system that isn't thinking. One availability model should serve both.

**Labels that say "Custom."** *TRAINING VOLUME: Custom · DIFFICULTY: Custom* is a database value leaking into the UI. Name the actual adjustment — *"~15% lower peak volume, given your injury history"* — and the same screen becomes evidence the coaching is real.

**Screens that are 60% empty.** Several carry one small card and a Continue button. If a screen has one element it should be merged, or earn the space with the rationale/tradeoff/coaching note.

### Visual system, observed (in-app)

| Property | Value |
|---|---|
| Canvas | Near-black, `#161616`-family; cards one step lighter (`#1D2126`-ish) |
| Accent | Single mint/teal, used for selection state and active data only |
| Selection state | 1px mint border on the card — **never** a fill |
| Primary CTA | White pill, dark text, pinned to bottom safe area |
| Type | Headline ~28px bold; body ~15px muted grey (`#98A2AE`-ish) |
| Other color | Session taxonomy only — no other hues anywhere in the app |
| Nav | 5-tab bar: Today · Plan · Activities · Community · Support |
| Onboarding chrome | Thin progress bar centered top, back arrow left, X right |

### Implications for OSPREY

- Restraint is the trick — one accent, everything else greyscale.
- Reserve saturated color **exclusively** for the session taxonomy.
- Border-based selection reads more premium than filled chips.
- Bottom-pinned single CTA keeps every screen thumb-complete.
- The tab bar should lead with the daily loop, not the plan — **Today** first, and make it the readiness surface Runna's "Today" isn't.
- Ozzie is the differentiator; give him a persistent surface, not a buried tab.

---

## Build order this implies

1. **Reframe the home screen.** Daily readiness → today's session, adjusted, *with the reason stated* → today's fuel. This is the product; everything else supports it.
2. **Kill the self-reported anchor.** Derive starting fitness from HealthKit, show what was derived, let the athlete correct it, re-derive on a cycle.
3. **Surface fueling as a first-class object.** Not a tab, not an article — a prescription attached to every session over ~75 minutes. The gap Runna cannot close quickly.
4. **Make the injury model real.** Region + tissue + current symptom → load caps and a return-to-run ladder. Content already exists in `docs/coaching/`.
5. **Unify strength and endurance in one load model.** Nobody else can; OSPREY has both calculator sets.
6. **Borrow the onboarding craft.** One question per screen, coaching in every helper line, echo-back summary, generation theater, week one free.

---

## Rerun Inputs

```
source: Runna iOS app, full onboarding → plan-delivery flow
capture: 43 screenshots, 30 Jul 2026 (IMG_7656–IMG_7699)
cross-ref: OSPREY-app/src/services/, docs/coaching/, supabase/functions/ozzie-*
output: docs/design-references/RUNNA-app-teardown.md
companion: docs/design-references/DESIGN-runna.md (marketing site)
```
