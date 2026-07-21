# Hyrox benchmark → app delivery gaps (full detail)

Audit dimension: what the hyrox-trainer-experience benchmark found that the APP still doesn't deliver.
Method: read all three benchmark files + 2 sources in full, then verified every claim against current code
(read-only). Every claim below cites a file:line actually opened this session.

Repo roots:
- App: `/Users/gusjohnson/App Development/Osprey/OSPREY-app`
- Edge fns: `/Users/gusjohnson/App Development/Osprey/supabase/functions`
- Skill: `/Users/gusjohnson/.claude/skills/hyrox-trainer-experience`

---

## 1. CRITICAL — The entire Hyrox coaching engine is invisible to a live user (undeployed)

**Now:** The repo's plan generator knows Hyrox: `supabase/functions/ozzie-generate-plan/index.ts:52`
(`session_type must be one of: run, lift, swim, bike, rowing, hyrox, cross, rest, race.`) and
`guidance.ts:90-105` (`hyroxGuidance()` — compromised splits, station weights at division loads,
signature compromised-running session escalating ×6→×8, race-day sodium/caffeine). But per the skill's
own REC-002 status note (`benchmark/product-recommendations.md` REC-002: "NOT deployable standalone —
the currently-deployed ozzie-generate-plan predates the entire Phase-3 sport-guidance system") the
**deployed** function has zero Hyrox awareness. A real Hyrox athlete who generates a plan tonight gets a
generic run/lift plan — none of the engine the benchmark says "Exceeds" competitors ever reaches them.
This is the exact shape of the user's complaint: the win is in the repo, not in the experience.

**Target:** Execute the already-planned Phase-3 atomic go-live (generator + its 5 committed migrations),
then smoke-test a Hyrox plan end-to-end on device (checklist row 12 / REC-002 both point here).

**Effort:** S (work exists; it's a deploy + device smoke test) — but it's the gating item for every
"plan quality" finding below.

## 2. CRITICAL — A Hyrox athlete cannot find a Hyrox race in the app

**Now:** Race discovery is hardwired to running races: `src/services/race-search.ts:158` pins
`event_type=running_race` on the RunSignup API; `race-search.ts:101` canonicalises distances to
`['5K','10K','15K','Half Marathon','Marathon']` and `canonicalDistance()` (103-115) returns null for
anything else; `app/race-event.tsx:28-38` (`distanceLabelToKm`) cannot express a Hyrox event. So the
app's flagship race flow — search → "Train for This Event →" (`race-event.tsx:302-311`) and the
freshly-shipped REC-001 handoff — is structurally unreachable for the sport this benchmark is about.
The only path is manually typing a race into the hub (`app/races.tsx` add form). Benchmark:
hyroxlab.com's Calendar is a 47-event worldwide HYROX directory (checklist row 3,
`sources/hyroxlab-calendar.md`); trainrox ships event detail pages with heat schedules (row 5).

**Target:** A Hyrox event source (hyrox.com season list — even a curated static seed to start) surfaced
in `race-search.tsx` behind a sport filter, with the race → plan handoff carrying `division` into
`hyroxParams` instead of a distance label.

**Effort:** M–L (new data source; UI is mostly reuse).

## 3. CRITICAL — No pacing tool exists anywhere in the app (the benchmark's flagship tool class)

**Now:** Every competitor's front door is a pacing calculator (hyroxlab ÷16 calculator + 8 pacing pages;
trainrox empirical per-station calculator from 1.2M results — checklist rows 1/1b). OSPREY's superior
math exists (`src/services/calculators/hyrox.ts:24` `predictCompromisedRunSplit`) but **no screen ever
computes or renders a pacing target**:
- `predictCompromisedRunSplit`'s only consumer is `src/services/coaching/hyrox.ts:31` → the LLM prompt
  (`guidance.ts:95`). Grep confirms zero UI consumers.
- The live race runner shows `1km` / `50m · 152kg` as the entire target (`app/workout/hyrox.tsx:302,376`)
  — no time target on any of the 16 segments.
- The race hub collects a goal time (`app/races.tsx:570,604`) and uses it **only after the race** for the
  retro delta label (`races.tsx:261` `pacingDeltaLabel`).
There is no per-station time model at all (row 1b: "OSPREY models only a uniform run-pace offset and has
no per-station time model"). Even hyroxlab's naive ÷16 board doesn't exist as a screen.

**Target:** A "Race pacing" surface reachable from the race hub card and the race-runner overview: goal
time (entered or predicted from threshold) → 16-segment target board — phased run splits (finding 7) +
station time budgets + roxzone budget. Anchor to the athlete's threshold (OSPREY's stated counter-moat,
structural-gaps G4) so it beats both competitor models.

**Effort:** M–L (station-time model is the new math; screen itself is a list).

## 4. IMPORTANT — Zero station technique content at the point of need

**Now:** `types/hyrox.ts:21-30` — `HyroxStationDef` is `{id, label, icon, target}`; there is no
cue/mistake/break-strategy field anywhere in the app. During a live wall-balls segment the athlete sees
`🏐 Wall Balls · 100 reps · 6kg` (`app/workout/hyrox.tsx:369-386`) and nothing else. The benchmark's
three exemplars all ship 8-station technique libraries (hyroxlab 8 pacing pages + 8 guides —
`sources/hyroxlab-pacing-and-guides.md`; hyroxfitness 8 articles whose cues/mistakes/drills/break
strategies are captured **verbatim** in `sources/hyroxfitness-doubles-divisions-stations.md` §"The 8
stations"; trainrox ~80 training-hub articles). OSPREY's own blueprint covers all 8 stations in 63 words
(`docs/coaching/hyrox.md` §4, per that source file). The content to ship is already sitting in the skill
sources (e.g. wall balls: "break into sets of 10 from rep 1"; sled push: "45° lean, hips low...
overcooking costs 3-4 min").

**Target:** Extend `HyroxStationDef` with `cues[]`, `commonMistakes[]`, `breakStrategy` (blueprint voice,
sourced from the skill's captured content); render 2-3 cues on the active segment card and a tappable
station-detail sheet from the overview rows. Same data can back a station-reference library later.

**Effort:** M (content adaptation + one sheet component).

## 5. IMPORTANT — `targetTimeMinutes` is plumbed end-to-end but no screen ever collects it

**Now:** `src/services/coaching/hyrox-params.ts:8` declares it; both goal-setup screens hardcode it to
empty — `app/preferences.tsx:232` and `app/(onboarding)/baseline.tsx:133` both call
`parseHyroxParams({ division, targetTimeMinutes: '' })`. The webapp defensively parses it
(`webapp/src/lib/goal-params.ts:51-63`) but nothing writes it. Worse: even if collected, it would
influence nothing — `HyroxPrescription` (`src/services/coaching/hyrox.ts:11-17`) and `HyroxInfo`
(`guidance.ts:81-87`) both omit it. Competitors' entire experience starts from this one input
(checklist rows 1/1b/15).

**Target:** Ask for target finish time on the two division-picker screens (they were just refactored to
share `HYROX_DIVISIONS`, so both are warm); thread it into `buildHyroxPrescription` → guidance and the
pacing surface (finding 3), with the sanity check from finding 6.

**Effort:** S–M.

## 6. IMPORTANT — No published finish-time bands; nothing sanity-checks a first-timer's elite goal

**Now:** Grep across `app/` + `src/` finds zero Hyrox finish-time reference data (only CrossFit has
normative tiers — `src/services/calculators/crossfit.ts:32-43`). `app/races.tsx:570-617` accepts any
goal time with only a format check; checklist row 17 (Missing) + the six-tier per-division/gender table
captured in `sources/hyroxfitness-doubles-divisions-stations.md` §"Benchmark finish times" (Open M:
<55 world-class … 90-105 average first-timer … 105-130 completion). A first-timer entering 55:00 today
gets a plan built around it with no feedback.

**Target:** `hyroxFinishTimeBands(division)` in `calculators/hyrox.ts` + a tier label at goal-time entry
("That's world-class pace — typical first-timers finish 90-105") and on the race hub card. Pure static
data + one label.

**Effort:** S.

## 7. IMPORTANT — Pacing model is uniform; benchmark's most race-realistic model is phased

**Now:** `src/services/calculators/hyrox.ts:24-26` — one flat `{threshold+15, threshold+30}` for the whole
race. hyroxfitness.com's model (checklist row 15, "Behind — cheap to fix"): runs 1-3 deliberately
15-20 s/km *slower*, 4-6 at target, 7-8 negative split, plus an HR ladder 75-82% → 82-88% → 85-92%
(`sources/hyroxfitness-doubles-divisions-stations.md` §"Their pacing method"). Combining phasing with
OSPREY's threshold anchor would beat all three competitor models — none is both individual and phased.

**Target:** `predictCompromisedRunSplit(threshold, runIndex)` returning phase-adjusted ranges; feed the
per-run numbers to guidance and the pacing board.

**Effort:** S (function) — display rides on finding 3.

## 8. IMPORTANT — Hyrox-specific zones/targets never render; athlete sees generic run zones

**Now:** `hyroxRunZones()` (`calculators/hyrox.ts:12-21`) has **zero consumers** — not even
`coaching/hyrox.ts` imports it. `src/services/coaching/zones.ts:23` maps `hyrox` → the plain `run` zone
set, so the Settings ZonesCard shows a Hyrox athlete ordinary run zones with no compromised-split row and
no station-weight reference. Station weights render on webapp Settings (`webapp/src/features/settings/
StrengthZones.tsx`) but on mobile they appear **only** inside the live race runner
(`app/workout/hyrox.tsx:81`) — there is no reference view ("what do I push/pull/carry in my division?")
outside an active workout. (This is also the known "useDisplayZones swallows read errors" neighborhood
from the coaching-engine memory.)

**Target:** For `primary_goal === 'hyrox'`: ZonesCard gains a "Race pace under fatigue" row
(compromised split) and a station-loads block from `hyroxStationWeights(division)` — mirroring what the
webapp already does.

**Effort:** S.

## 9. IMPORTANT — Splits (incl. roxzone) are captured but get no targets before and no trends after

**Now:** OSPREY's genuinely distinctive capability — deriving roxzone from real timestamps
(`types/hyrox.ts:83-107`, checklist row 9 "trainrox predicts roxzone; OSPREY records it") — surfaces as
exactly one number, once: total roxzone on the recap (`app/workout/recap.tsx:165-167`). No roxzone
budget pre-race, no per-transition breakdown, and the Stats tab has no Hyrox splits view at all
(`app/(tabs)/stats.tsx` — hyrox exists only as an icon/color/label in the sport-volume rollup, lines
36/50/60). Repeated race sims produce station-by-station history the app never compares ("your sled push
across 6 sims"), while trainrox's whole product is station-level comparison (row 10).

**Target:** Roxzone budget line on the pacing board; per-transition list + per-station vs-last-time
deltas on recap; a simple station-trend view (existing saved `hyroxSplits` data, no new capture needed).

**Effort:** M.

## 10. MINOR — Race-day fueling numbers computed but never shown deterministically

**Now:** `hyroxDailyNutrition` / `hyroxInRaceCarbGPerHour` / `hyroxSodiumMgPerHour` / `hyroxCaffeineMg`
(`calculators/hyrox.ts:84-101`) flow only into plan generation (`coaching/fuel.ts:38-45`,
`coaching/hyrox.ts:33-34` → LLM prompt `guidance.ts:102`). No screen renders them; the race hub's
morning checklist (`app/races.tsx:77`) has gels/hydration checkboxes but no athlete-specific numbers.
Checklist row 7 rated this "Exceeds" on math while flagging "presentation/UX … wasn't checked" — now
checked: there is no presentation. The only chance a user sees these numbers is if the paywalled
AI briefing happens to include them (`races.tsx:200-213`, OSPREY+ gated).

**Target:** A small deterministic "Race fueling" block on the upcoming-race card (carb g/hr, sodium
mg/hr, caffeine range at the athlete's bodyweight) — $0, no LLM, data already computed.

**Effort:** S.

## 11. MINOR — The Hyrox quiz shipped into the least-Hyrox corner of the app

**Now:** The REC-003 quiz's sole entry point is Settings → About & Support, one row above the privacy
policy link (`app/(tabs)/settings.tsx:575-587`). A Hyrox-goal athlete living in Home/Workout/Races never
encounters it. The benchmark motivation was first-timer education alongside beginner content
(`product-recommendations.md` REC-003).

**Target:** Contextual second entry point for hyrox-goal users — e.g. a one-time Home card or a link from
the race runner's division/overview screen — keeping the Settings row as the permanent home.

**Effort:** S.

## 12. IDEA — Doubles split planner (the format knowledge is already captured)

**Now:** Doubles divisions work end-to-end (picker `app/workout/hyrox.tsx:29-37`, loads
`calculators/hyrox.ts:70-72`, note at line 244-251) but the app offers nothing for the *strategy* that
defines Doubles: how partners split station reps. The swap playbook is fully specified in
`sources/hyroxfitness-doubles-divisions-stations.md` §Doubles (15-20-rep swaps, sleds by full lengths,
split by strength not equally, pace to the slower runner) — checklist row 16 calls it "now fully
specified."

**Target:** Optional per-station split plan on the Doubles overview (e.g. wall balls 50/50 in 10s;
sled full lengths), persisted with the workout so recap shows "your share."

**Effort:** M.

## 13. IDEA — Head-to-head result comparison (planned pillar a competitor already ships)

**Now:** trainrox ships athlete search + head-to-head station-level comparison + rankings (checklist
row 10); OSPREY's equivalent is MASTER-PLAN Pillar 6 sitting on unmerged branches. In-app today:
nothing. With finding 9's station history, a "compare two of my own races" view is a
no-backend first step toward it.

**Target:** Phase 1: self-vs-self race comparison from saved `hyroxSplits`. Phase 2 (post-launch,
needs users): social head-to-head.

**Effort:** L (phase 1 alone: M).

---

## Cross-cutting observations

- **The pattern behind the user's complaint, in one line:** every "Exceeds" row in the checklist lives in
  `src/services/**` or an undeployed edge function; every competitor "win" lives on a screen. The three
  shipped items (REC-001 button, REC-003 quiz, webapp chart) were the smallest screen-facing slices; the
  experience-level material (pacing tools, station content, targets-on-screens) is exactly what's still
  in services-land. Structural-gaps.md's standing rule ("state which side of the deploy line a capability
  lives on") applies to nearly every row.
- **Ink/amber status of the Hyrox surfaces:** `workout/hyrox.tsx`, `race-event.tsx`, `races.tsx`,
  `hyrox-quiz.tsx` are already on Theme/ink-amber (functional reds kept deliberately, per in-file
  comments) — the Hyrox gap is content/tooling, not palette. No design-system finding here.
- **Sequencing note:** findings 5 → 6 → 7 → 3 form one natural build (collect target time → sanity-band
  it → phase the model → render the pacing board), and finding 1 (deploy) gates plan-quality wins but
  none of the on-screen tools.
