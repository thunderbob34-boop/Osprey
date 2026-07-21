# OSPREY Mobile — Merged & Prioritized Audit (2026-07-21)

Judge pass over the 5 dimension audits in this directory: `design-consistency.md`,
`hyrox-gaps.md`, `hybrid-gaps.md`, `ux-flow.md`, `coaching-presentation.md`.

**Ranking rule applied** (per task): user-visible impact first — what would make the app
FEEL transformed in the simulator — then severity, then effort-adjusted value. The user's
complaint is "the app doesn't feel revamped," so whole-screen visual coherence and headline
experience gaps outrank functional nits.

**One conflict resolved between auditors:** `ux-flow.md` §5 counts "22 files still importing
old Colors" as a coherence problem; `design-consistency.md` (which enumerated every token)
shows those imports are almost entirely *functional* tokens (red/green/amber/recoveryRed)
the migration deliberately preserves, and that **zero screens remain fully on the old
system**. The design audit supersedes: the real residue is (a) a short list of true
brand-color leftovers and (b) component-grammar drift. The "~49 files on old Colors"
memory note is stale.

**The unifying diagnosis** (stated independently by three auditors): every benchmark
"Exceeds" lives in `src/services/**` or an undeployed edge function; every competitor "win"
lives on a screen. The engine outperforms; the athlete sees none of it. That, plus the last
old-brand pixels and grammar drift, is exactly why the app doesn't feel revamped.

---

## Merge map (which dimension findings collapsed into which entry)

| Merged entry | Source findings |
|---|---|
| 1. Brand-color purge | design: log.tsx gold DRIFT, calendar.tsx RACE DAY gold, OzzieMascot/OzzieAvatar `#00c8c8`, workout/hyrox red-coded stations + borderGreen, run.tsx `Colors.textMuted`, calendar-blocking.ts teal |
| 2. Component grammar | design: chip radius 20/24 vs Radius.card 4 (15 sites), literal borderWidths 1/1.5/2 (56 sites), Shadow.emphasis at only 3 sites, 53 inline SpaceGrotesk decls / no type tokens, dead 500Medium font load, ScreenHeader gaps (plan-preview, preferences, food-scanner), hand-rolled panels in 15+ screens |
| 3. Home no-plan CTA | ux-flow 1 (Start Session → GPS run for "No Session Planned"; ozzieNote false promise) |
| 4. Personal numbers at point of need | coaching I1 (session card "Zone 2" without YOUR pace) + I5 (plan-preview detail hides fuel, intensity chip without band) |
| 5. Phase-3 atomic deploy | hyrox 1 (deployed generator has zero Hyrox awareness; REC-002 rides along) |
| 6. "Your Prescription / My Zones" surface | coaching C1 (prescriptions invisible) + I2 (ZonesCard 2-of-5 bands, one buried screen) + I4 (webapp renders what mobile doesn't) + M2 (Fran tier never echoed) + IDEA-1 (persist envelope) + hyrox 8 (hyrox zones/station loads never render as reference) |
| 7. Race hub on Home | ux-flow 2 (race hub buried behind Stats chips) + idea 13 (NEXT UP countdown strip on Home) |
| 8. Hyrox pacing experience | hyrox 3 (no pacing tool) + 5 (targetTimeMinutes never collected) + 6 (finish-time bands) + 7 (phased model) + coaching C3 (runner shows no run pace target) + M1 (re-asks division) + IDEA-2 |
| 9. Ozzie dead surface | hybrid F-H1 + ux-flow 5 (orphaned ask-ozzie; Ozzie-voiced onboarding promise unfulfilled) |
| 10. HR rendering | hybrid F-H2 (HR captured everywhere, rendered nowhere) |
| 11. Hybrid identity tiles | hybrid F-H3 (cardio/strength split) + coaching I6 (weekly load target + 80/20 split never visualize) |
| 12. Race-week fueling render | hyrox 10 + coaching I3 (sodium/caffeine/carb g/hr computed, no race-day surface) |
| 13. One zone truth | coaching C2 (run-guidance vs envelope: two thresholds, new athletes get no in-run targets) |
| 14. First-run polish | ux-flow 9 (inert tab empties; Stats empty leads with paywall) + 10 (dev-voice copy) |
| 15. Hyrox race discovery | hyrox 2 (race search hardwired running_race) + ux-flow copy note ("Search 50,000+ running events") |
| 16. Station technique | hyrox 4 (zero cues at point of need; content already captured verbatim in skill sources) |
| 17. Interference radar | hybrid F-H4 (stated wedge, zero visible intelligence; validate.ts never checks adjacency) |
| 18. Travel/sick adaptations | hybrid F-H5 (no bodyweight-swap or illness flow; brief prose unlinked to existing mutations) |
| 19. Onboarding sport coverage | ux-flow 3 (no triathlon at first-run) + 11 (step-counter skip; general_fitness unselectable) |
| 20. Calendar icon drift | ux-flow 8 (calendar.tsx SESSION_ICON lacks hyrox/rowing — blank cells post-deploy; same drift class already fixed in plan-preview) |
| 21. HRV baseline | hybrid F-H6 (absolute cutoffs vs baseline-relative graded modulation) |
| 22. Quiz placement | hyrox 11 + ux-flow 6 (Settings→About & Support; result card dead-ends) |
| 23. Integrations labeling | hybrid F-H7 near-term slice (capability exists, UI never says so) |
| 24. Station/roxzone trends | hyrox 9 (splits captured, no targets before / no trends after) |
| 25. Sign-in value preview | ux-flow 7 (G2: first screen for a stranger is a login box) |

Deferred below the cut (Ideas, kept on record, not ranked): hyrox 12 Doubles split planner,
hyrox 13 head-to-head comparison, hybrid F-H8 in-app blueprint content, ux-flow 14
sport-aware IA (L; partially served by entries 6-8), ux-flow 12 experience-tier inert.

---

## Ranked list

### 1. Purge the last old-brand pixels (teal mascot, gold Log/Calendar, red Hyrox stations) — Important / S
The single fastest "feels revamped" win. The Ozzie mascot renders hardcoded `#00c8c8` teal
brows on Home, welcome, paywall, ask-ozzie, and run/endurance (`OzzieMascot.tsx:45-46`,
`OzzieAvatar.tsx:39-40`) — old-brand color on the very first screens anyone opens.
Plus: log.tsx gold x5 + raw `rgba(200,154,0,…)` (L820-825, 1110-1112, 1183-1188);
calendar.tsx decorative RACE DAY gold (L214, 343-344); workout/hyrox.tsx stations
identity-coded with danger `Colors.red` though `ChartPalette.hyrox` exists, + frosted
`borderGreen` (L362); run.tsx `Colors.textMuted` (L510); device-calendar blocks written
teal (`calendar-blocking.ts:60`). Note: log.tsx gold was previously judged functional
(rest-day chips) — re-decide deliberately, but the raw rgba literals are drift regardless.

### 2. Unify component grammar: chips, borders, shadows, type tokens — Important / M
The design auditor's headline: grammar drift is now a bigger coherence problem than color.
Two pill grammars coexist (radius 20 x10 sites, 24 x5) — log.tsx mixes radius-20 and
radius-4 chips in adjacent rows (L1165 vs L1176). 46 literal `1` + 5 `1.5` + 5 `2` border
widths bypass `BorderWidth.card` (71 uses). The system's signature `Shadow.emphasis` is
reachable only via `Card emphasis` and used at exactly 3 sites — every other card is flat.
53 inline `SpaceGrotesk_700Bold` declarations across 27 files with hand-picked sizes; no
type tokens; `SpaceGrotesk_500Medium` loaded at boot, used by zero styles. Add chip/border/
type tokens, apply mechanically, extend the emphasis shadow to key cards. This is what
makes 30 screens read as ONE system in the simulator.

### 3. Home's primary CTA on a no-plan account starts a GPS run for "No Session Planned" — Critical / S
Fresh-account simulator run hits this immediately: the session card falls back to
`{type:'No Session Planned', ozzieNote:"Ozzie is still crunching today's read."}`
(DailySummary.tsx:64-71), the button stays enabled, and `handleStartSession`'s switch
default routes to `/workout/run` (index.tsx:71-73). The note also promises a plan that was
never built. Disable/repoint the CTA to Build-plan and fix the copy.

### 4. Show the athlete's OWN numbers on the session card and plan-preview detail — Important / S
Home says "Zone 2" (daily-summary.ts:317 → DailySummary.tsx:286-289) but never "Zone 2 ·
9:35–10:20/mi," though `useDisplayZones` already has the numbers. Plan-preview's session
detail gates macros on `isViewOnly` (plan-preview.tsx:181) — the highest-attention moment
(right after generating) shows no fuel — and interval segments show effort words with no
pace (L156-169). Tiny renders, outsized "this app knows ME" effect; blueprint spec is
zone + purpose + fuel and only purpose is served.

### 5. Execute the Phase-3 atomic go-live (generator + 5 migrations), then device smoke test — Critical / S
The deployed ozzie-generate-plan predates the entire Phase-3 sport-guidance system: a Hyrox
(or ultra/powerlifting/crossfit) athlete generating a plan tonight gets a generic run/lift
plan — none of `hyroxGuidance()` (guidance.ts:90-105) reaches them. The work exists and is
committed; this is the gating item for every plan-quality win and the purest instance of
"the win is in the repo, not the experience." REC-002 hyrox sessions ride along.

### 6. Build the mobile "Your Prescription / My Zones" surface (port webapp's rendering) — Critical / L
The biggest structural gap, confirmed by a full render ledger: %1RM working loads, Prilepin
ranges, RPE/RIR, attempt plans, hyrox compromised split + station loads, crossfit loads +
Fran tier, in-session carb g/hr — computed by `computeEnvelope`, consumed ONLY by the LLM
prompt string, never rendered on mobile (coaching C1). Mobile's only zone surface shows 2
of ~5 bands on one buried screen (ZonesCard in plan-preview). The webapp already renders
all of it (StrengthZones.tsx:147, 202, 330) — the intelligence renders only on the surface
the user isn't looking at. Persist the envelope (or shared hook) as the single render
source — this also fixes useDisplayZones' hardcoded 'Base' phase and unlocks entries 4, 8,
12 cheaply. Echo the Fran tier while in there.

### 7. Surface the race hub on Home (NEXT UP countdown strip) — Critical / M
The product's benchmark-verified strongest feature (race countdown, morning checklist,
briefing — hyrox audit-checklist row 5 "Exceeds") is invisible: it hangs off a chip row
inside the Stats tab, 2 taps deep behind analytics. Home never mentions the next race.
A countdown strip on Home + rethinking the Stats chip-hub (Stats currently fronts Races,
Challenges, Calendar, Routes AND the paywall) is the headline IA fix.

### 8. Ship the Hyrox pacing experience end-to-end — Critical / L
The benchmark's flagship tool class (every competitor's front door) has zero presence:
`predictCompromisedRunSplit`'s only consumer is the LLM prompt; the live runner labels
every run segment "1km" with no pace target (workout/hyrox.tsx:302, 376); recap shows no
delta vs target; goal time is used only retroactively. One natural build: collect
`targetTimeMinutes` on the two division screens (declared, hardcoded empty at
preferences.tsx:232 / baseline.tsx:133) → sanity-band it against published finish-time
tiers (none exist in-app; a first-timer entering 55:00 gets no feedback) → phase the model
(runs 1-3 slower / 4-6 target / 7-8 negative; currently one flat range) → render a
16-segment pacing board + live runner targets + recap deltas. Also default the runner's
division from stored `goal_params.division` instead of re-asking every session. Threshold-
anchored + phased beats all three competitor models — no one combines both.

### 9. Resolve the Ozzie dead surface: park ask-ozzie now; REC-001 action-chat when billing allows — Important / M
Onboarding is fully Ozzie-voiced ("This is how I'll greet you every morning") but the
shipped IA has zero conversational surface: the Home entry is commented out
(index.tsx:143-144) and `ask-ozzie.tsx` is fully orphaned, its own copy admitting "Two-way
conversations with Ozzie aren't live yet." Near-term (S): remove the dead screen/copy.
Real fix (M, blocked on the known OpenAI billing decision): HYBRD Brain's differentiator is
chat that ACTS — and OSPREY already ships the mutation primitives (swapSession,
compressSession, moveIndoors, deload accept); REC-001 is intent-parsing over existing
mutations with a confirm step.

### 10. Render heart-rate data: post-workout HR trace with zone bands + time-in-zone — Important / M
`avg_heart_rate` per workout and `heart_rate` per GPS track point are stored
(workouts.ts:181,199,336,358,443); live HR is readable mid-workout — and no screen renders
any of it. Recap shows splits/duration only; Stats' only line chart is CTL/ATL. hybrd's
screenshot-verified dashboard leads with exactly this (HR-over-session with zone gridlines).
Pure rendering; all inputs exist.

### 11. Hybrid identity tiles: cardio/strength split + easy/hard vs weekly load target — Important / M
The identity metric of a hybrid athlete appears nowhere: load collapses to duration-based
TSS regardless of modality (performance.ts:257-260 — an hour of squats scores like an hour
of jogging), and `targetWeeklyLoad` + `hardSessionShareMax` (the 80/20 cap) constrain every
generated week yet never visualize. hybrd's headline widget is the cardio/strength bar.
First slice (S): bucket session_type hours into two tiles on Home/Stats. Then (M): a
muscular-load axis from `weekVolumeKg`.

### 12. Race-week fueling block: show the carb/sodium/caffeine numbers already computed — Important / S
`hyroxInRaceCarbGPerHour`, sodium mg/hr, caffeine mg at THIS athlete's bodyweight flow only
into the LLM prompt; race-event.tsx greps clean for pace/sodium/caffeine/carb, and the race
morning checklist has generic gels/hydration checkboxes. Benchmark row 7 rated the math
"Exceeds" while presentation "wasn't checked" — now checked: there is none. $0,
deterministic, data in hand.

### 13. One zone truth: make in-run guidance consume the envelope's threshold — Important / S
run-guidance.ts derives its own bands from the best logged run and returns null with no
logged run ≥1mi, while resolveZones happily estimates from onboarding anchor or tier. So a
new athlete gets NO in-run targets while ZonesCard shows zones for the same person, and a
typed threshold is ignored in-run. One athlete, two truths — a correctness bug in the
product's core promise.

### 14. First-run polish: instructive tab empties + kill dev-voice copy — Important / S
Stats' empty state leads with the paywall then "No workouts logged yet this period." with
no CTA; Log's "Nothing logged yet today." is inert. Copy violating the blueprint voice
rule: "everything saves to your training load" (workout.tsx:106), "generate one from the
home screen first" (races.tsx:633), "Ozzie is still crunching today's read." shown
indefinitely. Also label the Health connect row "Works with Apple Watch, Garmin, WHOOP…"
(the import capability already exists; the UI never says so — hybrid F-H7's S slice).

### 15. Hyrox race discovery: a Hyrox athlete cannot find a Hyrox race — Important / L
race-search.ts:158 pins `event_type=running_race`; canonicalDistance() nulls anything
non-running; race-event.tsx can't express a Hyrox event; the discovery blurb says "Search
50,000+ running events" in a 9-sport app. The flagship search → "Train for This Event"
flow (incl. the freshly-shipped REC-001 handoff) is structurally unreachable for the
benchmark's sport. Needs an event source (curated hyrox.com season seed to start) behind a
sport filter, with the handoff carrying `division`.

### 16. Station technique cues at the point of need — Important / M
During a live wall-balls segment the athlete sees "🏐 Wall Balls · 100 reps · 6kg" and
nothing else; `HyroxStationDef` has no cue/mistake/break-strategy fields. All three
benchmark exemplars ship 8-station technique libraries, and the content is already captured
verbatim in the skill sources ("break into sets of 10 from rep 1"; sled "45° lean…
overcooking costs 3-4 min"). Extend the type, render 2-3 cues on the active card + a
tappable station sheet.

### 17. Make interference management visible (the app's stated wedge) — Important / M
`grep -ri interference` across both apps → one docs citation. The engine-side treatment is
one prompt sentence; validate.ts never checks hard-day adjacency; no screen shows cardio
hours vs the 6h threshold or day-separation quality. hybrd PUBLISHES the ruleset but
admits no implementation — the clearest chance to out-product them on their own physiology:
plan-preview/calendar adjacency badge, weekly cardio-hours meter, validator check.

### 18. Travel and illness adaptations + brief-to-action chips — Important / M
The Adjust sheet has swap/compress only — no "traveling / no equipment" (HYBRD's
screenshot example) and no "feeling sick" downgrade flow. The $0 daily brief narrates
weather but never links the move-indoors mutation sitting one card lower. Both are new
options over existing swap machinery; OSPREY already exceeds hybrd on proactive cards
(deload, weather) — this closes the coverage gap.

### 19. Onboarding sport coverage: triathlon missing; step-counter skip — Important / M
A new triathlete cannot state their sport at first run: goals.tsx lacks 'triathlon' though
preferences.tsx offers it, goal-map.ts comments the discrepancy, a full blueprint and a
shipped predictor exist. Also "Step 3 of 5" jumps to "Step 5 of 5" for non-baseline goals,
and `general_fitness` exists in PrimaryGoal but is selectable nowhere.

### 20. Calendar can't render hyrox/rowing sessions — Important / S
calendar.tsx:19-27 SESSION_ICON (and the legend) lack hyrox/rowing keys, so month cells
render blank for those sessions. The identical drift was found+fixed in plan-preview.tsx
during REC-002; calendar.tsx was missed. Becomes a visible bug the moment entry 5 deploys —
pair them.

### 21. Baseline-relative HRV with a graded fourth tier — Important / M
healthkit.ts:101-107 scores HRV on absolute population cutoffs (+10 if >60ms) and a 3-way
train/easy/rest gate. Benchmark rule: 14-day baseline, and graded modulation (10-20% below
→ cut volume 20-30% hold intensity). `recovery_scores` already stores daily hrv_ms, so the
baseline is computable from data on hand; the new tier feeds entry 18's copy.

### 22. Hyrox quiz: buried in Settings→About & Support, result dead-ends — Minor / S
Sole entry point sits one row above the privacy policy; a Hyrox-goal athlete living in
Home/Workout/Races never sees it, and the result card offers only "Try Again" — no onward
edge to a plan, stations, or races.

### 23. Station/roxzone history: targets before, trends after — Minor / M
OSPREY's genuinely distinctive capability (deriving roxzone from real timestamps — the
benchmark says trainrox only predicts it) surfaces as one number once. No per-transition
breakdown, no "your sled push across 6 sims," no Stats splits view. Existing saved
`hyroxSplits` data; no new capture. Rides on entry 8's pacing board for the "before" half.

### 24. Sign-in screen shows zero value promise — Minor / M
G2 confirmed on mobile: wordmark + tagline, no sport breadth or feature preview; the
9-sport promise first appears at onboarding step 3. Lower priority than in-app coherence
for the current complaint, but it's the first screen every stranger sees.

### 25. (Watchlist / Ideas — not ranked) 
Doubles split planner (format knowledge fully captured in skill sources); self-vs-self race
comparison as phase 1 of head-to-head; in-app per-sport coaching guides from the 9
blueprints; sport-aware Home/Workout modules (partially delivered by entries 6-8);
experience-tier promise ("what metrics I focus on") never gates any display.

---

## Suggested sequencing for a "feels revamped" sprint

- **Day-1 visual sweep (entries 1, 3, 4, 20, 14):** all S; together they eliminate every
  old-brand pixel, the worst first-run trap, and put personal numbers on Home.
- **Deploy gate (entry 5):** S, unlocks plan quality for 4 sports; smoke test on device.
- **System pass (entry 2):** the grammar tokens — one mechanical M pass, app-wide payoff.
- **Headline builds (entries 6, 7, 8):** the prescription surface, the Home race strip, and
  the Hyrox pacing pipeline — these are the "transformed app" features; 6 unblocks pieces
  of 4, 8, and 12 via the persisted envelope.
- **Benchmark parity track (entries 9-13, 15-18):** schedule against appetite; 12 and 13
  are S and can join the day-1 sweep if desired.
