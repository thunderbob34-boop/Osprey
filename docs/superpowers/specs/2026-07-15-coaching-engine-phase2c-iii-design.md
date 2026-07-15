# Coaching-Engine Phase 2c-iii — Fuel Per Day-Type — Design Spec

> Created 2026-07-15. The final coaching-engine slice. Replaces the one-weekly-carb-target model with **per-session
> carbs matched to each workout's intensity** — hard days more, easy days fewer — across every sport. Folds in the
> Phase 1.1 fuel deferral (Phase 2 spec §9). App fuel + edge fn only; no new sport, no migration, no webapp/mobile.

## 1. Why this exists / what it delivers

Today `computeRunningFuel({ bodyWeightKg, hardWeek })` returns **one** `dailyCarbG` range (based on a *weekly*
`hardWeek` flag), and `validate.ts` stamps that same value on every session. So an easy recovery run and a hard
interval day in the same week carry identical carb targets. 2c-iii matches carbs to **each session's intensity**:
easy/rest → 3-5 g/kg, moderate → 5-7, threshold/interval → 8-10, race → 10-12 (the shared `dailyCarbGrams` ladder).
A hard session demoted to easy by polarization correctly gets easy-day carbs (the attach runs *after* polarization).

**Decisions locked in brainstorming:**
- **Per-session by (final) intensity**, replacing the weekly `hardWeek → carbs` link.
- **The stored per-session `fuel` shape is unchanged** (`{ dailyCarbG, proteinG, longSessionCarbGPerHour }`) — only
  `dailyCarbG` now varies by the day's intensity, so nothing that renders it breaks.
- **Reuse the generic `dailyCarbGrams`** (`shared.ts`, identical to running's table for the easy/moderate/high tiers
  used in training) + a per-sport in-session carb rate.

## 2. `computeFuel` — the carb ladder by day-type

`fuel.ts`'s `computeRunningFuel` generalizes to:

```ts
import { EnduranceDayType } from '@/services/calculators/shared';

export interface FuelPlan {
  dailyCarbGByDayType: Record<EnduranceDayType, Range>; // easy / moderate / high / peak
  proteinG: Range;
  longSessionCarbGPerHour: number;                       // per-sport in-session rate (name kept for session-fuel compat)
}

export function computeFuel(sport: string, bodyWeightKg: number): FuelPlan {
  return {
    dailyCarbGByDayType: {
      easy: dailyCarbGrams('easy', bodyWeightKg),
      moderate: dailyCarbGrams('moderate', bodyWeightKg),
      high: dailyCarbGrams('high', bodyWeightKg),
      peak: dailyCarbGrams('peak', bodyWeightKg),
    },
    proteinG: { min: Math.round(bodyWeightKg * 1.6), max: Math.round(bodyWeightKg * 2.2) },
    longSessionCarbGPerHour: inSessionCarbGPerHour(sport),
  };
}
```

`inSessionCarbGPerHour(sport)` dispatches to the per-sport function's midpoint (`cyclingInRideCarbGPerHour` for
cycling, `swimMeetDayCarbGPerHour` for swim, `runningRaceFuelGPerHour('marathon')` for run/hyrox/hybrid,
`triathlonRaceCarbGPerHour` for triathlon), defaulting to ~60 g/hr. (`computeRunningFuel` is removed; its only caller
is `computeEnvelope`.)

## 3. Envelope wiring
- `CoachingEnvelope.fuel` becomes `FuelPlan` (was `FuelTargets`).
- `computeEnvelope`: `fuel: computeFuel(input.sport, input.bodyWeightKg)`. The `hardWeek` local (its only use was
  `computeRunningFuel`) is removed — fueling is now per-session, not per-week.
- Regression: `zones`/`hrZones`/everything else unchanged; only `fuel`'s shape (and that it's now a ladder) changes.

## 4. `validate.ts` — attach per-session by intensity

Step (c) (fuel-attach) changes from stamping `envelope.fuel` on every session to resolving each session's carb range
from its **post-polarization** intensity:

```ts
// EnduranceDayType for a session's intensity (edge-local; mirrors the app ladder).
function carbDayType(intensity: string): 'easy' | 'moderate' | 'high' | 'peak' {
  if (intensity === 'moderate') return 'moderate';
  if (intensity === 'threshold' || intensity === 'interval') return 'high';
  if (intensity === 'race') return 'peak';
  return 'easy'; // easy / rest / anything else
}

out = out.map((d) =>
  d.session_type === 'rest'
    ? d
    : { ...d, fuel: {
        dailyCarbG: envelope.fuel.dailyCarbGByDayType[carbDayType(d.intensity)],
        proteinG: envelope.fuel.proteinG,
        longSessionCarbGPerHour: envelope.fuel.longSessionCarbGPerHour,
      } });
```

The attached `fuel` keeps the **exact FuelTargets shape** (`{ dailyCarbG, proteinG, longSessionCarbGPerHour }`) — the
app renders it unchanged. This runs after polarization (step a) so a demoted session's `intensity` (now `easy`) yields
easy-day carbs. `EnvelopeLike.fuel` is retyped from `unknown` to the `FuelPlan` mirror (edge hand-copy).

## 5. Edge prompt (`index.ts`)
- The `Envelope.fuel` mirror becomes the `FuelPlan` shape (`dailyCarbGByDayType` + `proteinG` + `longSessionCarbGPerHour`).
- The fuel line in `envelopeGuidance` (currently `Daily carbs {min}-{max} g; long-session fuel ~{n} g/hr`) becomes:
  `Daily carbs by day: easy {easy.min}-{easy.max} g, hard {high.min}-{high.max} g, race {peak.min}-{peak.max} g;
  in-session ~{longSessionCarbGPerHour} g/hr.` So the LLM's notes can reference the right day's target.

## 6. Compatibility
- **Stored `training_sessions.fuel`** (what the app + webapp render): unchanged shape, per-session value. No consumer
  change, no migration.
- **`envelope.fuel`** (app → edge over the wire): new `FuelPlan` shape. **App + edge deploy together** (an old edge
  fn reading a `FuelPlan` for `.dailyCarbG` would get `undefined` → a broken fuel string; a new edge fn reading an old
  `FuelTargets` would find no `dailyCarbGByDayType`). Same atomic coupling as the rest of the 2c arc. No migration.

## 7. Testing (TDD)
- App (Jest): `computeFuel` returns the four day-type ranges (`easy`/`moderate`/`high`/`peak` = `dailyCarbGrams(dt)`)
  + protein + a per-sport in-session rate; `computeEnvelope`'s `fuel` is the `FuelPlan` and `zones`/`hrZones` are
  byte-identical (only fuel changed).
- Edge (Deno): `carbDayType` maps intensities correctly; `validateAndClamp` attaches easy-day carbs to an easy
  session and high-day carbs to a threshold session in the SAME plan (the core behavior), the shape stays
  `{ dailyCarbG, proteinG, longSessionCarbGPerHour }`, rest days get no fuel, and a polarization-demoted session gets
  easy-day carbs. The existing pace-clamp/polarization tests stay green; the fuel-attach test updates to per-session.
- Existing 155 Jest + 23 Deno stay green (except the intentionally-updated fuel-attach expectation); lint clean.

## 8. Deploy
App (`fuel.ts`, `envelope.ts`) + edge fn (`validate.ts`, `index.ts`) deploy together — joins the go-live redeploy
coupling. No migration; no webapp/mobile change. Add a 2c-iii line to `DEPLOY-CHECKLIST.md`.

## 9. Risks & open questions
- **Envelope wire-shape change** (`FuelTargets` → `FuelPlan`) is the coupling to watch — mitigated by the standing
  app+edge atomic-deploy rule (pre-launch, no live clients).
- **`moderate` intensity is rare in generated plans** (most sessions are easy/threshold/interval) — the `moderate`
  tier will seldom fire, but including it keeps the ladder complete and correct if the LLM emits a moderate day.
- **Running's race-week top tier** (`raceWeek` 8-12) is replaced by the generic `peak` (10-12) for the `race`
  intensity — a 2 g/kg bump on race day only; acceptable and arguably more correct (full carb-load). Training tiers
  (easy/moderate/high) are identical between the tables, so no training-day change.
- **Open:** should `moderate`-intensity sessions map to the `moderate` tier (as specced) or fold into `easy`? Lean:
  keep `moderate` explicit (cheap, correct).

## 10. Out of scope
Per-session hydration/sodium targets; carb-periodization across a race build (train-low days); a fuel display/settings
UI; the triathlon `disciplineHourSplit` day-count alignment (noted in 2c-ii §10); changing the LLM. **This is the last
planned coaching-engine slice — after it, Phase 1→2c is complete.**
