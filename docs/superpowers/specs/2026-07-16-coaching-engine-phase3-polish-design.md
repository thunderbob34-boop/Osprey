# Coaching-Engine Phase 3 — Polish (zone display + low-confidence UX) — Design

**Date:** 2026-07-16
**Status:** Approved (design) — ready for implementation plan
**Origin:** Phase 3 polish items (roadmap `docs/superpowers/specs/2026-07-14-coaching-engine-fidelity-design.md` §11). The last Phase 3 slice before CrossFit.

Two related UX items, delivered as one surface:

1. **Zone display on the plan-preview** — the generated-plan preview shows the schedule but never the athlete's training zones. Add a compact "Your zones" card **under the weekly summary** showing the key pace/power/HR bands for their sport.
2. **Low-confidence-anchor UX** — a brand-new athlete (no self-report, no logged data) gets *tier-estimated* zones. Flag that case on the card as `Estimated`, with a subtle nudge: their zones sharpen automatically once they log efforts.

Approved before/after mockup: three plan-preview frames (Before → After measured → After estimated), zones card placed directly under the summary card.

---

## Global Constraints

- **App-only.** No edge-function change, no LLM-prompt change, **no migration**.
- **The `CoachingEnvelope` stays byte-identical.** No new field on the envelope; the confidence signal is derived and consumed client-side only. Every existing envelope test stays green.
- **Zone output is byte-identical.** Extracting `resolveZones` from `computeEnvelope` must not change the zones any sport produces — the existing `envelope.test.ts` zone assertions are the regression gate.
- **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test` (Jest, `TZ` mandatory).
- **TDD** for the pure logic (`resolveZones` + confidence). The hook + card are typecheck + preview (device smoke test, same headless-Expo caveat as the collection screens).

---

## Components

### 1. Extract `resolveZones` from `computeEnvelope`

The inline zone-dispatch block in `computeEnvelope` (`OSPREY-app/src/services/coaching/envelope.ts`, the `let zones … if (sport === 'triathlon') … else { blueprintSport … }` region) moves into a pure exported function:

```ts
export type ZonesConfidence = 'measured' | 'estimated';
export function resolveZones(input: EnvelopeInput): { zones: ZoneSet | null; zonesConfidence: ZonesConfidence };
```

`computeEnvelope` calls it and destructures **only** `zones` (`const { zones } = resolveZones(input);`) — so the envelope it returns is unchanged (byte-identical). The display path (below) uses both fields. This keeps the card and the engine on one code path — they can never show different bands.

### 2. Confidence rules (`zonesConfidence`)

`estimated` = the sport's pace/power anchor is a **pure tier fallback** (no self-report *and* no logged data). `measured` = self-reported or data-derived. Computed inside `resolveZones` per sport, from the same anchor resolution it already does:

- **run / ultra / hyrox:** self-reported `thresholdSecPerMile` → `measured`; else `resolveRunningAnchor(...).source` (`'derived'` → `measured`, `'estimate'` → `estimated`).
- **swim:** self-reported `cssSecPer100` → `measured`; else tier estimate → `estimated`.
- **rowing:** self-reported `splitSecPer500` OR logged `rowingSplitSecPer500` → `measured`; else tier → `estimated`.
- **cycling:** self-reported `ftpWatts` → `measured` (power zones). No FTP → `zones` is `null`; the card falls back to HR zones, whose confidence is `hrZones.source` (`'observed'` → measured, `'estimated'` → estimated).
- **triathlon:** each discipline resolves its own; the card's single flag reads `estimated` if **any** displayed discipline is estimated.
- **no-pace goals (weight_loss / general):** `zones` is `null` → HR zones shown → confidence from `hrZones.source`.
- **lift:** no zones → the card is skipped entirely (see §4).

`hrZones.source` already exists on the envelope (`'observed' | 'estimated'`) — the HR-fallback confidence reuses it; no new HR logic.

### 3. `useDisplayZones()` hook

New hook (`OSPREY-app/src/hooks/useDisplayZones.ts`). Given the signed-in user, it does a **focused, read-only** query of the athlete's anchor inputs — `user_goals.primary_goal` + `threshold_anchor` + `fitness_level`, the best recent run effort / rowing split (`workout_logs`), body weight, and observed maxHR — mirroring the gather in `build-envelope.ts` (minus the plan-generation machinery). It then calls `resolveZones(...)` and computes `hrZones` (via the existing `resolveMaxHR` + `ultraHRZones`), returning:

```ts
{ zones: ZoneSet | null; hrZones: HrZoneInfo; confidence: ZonesConfidence } | null
```

Read-only, client-only, no writes. Works in **both** plan-preview modes (post-generation and view-only), since it reads the stored anchor rather than depending on the just-generated envelope.

### 4. `ZonesCard` component

New component rendering the compact card, placed in `plan-preview.tsx` **directly under the summary card** (before the `SCHEDULE` label), in both modes. It shows the **two key bands** for the athlete's sport, read from the resolved `ZoneSet` (or `hrZones`):

| Sport | Band 1 (aerobic/easy) | Band 2 (threshold) |
|---|---|---|
| run / ultra / hyrox | `zones.bands.easy` | `zones.thresholdSecPerMile` |
| swim | `bands.z2Aerobic` | `bands.z3Threshold` |
| rowing | easy split band | threshold (AT) split band |
| cycling (FTP) | `bands.z2Endurance` (w) | `bands.z4Threshold` (w) |
| triathlon | each discipline's easy | each discipline's threshold (compact) |
| no-pace / cycling-no-FTP | `hrZones` Z2 (bpm) | `hrZones` Z4 (bpm) |
| **lift** | — card not rendered — | — |

Values respect the global unit preference (`useUnitPreference`, as the rest of the screen does). When `confidence === 'estimated'`, the card shows an `Estimated` tag and one subtle line: *"Estimated from your experience level — log a few efforts and these sharpen automatically."* No banner, no CTA button (informational — see Non-goals).

### 5. Wiring into `plan-preview.tsx`

- Call `useDisplayZones()` and render `<ZonesCard … />` between the summary card and the `SCHEDULE` label.
- Both modes render it. If the hook returns `null` (no signed-in user, or a `lift` goal), render nothing — the rest of the screen is unchanged.

---

## Non-goals (out of scope)

- **A mobile anchor-editor screen** (the *actionable* refine destination). The mobile app has no post-onboarding way to edit `threshold_anchor` (only the webapp does); building one is a genuinely useful but separate feature. Here the nudge is informational — the anchor already auto-derives from logged efforts, so "log a few and these sharpen" is both true and lean.
- **Feeding confidence to the LLM prompt.** The zone *numbers* are identical whether measured or estimated; the prompt is unchanged. Confidence is a UI concern only → app-only.
- **CrossFit** — the final Phase 3 slice.

---

## File-by-file change map

**App (`OSPREY-app/`):**
- `src/services/coaching/envelope.ts` — extract `resolveZones` (+ `ZonesConfidence` type); `computeEnvelope` calls it and uses only `.zones`.
- `src/hooks/useDisplayZones.ts` — **new.** Focused anchor read → `resolveZones` + `hrZones` → `{ zones, hrZones, confidence }`.
- `src/components/ZonesCard.tsx` (or colocated in the preview) — **new.** The compact per-sport card + estimated variant.
- `app/plan-preview.tsx` — render `ZonesCard` under the summary card in both modes.
- `src/services/coaching/__tests__/…` — `resolveZones` unit tests (zones byte-identical vs `computeEnvelope`; `zonesConfidence` per source, per sport).

---

## Testing & acceptance criteria

1. `resolveZones(input).zones` is **byte-identical** to the zones `computeEnvelope(input)` produced before the extraction, across all sports (the existing `envelope.test.ts` zone assertions must stay green, unchanged).
2. `zonesConfidence` is `estimated` for a no-anchor / no-data athlete and `measured` for a self-reported or data-derived one — verified for run (derived vs estimate), swim, rowing, cycling.
3. The plan-preview shows the zones card under the summary in both modes; a `lift` athlete sees no card; non-lift/non-polish behavior is otherwise unchanged.
4. The estimated variant shows the tag + nudge; the measured variant does not.
5. **No migration, no edge change, `CoachingEnvelope` byte-identical** — full Jest suite green.
