# Coaching-Engine Phase 3 — Hyrox — Design

**Date:** 2026-07-15
**Status:** Approved (design) — ready for implementation plan
**Origin:** Phase 3 remaining sports (roadmap `docs/superpowers/specs/2026-07-14-coaching-engine-fidelity-design.md` §11). Domain SoT `docs/coaching/hyrox.md`.

Make `hyrox` a real hybrid engine. Hyrox is a compromised-running race — 8 × 1 km runs alternating with 8 fixed functional stations (SkiErg, Sled Push, Sled Pull, Burpee Broad Jump, Rowing, Farmers Carry, Sandbag Lunges, Wall Balls) — where run splits are decided by how much the stations cost you.

**This slice is mostly *wiring*.** Every hyrox calculator already exists in `OSPREY-app/src/services/calculators/hyrox.ts` and matches the domain doc — they are just orphaned (only `hyroxStationWeights` is consumed, and only by workout logging). We wire them into the coaching engine via a new envelope field + prompt block, reusing the machinery already on `main`.

---

## Global Constraints

- **Non-hyrox plans MUST stay byte-identical.** All hyrox logic is gated on `sport === 'hyrox'`. Every existing envelope / fuel / validate / zone test stays green, unchanged.
- **NO database migration.** `hyrox` already exists in `primary_goal_enum` (pending migration `20260714000003_sport_primary_goals.sql`) and `goal_params` already exists. Both are in the coaching engine's already-pending atomic redeploy bundle (`docs/DEPLOY-CHECKLIST.md` §2).
- **App + edge deploy atomically** — the new `envelope.hyrox` contract and the edge prompt block must agree. Rides the pending redeploy; no *new* deploy step.
- **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test` (Jest, `TZ` mandatory). **Edge tests:** `deno test supabase/functions/ozzie-generate-plan/` (Deno).
- **Mirror, don't share.** The edge fn (Deno) mirrors the app's `HyroxPrescription` shape as a hand-narrowed interface, pinned per side — matching the `strength`/`hrZones` precedent.
- **TDD.** Failing test → minimal wiring → green.
- **Scope = Lean (approved):** wire the calculators; a **division picker** is the only new onboarding input. No `%1RM` machinery, no barbell 1RM collection.

---

## Architecture decision — reuse run zones (approved)

Hyrox running sessions **reuse the existing run pace zones**. `blueprintSport('hyrox')` already returns `'run'` (zones.ts:23), so hyrox runs already get a `RunZone` (`thresholdSecPerMile` + `runningPaceZones`) and the existing `validate.ts` run pace-clamp. **We add no `hyrox` ZoneSet variant and make no `validate.ts` change** → the pace-clamp stays byte-identical.

The hyrox-specific running value — the **compromised race-pace split** (threshold + 15–30 s/km, because the stations pre-fatigue you) — is carried on the new `hyrox` envelope field and rendered in the prompt, not as a clampable zone band.

*Consequence:* `hyroxRunZones` / `HyroxRunZones` (calculators/hyrox.ts) stay orphaned — the run zones cover training intensities, and the distinctive compromised split is wired via `predictCompromisedRunSplit`. Documented in Non-goals.

---

## Components

### 1. `goal_params` → `HyroxGoalParams`

New module `OSPREY-app/src/services/coaching/hyrox-params.ts`, mirroring `ultra-params.ts` / `strength-params.ts`:

```ts
export type HyroxDivision = 'open_men' | 'open_women' | 'pro_men' | 'pro_women'; // re-exported from calculators/hyrox
export interface HyroxGoalParams {
  division: HyroxDivision;          // required — drives station weights
  targetTimeMinutes: number | null; // optional — prompt specificity
}
export function toHyroxParams(raw: unknown): HyroxGoalParams | null;   // stored JSONB → safe params (null if no valid division)
export function parseHyroxParams(input: {...}): { ok: true; value } | { ok: false; error }; // UI input → validated
```

`GoalParams` union (in `strength-params.ts`) gains `| HyroxGoalParams` (types-only import; no runtime cycle).

### 2. Envelope field `hyrox: HyroxPrescription | null`

New module `OSPREY-app/src/services/coaching/hyrox.ts` (mirrors `strength.ts`):

```ts
export interface HyroxPrescription {
  division: HyroxDivision;
  compromisedRunSplitSecPerKm: Range;   // predictCompromisedRunSplit(thresholdSecPerKm)
  stationWeights: HyroxStationWeights;  // hyroxStationWeights(division)
  sodiumMgPerHour: Range;               // hyroxSodiumMgPerHour()
  caffeineMg: Range;                    // hyroxCaffeineMg(bodyWeightKg)
}
export function buildHyroxPrescription(input: EnvelopeInput): HyroxPrescription | null; // null unless sport === 'hyrox'
```

- Threshold source: the run anchor is `thresholdSecPerMile`; convert to sec/km (`/ 1.609344`) before `predictCompromisedRunSplit`.
- `EnvelopeInput` gains `hyroxParams?: HyroxGoalParams | null` (parallel to `ultraParams?`/`strengthParams?`).
- `computeEnvelope` adds `const hyrox = buildHyroxPrescription(input);` and `hyrox,` to the returned envelope (null for non-hyrox → byte-identical).
- A paramless hyrox athlete (no `goal_params`) → `division` absent → `buildHyroxPrescription` returns `null` (falls back to a generic run+strength plan — the same graceful-degradation lesson as the paramless-lift follow-up).

### 3. Fuel — `computeFuel` hyrox branch

`fuel.ts` gains a `sport === 'hyrox'` branch at the top (like the `lift` branch):

```ts
if (sport === 'hyrox') {
  const n = hyroxDailyNutrition(bodyWeightKg);   // carbG 5-8 g/kg, proteinG 1.6-2.2
  // dailyCarbGByDayType from n.carbG (low/high bands like lift), proteinG rounded,
  // longSessionCarbGPerHour = midpoint(hyroxInRaceCarbGPerHour(90)) = ~45 (hyrox races run >75 min)
}
```

Reuses the `FuelPlan` shape (no widening). Race-day electrolytes (sodium, caffeine) ride on `HyroxPrescription`, not `FuelPlan` — matching how powerlifting kept `fatG` on `StrengthPrescription`.

### 4. Routing — unchanged

Hyrox stays run-primary: `routeDisciplineDays` already maps `hyrox → 'run'` (`ENDURANCE_PRIMARY`), giving `weeklyRunDays` (primary) + `weeklyLiftDays` (strength/station days). No routing change — the strength days now run the hyrox station block (§5) instead of the generic lift prompt.

### 5. Prompt — edge hyrox block (`index.ts`)

- Mirror `Envelope.hyrox` as a hand-narrowed interface (like `Envelope.strength`).
- A hyrox guidance block (present only when `envelope.hyrox`): **compromised-running intervals** (signature session — race-pace run → station → race-pace run) at the compromised split; **station strength-endurance** at the division weights (sled repeats, wall balls in sets, ski/row 1000 m at target split); **roxzone/pacing** (race as one effort; controlled opening SkiErg→Sled block); race-day electrolytes.
- **Station work is conveyed in session descriptions / `ozzie_notes`, NOT via the `lift_prescription` exercise whitelist.** Hyrox stations (SkiErg, Sled, Wall Ball, …) are not in the exercise library, and `lift.tsx` silently drops off-library exercise names (the trap we hit + fixed in powerlifting T5). Barbell strength on lift days still uses the existing general lift prompt (whitelist-valid names).
- The shared fuel prompt line already renders `envelope.fuel` (carbs + protein), so hyrox daily nutrition flows automatically.

### 6. `validate.ts` — byte-identical

No change. Hyrox runs use the existing run pace-clamp; there is **no station-load guardrail** — division station weights are *training references* (you train heavier/lighter around race weight), not clamp targets like powerlifting's %1RM band. `validate.ts` steps (a)–(d) are untouched.

### 7. Collection UI

A **division picker** (Open/Pro × M/W) on onboarding baseline + plan-builder, gated on the hyrox goal; the run threshold comes from the existing run anchor (no new anchor). Optional target-time field. `goal_params` **persist-before-generate** (the ultra/powerlifting lesson). Onboarding writes `primary_goal` before `generateInitialPlan`.

### 8. Goal-resolution integration

Extend `resolveGoalInputs` (build-envelope.ts, added in the Phase 3 follow-ups) to also gate `hyroxParams` on `effectiveGoal === 'hyrox'` (via `toHyroxParams`). Because that helper now centralizes goal resolution, a plan-builder **goal switch to hyrox builds the correct envelope on the first generation for free**. `invokeGeneratePlan`'s DB read gates `hyroxParams` the same way (`g?.primary_goal === 'hyrox' ? toHyroxParams(...) : null`).

---

## Non-goals (out of scope)

- **A `hyrox` ZoneSet variant / wiring `hyroxRunZones`** — superseded by reusing run zones (see the architecture decision). Left orphaned intentionally.
- **`%1RM` barbell strength / 1RM collection** for hyrox (the "Rich hybrid" option) — general strength uses the existing lift prompt.
- **A station-load guardrail** in `validate.ts` — station weights are training references.
- **CrossFit** and the remaining polish items — separate slices.

---

## File-by-file change map

**App (`OSPREY-app/`):**
- `src/services/coaching/hyrox-params.ts` — **new.** `HyroxGoalParams`, `toHyroxParams`, `parseHyroxParams`, re-export `HyroxDivision`.
- `src/services/coaching/strength-params.ts` — extend `GoalParams` union with `| HyroxGoalParams`.
- `src/services/coaching/hyrox.ts` — **new.** `HyroxPrescription`, `buildHyroxPrescription`.
- `src/services/coaching/envelope.ts` — `EnvelopeInput.hyroxParams?`; `CoachingEnvelope.hyrox`; wire `buildHyroxPrescription` into `computeEnvelope`.
- `src/services/coaching/fuel.ts` — `hyrox` branch.
- `src/services/coaching/build-envelope.ts` — read `hyroxParams` from `goal_params` (gated on `hyrox`); extend `resolveGoalInputs`.
- `app/(onboarding)/baseline.tsx` + `app/preferences.tsx` — division picker + persist-before-generate.
- `src/services/coaching/__tests__/…` — hyrox-params parse/flatten; buildHyroxPrescription (incl. null when paramless / non-hyrox); fuel hyrox branch; envelope non-hyrox byte-identical.

**Edge (`supabase/functions/ozzie-generate-plan/`):**
- `index.ts` — `Envelope.hyrox` mirror + hyrox guidance block.
- `*_test.ts` — hyrox guidance present/absent; non-hyrox byte-identical.

---

## Testing & acceptance criteria

1. A hyrox athlete's envelope carries `hyrox` (compromised split from their threshold; station weights for their division); non-hyrox carries `hyrox: null`.
2. Hyrox fuel = 5–8 g/kg carbs + 1.6–2.2 protein; endurance/lift fuel unchanged.
3. Hyrox running reuses run zones; `validate.ts` byte-identical.
4. The edge prompt gains the hyrox block only when `envelope.hyrox` is present; station work is in descriptions/notes, not whitelist exercises.
5. A goal switch to hyrox builds the hyrox envelope on the first generation (via `resolveGoalInputs`).
6. A paramless hyrox athlete degrades gracefully (`hyrox: null` → generic run+strength plan).
7. **Non-hyrox plans byte-identical** — full Jest + Deno suites green. **No migration.**
