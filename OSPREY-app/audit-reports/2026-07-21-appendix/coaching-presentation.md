# Coaching-Intelligence Presentation Audit — how much of the engine actually RENDERS

Dimension: does the coaching engine's computed intelligence reach the athlete's eyes, at the right
moment, on mobile? Date: 2026-07-21. Read-only pass over `OSPREY-app` + `webapp` + `docs/coaching/`
+ both benchmark skills.

## Method

Traced every artifact computed by `src/services/coaching/envelope.ts` (`computeEnvelope`) and
`src/services/performance.ts` to its display sites via grep + reading the screens. Key display
files read in full: `app/plan-preview.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/stats.tsx`,
`src/components/ZonesCard.tsx`, `src/hooks/useDisplayZones.ts`, `app/workout/hyrox.tsx`,
`src/screens/DailySummary.tsx` (scanned), `app/workout/run.tsx` + `src/services/run-guidance.ts`,
`app/workout/lift.tsx` (scanned), `app/workout/recap.tsx` (scanned), `src/services/nutrition.ts`,
`src/services/daily-summary.ts`, `webapp/src/features/settings/StrengthZones.tsx` +
`TrainingZonesCard.tsx` (scanned), `supabase/functions/ozzie-generate-plan/index.ts` (scanned).

## The render ledger — every envelope artifact, does ANY mobile screen show it?

| Envelope artifact (envelope.ts:23-36) | Computed where | Renders on mobile? | Where / why not |
|---|---|---|---|
| `zones` (full multi-band ZoneSet per sport) | `resolveZones` envelope.ts:64-117 | **Partial — 2 of ~5 bands, 1 buried screen** | `ZonesCard` (plan-preview only) shows Easy+Threshold rows only (ZonesCard.tsx:75-119) |
| `hrZones` | envelope.ts:145-146 | Partial | Only as ZonesCard fallback when no pace zones |
| `fuel.dailyCarbGByDayType` (easy/mod/high/peak) | fuel.ts:25-65 | **No (only via LLM prompt prose)** | Prompt line: ozzie-generate-plan/index.ts:374. Mobile macros come from a separate edge fn (`ozzie-nutrition-coach`, nutrition.ts:52) |
| `fuel.longSessionCarbGPerHour` (in-session g/hr) | fuel.ts | **Never, anywhere** | grep: zero display usages |
| `strength` (%1RM, zone, Prilepin, RPE/RIR, fatG, attempts) | strength.ts:19-43 | **Never on mobile** | grep across app/ + components: zero hits. Webapp renders working loads (StrengthZones.tsx:147) |
| `hyrox.compromisedRunSplitSecPerKm` | hyrox.ts:31 | **Never on mobile** | Webapp renders it — buried in Settings (StrengthZones.tsx:330) |
| `hyrox.stationWeights` | hyrox.ts:32 | Yes | workout/hyrox.tsx:81 — but recomputed independently; user must re-pick division every session (hyrox.tsx:69-96) though `goal_params.division` is stored |
| `hyrox.sodiumMgPerHour`, `hyrox.caffeineMg` | hyrox.ts:33-34 | **Never, anywhere** | grep: zero display usages on either surface's race-day flow; race-event.tsx has no fuel/pacing lines |
| `crossfit` (loads, %1RM, energy systems, Fran tier, benchmark-by-phase) | crossfit.ts:20-40 | **Never on mobile** | Webapp Settings renders loads (StrengthZones.tsx:202); Fran tier collected at onboarding, never echoed back |
| `targetWeeklyLoad` (TSS) + `hardSessionShareMax` (80/20 cap) | envelope.ts:124-158 | **Never** | Home week bar is km-based (`weekTargetKm`), a different quantity; no intensity-split view anywhere |
| `phase`/`weekNumber`/`totalWeeks` | envelope.ts | Yes | plan-preview race card phase track (plan-preview.tsx:418-456) |

Performance-side artifacts (these DO render — the one bright spot):
- CTL/ATL/TSB + chart → Stats (stats.tsx:333-376, Plus-gated); readiness → Home ReadinessCard (DailySummary.tsx:251-253, Plus-gated)
- Injury risk (ACWR) → Stats banner (stats.tsx:311-331) + Home DeloadSuggestionCard
- Riegel race predictor + triathlon splits predictor → Stats (stats.tsx:378-432, Plus-gated)

## Findings

### C1 (Critical) — The per-sport prescriptions are invisible intelligence on mobile
`computeEnvelope` builds athlete-specific strength (%1RM working loads, Prilepin rep ranges,
RPE/RIR, Peak/Taper attempt plans — strength.ts:37-42), hyrox (compromised-run split, sodium mg/hr,
caffeine mg — hyrox.ts:29-35), and crossfit (phase loads, energy-system zones, benchmark plan —
crossfit.ts:28-39) prescriptions. Their ONLY consumer is the LLM prompt string
(ozzie-generate-plan/index.ts:370-377). A grep of `app/`, `src/components/`, `src/hooks/` finds
zero renders. The envelope is also never persisted — computed in `invokeGeneratePlan`
(build-envelope.ts:159-163), POSTed, discarded. This is the precise mechanism behind "the app
doesn't feel like the benchmark promised": the engine outperforms hyroxlab/trainrox on paper
(skill audit-checklist rows 1, 7) while the athlete sees none of it. The checklist itself flagged
this caveat: row 7 — "presentation/UX of these numbers to the athlete wasn't checked."
Target: a per-sport "Your prescription" surface (Home card + plan-preview section) rendering the
envelope's numbers; persist the envelope (or recompute via a shared hook, as webapp already does
client-side with strength-loads.ts / hyrox-loads.ts / crossfit-zones.ts). Effort: L.

### C2 (Critical) — Two parallel zone systems that can disagree
In-run guidance derives its own pace bands from Riegel on the best logged run
(run-guidance.ts:34-50) and returns **null** (effort labels only) when there is no logged run ≥1 mi
(run-guidance.ts:36). The coaching engine for the same athlete resolves a threshold from
self-report anchor OR logged data OR fitness-tier fallback (envelope.ts resolveZones:64-117,
anchor.ts). Consequences: (a) an athlete who typed a threshold in onboarding gets in-run targets
that ignore it; (b) a new athlete gets NO in-run pace targets while ZonesCard happily shows
tier-estimated zones for the identical person; (c) ZonesCard's threshold and the in-run band's
implied threshold can differ. One athlete, two truths. Target: `fetchPaceBands` consumes
`resolveZones` (self-report → data → tier), same anchor everywhere. Effort: S-M.

### C3 (Critical) — Hyrox race runner never shows the run pace target it exists to hit
The signature computation of the hyrox blueprint — compromised-run split (docs/coaching/hyrox.md:90
"plan compromised-run splits at ~threshold + 15–30 s/km"; predictCompromisedRunSplit in
calculators/hyrox.ts:24) — does not appear during a Hyrox session. The live runner labels every run
segment "1km" with no pace (workout/hyrox.tsx:302, 376), and the recap shows split durations with
no target comparison (recap.tsx:153-167). The station half is served (weights render); the running
half — the half the blueprint calls the race decider (hyrox.md:19) — is unguided. Benchmark: pacing
targets are the core product of ALL four competitor tools (skill audit-checklist rows 1, 1b, 15).
Target: show the athlete's target split on run segments + delta vs target in recap. Effort: M.

### I1 (Important) — Today's session card says "Zone 2" but never YOUR Zone 2
Home's session card renders a generic zone label mapped from intensity
(daily-summary.ts:317 `intensityToZone` → "Zone 2"/"Zone 4"; rendered DailySummary.tsx:286-289).
The engine knows this athlete's actual Zone 2 pace/HR (resolveZones + hrZones). The one moment the
number matters most — about to start today's session — shows the label without the number, while
the personalized numbers sit on plan-preview, reachable only via Settings or post-generation.
Blueprint: every sport's zones are the anchor of every session (docs/coaching/_index.md:18).
Target: session card shows "Zone 2 · 9:35–10:20/mi" (or bpm/watts/split by sport) from
useDisplayZones. Effort: S.

### I2 (Important) — ZonesCard renders 2 bands of a 5-band system, on one screen
`runningPaceZones` returns the full Daniels ladder (E/M/T/I/R + 5K/10K paces — used by webapp
TrainingZonesCard.tsx:95), hyrox.md:80-88 specifies a 5-zone table, but mobile's only zone surface
(ZonesCard.tsx:82-118) collapses everything to Easy + Threshold and appears solely inside
plan-preview.tsx:488. There is no "My Zones" destination on mobile. Also `useDisplayZones` swallows
read errors into "no card" (useDisplayZones.ts:65, known follow-up) and hardcodes phase 'Base'
(useDisplayZones.ts:49), so anything phase-dependent could never render through it.
Target: full per-sport zone table (a tab under Stats or Settings→Training Zones like webapp),
error state distinct from "lift goal". Effort: M.

### I3 (Important) — Race-day fuel intelligence exists but has no race-day surface
Computed: sodium 500–1000 mg/hr, caffeine 3–6 mg/kg scaled to THIS athlete's body weight
(hyrox.ts:33-34), in-race carbs g/hr per sport (fuel.ts:18-23), gut-trained ultra scaling.
Blueprint requires exactly this content at race prep (hyrox.md:113-123 nutrition table;
_index.md:43). `app/race-event.tsx` models packet pickup, checklist, AI briefing — but greps clean
for pace/sodium/caffeine/carb. The moment (race week / race morning) exists as a screen; the
numbers never board it. Skill row 7 rated OSPREY "Exceeds" competitors on computing these — while
zero of it renders. Target: "Race fuel plan" block on race-event + taper-week plan-preview.
Effort: M.

### I4 (Important) — Mobile is the surface behind: webapp already renders what mobile doesn't
Webapp Settings renders strength working loads by phase, crossfit loads + Fran tier + benchmarks,
hyrox station weights + compromised split (StrengthZones.tsx:147, 202, 330) via its own ported libs.
The iOS app — the surface the user actually reviews — has no equivalent screen. The user's
complaint is structurally guaranteed: the intelligence renders only on the surface they aren't
looking at, and even there it's buried in Settings. Target: port the webapp's
StrengthZones/TrainingZones rendering to a mobile screen in ink/amber. Effort: M.

### I5 (Important) — Post-generation plan preview hides fuel; session detail never shows zone pace
SessionDetailPanel gates macros on `isViewOnly` (plan-preview.tsx:181), so the moment right after
generating a plan — the highest-attention moment in the app — shows workout+why but NO fuel
section. And the "WORKOUT" section shows an intensity chip (plan-preview.tsx:127-131) with no
personal pace/HR band for that intensity, though ZonesCard data is already on the same screen.
Interval segments show effort words with no pace (plan-preview.tsx:156-169). Blueprint session spec
is zone + purpose + fuel (_index.md:16-20; per-sport §3+§6). Purpose (ozzie_notes) is the one part
fully served. Target: macros in both modes; per-session zone band line. Effort: S-M.

### I6 (Important) — Weekly load target and the 80/20 rule never visualize
`targetWeeklyLoad` (TSS, incl. ultra taper math — envelope.ts:124-141) and `hardSessionShareMax`
(0.2 polarization cap, cited to _index.md:16) constrain every generated week but no screen shows
"this week's load target: 240 TSS" or an easy/hard intensity split. Home's week bar is km
(index.tsx:135-136), Stats' bars are hours by sport (stats.tsx:162-190). The hybrd benchmark's
dashboard leads with exactly an intensity-split visual (hybrid audit-checklist row 2). All inputs
already exist client-side (per-session intensity + minutes). Target: intensity-split bar (easy vs
hard %) + weekly load vs target on Stats or Home. Effort: M.

### M1 (Minor) — Hyrox runner re-asks division every session
workout/hyrox.tsx:69-96 starts at a division picker although `user_goals.goal_params.division` is
persisted (hyrox-params.ts). Default from stored division, keep picker as override. Effort: S.

### M2 (Minor) — CrossFit benchmark intelligence collected then never echoed
Onboarding takes Fran time; `franTier` grades it and `BENCHMARK_BY_PHASE` schedules a retest
(crossfit.ts:10, 33-38) — athlete never sees tier or "this phase: test Fran". Competitor content
treats benchmark tracking as core CrossFit UX. Effort: S (render), M (log/retest loop).

### IDEA-1 — Persist the envelope; make it the single render source
Four divergent recomputation paths now exist (build-envelope.ts, useDisplayZones.ts,
run-guidance.ts, webapp's lib/*). Persisting the envelope at generation (plan row or
`plan_envelope` table) gives every surface the same numbers, unlocks phase-correct display
(fixes useDisplayZones' hardcoded 'Base'), and enables C1/I4 cheaply. Effort: M.

### IDEA-2 — Goal-time pacing plan from `targetTimeMinutes` (collected, unused)
`hyroxParams.targetTimeMinutes` is parsed and stored (hyrox-params.ts:8) but consumed by nothing
(known follow-up; confirmed — buildHyroxPrescription reads only `division`, hyrox.ts:21). Skill
rows 1b + 15 define the winning model: OSPREY's threshold anchor + phased splits (runs 1-3 slower,
4-6 at target, 7-8 negative) + per-station time targets — no competitor combines individual
anchoring with phased pacing. This is the single highest-leverage net-new render for the Hyrox
experience. Effort: M-L.

## What already renders well (for balance)
Readiness/TSB (Home + Stats), injury risk + deload suggestion, Riegel + triathlon predictors,
lift e1RM trends/PRs, hyrox roxzone measurement in recap (genuinely distinctive — skill row 9),
weather/hydration/macro coaching on Home, session "why" notes. The analytics half of the engine
reaches the screen; the *prescriptive* half (zones-in-context, loads, race fuel, pacing) does not
— and prescription is exactly what a "coach" app is expected to feel like.
