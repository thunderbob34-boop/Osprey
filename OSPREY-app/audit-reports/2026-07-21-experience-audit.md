# OSPREY Mobile — Experience Audit (2026-07-21)

**Trigger:** the user reviewed the app in the iOS simulator after the 2026-07-20 competitive-benchmark sprint and reported it did not feel revamped. This audit answers *why*, and what to do about it.

**Method:** five parallel dimension auditors (design-system consistency, Hyrox benchmark delivery, hybrid benchmark delivery, UX/IA/first-run, coaching-engine presentation), a merge/prioritization judge, and a completeness critic — all read-only against `main` at `e6b428e`, every finding citing a real file path or benchmark source. Full per-dimension detail in [`2026-07-21-appendix/`](2026-07-21-appendix/). Current-state screenshots captured from the Expo web preview at mobile viewport.

---

## The one-sentence diagnosis

**Every benchmark "win" OSPREY has lives in `src/services/**` or an undeployed edge function; every competitor win lives on a screen the athlete actually looks at.** The engine outperforms the competition. The athlete sees almost none of it.

Three of the five auditors reached that conclusion independently.

## Why last sprint didn't move the needle

The benchmark sprint produced two high-quality skills and shipped three backlog items (calendar→plan handoff, a webapp chart, a Hyrox quiz). All three were real, reviewed, and correct. But:

- **REC-001** put a button on a screen a Hyrox athlete can't reach with a Hyrox race (race search is hardwired to running events — finding #15).
- **REC-002** shipped a chart to the *webapp* — the surface the user wasn't reviewing.
- **REC-003** put a quiz one row above the privacy policy in Settings.

None of them touched Home, the session card, the workout runner, or the plan — the four surfaces the user actually opened in the simulator. The sprint's *research* was about what competitor experiences feel like; the *execution* was three isolated features. That gap is the complaint.

## Correction to a standing assumption

Project memory says "~49 files on old Colors" and that the Workout and Stats tabs are unmigrated. **That is stale.** The design auditor enumerated all 42 screen files: every screen imports `@/constants/theme` and is Theme-dominant (`stats.tsx` 76 Theme refs vs 3 functional Colors; `lift.tsx` 97 vs 5). Workout and Stats landed on `main` in commits `1f6cceb`/`0d35ab3`/`85c1297`/`c7d8058`/`f396382`/`0fceb16`.

The color migration is essentially **done**. The residual incoherence is (a) a short list of true brand-color leftovers and (b) component-grammar drift — which is now the bigger problem. Memory has been corrected.

---

## Findings — ranked by "what makes the simulator feel transformed"

Severity: **Critical** = user-visible incoherence or a broken promise · **Important** = clear gap vs benchmark/design system · **Minor** = polish.

### Tier 1 — the visual sweep (all S, one day)

**1. Old-brand pixels survive on the first screens anyone sees — Important / S**
The Ozzie mascot renders hardcoded `#00c8c8` teal brows — literally commented "Teal brand accent" — on welcome, Home, paywall, and ask-ozzie (`OzzieMascot.tsx:44-46`, `OzzieAvatar.tsx:39-40`). Plus Log's gold chips (`log.tsx:1110-1112, 1183-1188, 820-825`, incl. raw `rgba(200,154,0,…)` literals), Calendar's decorative RACE DAY gold (`calendar.tsx:214, 343-344` — the same decorative race-gold already migrated on Settings), Hyrox stations identity-coded with danger `Colors.red` though `ChartPalette.hyrox` exists (`workout/hyrox.tsx`), and device-calendar blocks written in teal (`calendar-blocking.ts:60`).

*Note:* Log's gold was previously judged **functional** (rest-day vs training-day contrast). That judgment is now obsolete — its contrast partner migrated from teal to amber, so gold-next-to-amber reads as an off-shade mistake rather than a distinction. Re-decide deliberately.

**2. The app icon and splash are pure old brand — Important / S** *(critic catch; no dimension auditor covered it)*
`app.json` sets splash and adaptive-icon `backgroundColor: "#060912"` — that is old `Colors.bg`, not `Theme.ink` `#09090B` — behind a teal Ozzie in `icon-1024.png`/`splash.png`. **These are the literal first pixels of every launch**, and they are from the design system the app no longer uses.

**3. Home's primary CTA starts a GPS run for "No Session Planned" — Critical / S**
On a fresh account the session card falls back to `{type:'No Session Planned', ozzieNote:"Ozzie is still crunching today's read."}` (`DailySummary.tsx:64-71`), the button stays **enabled**, and `handleStartSession`'s switch default routes to `/workout/run` (`index.tsx:71-73`). The note also promises a plan that was never built. This is the first thing a new user hits.

**4. The session card never shows the athlete's own numbers — Important / S**
Home says "Zone 2" (`daily-summary.ts:317` → `DailySummary.tsx:286-289`) but never "Zone 2 · 9:35–10:20/mi", though `useDisplayZones` already holds the numbers. Plan-preview's session detail gates macros on `isViewOnly` (`plan-preview.tsx:181`), so the highest-attention moment — right after generating a plan — shows no fuel; interval segments show effort words with no pace (`L156-169`). The blueprints specify zone + purpose + fuel; only purpose is served.

**5. Calendar can't render hyrox/rowing sessions — Important / S**
`calendar.tsx:19-27` `SESSION_ICON` and its legend lack `hyrox`/`rowing` keys, so those cells render blank. The identical drift was found and fixed in `plan-preview.tsx` during REC-002; calendar was missed. Becomes visibly broken the moment #6 deploys.

**6. First-run polish — Important / S**
Stats' empty state leads with the **paywall**, then "No workouts logged yet this period." with no CTA. Log's "Nothing logged yet today." is inert. Dev-voice copy violating the blueprint voice rule: "everything saves to your training load" (`workout.tsx:106`), "generate one from the home screen first" (`races.tsx:633`), and "Ozzie is still crunching today's read." shown indefinitely.

### Tier 2 — the deploy gate

**7. The Phase-3 coaching engine is built, committed, and NOT DEPLOYED — Critical / S**
The deployed `ozzie-generate-plan` **predates the entire Phase-3 sport-guidance system**. A Hyrox, ultra, powerlifting, or CrossFit athlete generating a plan right now gets a generic run/lift plan — none of `hyroxGuidance()` (`guidance.ts:90-105`) reaches them. The repo's generator emits compromised splits, station weights, and an escalating ×6→×8 progression; production has none of it.

**This is the single highest-leverage item in the audit.** It is the purest instance of the diagnosis: the win is in the repo, not the experience. It gates every plan-quality improvement for four sports, and it's an S — the work is already written and committed. Needs the atomic deploy (generator + 5 migrations) plus a device smoke test.

### Tier 3 — the system pass

**8. Component-grammar drift is now a bigger coherence problem than color — Important / M**
Two chip grammars coexist (radius 20 at 10 sites, 24 at 5) against a 4px system — `log.tsx` mixes radius-20 and radius-4 chips in **adjacent rows** (`L1165` vs `L1176`). 46 literal `1` + 5 `1.5` + 5 `2` border widths bypass `BorderWidth.card`. The system's signature `Shadow.emphasis` is reachable only via `Card emphasis` and used at exactly **3 sites** — every other card is flat. 53 inline `SpaceGrotesk_700Bold` declarations across 27 files with hand-picked sizes and no type tokens; `SpaceGrotesk_500Medium` is loaded at boot and used by zero styles. `ScreenHeader` is adopted on 11 standalone screens but hand-rolled in `plan-preview.tsx:384,587` and absent on `preferences.tsx:714`/`food-scanner.tsx:233`, so headers change mid-flow.

This is what makes 30 individually-themed screens fail to read as **one** system.

### Tier 4 — the headline builds (this is where "transformed" comes from)

**9. Build the mobile prescription/zones surface — Critical / L**
The biggest structural gap, confirmed by a full render ledger: %1RM working loads, Prilepin ranges, RPE/RIR, attempt plans, Hyrox compromised split + station loads, CrossFit loads + Fran tier, in-session carb g/hr — **all computed by `computeEnvelope`, consumed only by the LLM prompt string, never rendered on mobile.** Mobile's only zone surface shows 2 of ~5 bands on one buried screen. The webapp already renders all of it (`StrengthZones.tsx:147, 202, 330`) — the intelligence renders only on the surface the user isn't looking at. Persisting the envelope as a single render source also fixes `useDisplayZones`' hardcoded `'Base'` phase and unlocks #4, #11, and #13 cheaply.

**10. Surface the race hub on Home — Critical / M**
OSPREY's benchmark-verified strongest feature (race countdown, morning checklist, briefing — rated "Exceeds") hangs off a chip row **inside the Stats tab**, two taps deep behind analytics. Home never mentions the next race. A countdown strip on Home is the headline IA fix.

**11. Ship the Hyrox pacing experience end-to-end — Critical / L**
The benchmark's flagship tool class — every competitor's front door — has zero presence. `predictCompromisedRunSplit`'s only consumer is the LLM prompt. The live runner labels every run segment "1km" with **no pace target** (`workout/hyrox.tsx:302, 376`); recap shows no delta vs target; goal time is used only retroactively. `targetTimeMinutes` is declared and hardcoded empty at `preferences.tsx:232`/`baseline.tsx:133`. There are no published finish-time bands, so a first-timer entering 55:00 gets no reality check. And the runner re-asks division every session instead of defaulting from `goal_params.division`.

One natural build: collect target time → sanity-band it → phase the model (runs 1-3 slower / 4-6 target / 7-8 negative, vs today's one flat range) → render a 16-segment pacing board, live runner targets, and recap deltas. **Threshold-anchored + phased beats all three competitor models — none of them combines both.**

**12. A Hyrox athlete cannot find a Hyrox race — Important / L**
`race-search.ts:158` pins `event_type=running_race`; `canonicalDistance()` nulls anything non-running; `race-event.tsx` can't express a Hyrox event; the blurb reads "Search 50,000+ running events" in a nine-sport app. The flagship search → "Train for This Event" flow — including the REC-001 handoff shipped yesterday — is **structurally unreachable for the benchmark's own sport.**

### Tier 5 — benchmark parity (schedule against appetite)

| # | Finding | Sev / Effort |
|---|---|---|
| 13 | **Race-week fueling never renders** — `hyroxInRaceCarbGPerHour`, sodium mg/hr, caffeine at bodyweight flow only into the prompt; the race checklist has generic "gels/hydration" boxes | Important / S |
| 14 | **One zone truth** — `run-guidance.ts` derives its own bands from logged runs and returns null without one, while `resolveZones` estimates happily. A new athlete gets no in-run targets while ZonesCard shows zones for the same person | Important / S |
| 15 | **Heart rate renders nowhere** — `avg_heart_rate` per workout and per-trackpoint `heart_rate` are stored (`workouts.ts:181,199,336,358,443`), live HR readable mid-workout, zero screens show any of it. hybrd's dashboard leads with exactly this | Important / M |
| 16 | **Hybrid identity invisible** — load collapses to duration-based TSS regardless of modality (`performance.ts:257-260`: an hour of squats scores like an hour of jogging); `targetWeeklyLoad` + the 80/20 `hardSessionShareMax` constrain every week and never visualize | Important / M |
| 17 | **Ozzie is a dead surface** — onboarding is fully Ozzie-voiced ("This is how I'll greet you every morning") but the Home entry is commented out (`index.tsx:143-144`) and `ask-ozzie.tsx` is orphaned, its own copy admitting conversations "aren't live yet". Near-term: delete it. Real fix blocked on your OpenAI billing call | Important / M |
| 18 | **Interference management invisible** — the app's *stated wedge*. `grep -ri interference` across both apps returns one docs citation; `validate.ts` never checks hard-day adjacency; no screen shows cardio hours vs the 6h threshold. hybrd publishes the ruleset but admits no implementation — the clearest chance to out-product them | Important / M |
| 19 | **Station technique cues absent** — during a live wall-balls segment the athlete sees "🏐 Wall Balls · 100 reps · 6kg" and nothing else. All three benchmark exemplars ship 8-station libraries, and the content is **already captured verbatim** in the skill sources | Important / M |
| 20 | **Travel/illness adaptations missing** — Adjust offers swap/compress only; no "traveling / no equipment" (HYBRD's own example) or "feeling sick" flow, over existing swap machinery | Important / M |
| 21 | **Onboarding sport coverage** — a triathlete cannot state their sport at first run (`goals.tsx` lacks it though `preferences.tsx` offers it, with a full blueprint and shipped predictor); "Step 3 of 5" jumps to "Step 5 of 5"; `general_fitness` is selectable nowhere | Important / M |
| 22 | **HRV uses absolute cutoffs** — `healthkit.ts:101-107` scores on population thresholds (+10 if >60ms) with a 3-way gate; benchmark rule is a 14-day personal baseline with graded modulation. `recovery_scores` already stores daily `hrv_ms` | Important / M |
| 23 | **Quiz buried + dead-ends** — one row above the privacy policy; result card offers only "Try Again" | Minor / S |
| 24 | **Station/roxzone history** — OSPREY derives roxzone from real timestamps (benchmark says trainrox only *predicts* it) and surfaces it as one number, once. No per-transition breakdown, no trends | Minor / M |
| 25 | **Sign-in shows zero value promise** — wordmark + tagline; the nine-sport promise first appears at onboarding step 3 | Minor / M |

### Critic catches — gaps no dimension auditor covered

- **Loading feel is unaudited.** Onboarding's finish awaits full LLM plan generation behind a bare button spinner (`health.tsx:40`; live stalls to 150s are documented), and its silent `.catch()` lands users in the #3 no-plan trap. No skeletons anywhere.
- **Equipment is never asked.** trainrox's onboarding step 3 is "Choose your equipment" (full gym / home / bodyweight). `grep equipment` across the whole app: **0 hits**. Every generated session assumes full access.
- **Race-rehearsal ramp unmapped.** hyroxvault's graded simulation ladder (mini → ¾ → full sim across weeks 9-11) has no equivalent; `grep simulation` in `guidance.ts` = 0.
- **Free-vs-Plus never assessed.** Home's ReadinessCard, CTL/ATL, predictors, and race briefing are Plus-gated — so several surfaces this audit credits as benchmark-matching are **invisible on a free account**.
- **Declared exclusion:** activity, friends, challenges, routes, supplements, and food-scanner received nav-edge and design-token coverage only, no experience-level review.

---

## What this means

The app is in better shape than the simulator session suggested — the color migration is done, the coaching engine is genuinely ahead of the competition, and the race features are best-in-class. But the athlete meets none of that, because:

1. The best engine work is **undeployed** (#7) or **unrendered** (#9).
2. The best product work is **buried** (#10, #12, #23).
3. The remaining old-brand pixels sit on the **highest-traffic** surfaces — the launch screen, the mascot, Home (#1, #2).

Fixing 1-8 is roughly two days and changes the entire first impression. Fixing 9-12 is what makes it feel like a different product.

**Sequencing plan:** [`docs/superpowers/plans/2026-07-21-experience-revamp-roadmap.md`](../../docs/superpowers/plans/2026-07-21-experience-revamp-roadmap.md)
**Target-state mockups:** [`design-mockups/2026-07-21-experience-revamp/`](../../design-mockups/2026-07-21-experience-revamp/)
