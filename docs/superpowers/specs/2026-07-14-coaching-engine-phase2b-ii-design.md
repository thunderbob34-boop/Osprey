# Coaching-Engine Phase 2b-ii — Baseline Anchor Input — Design Spec

> Created 2026-07-14. Adds real athlete-anchor **self-report** to the coaching engine: an optional onboarding
> Baseline step that pins a sport's training anchor, and a self-report priority in `computeEnvelope`. Detailing
> of the parent 2b design (`2026-07-14-coaching-engine-phase2b-design.md` §3–§4, §6) into an implementable slice.
> Read the 2b spec and `docs/coaching/` alongside.

## 1. Where 2b-i left off

2b-i made swim/rowing/hyrox selectable and routed them to 2a's zone engine — but every athlete's anchor is still
**coarse**: `computeEnvelope` resolves run/rowing from logged data or an experience-tier estimate, and **swim is
tier-only** (`estimateSwimCssByTier` — there is no way to derive swim CSS from `total_distance_km`+`total_duration_s`,
per the parent spec §2). A brand-new athlete has *no* logged workouts, so onboarding plans start from tier
estimates for every sport. 2b-ii lets an athlete state a real baseline and makes the engine prefer it.

**Decisions locked in brainstorming:**
- **Optional Baseline lives in-flow in onboarding, skippable** (after the goal/schedule screen, before health) —
  captured at the moment of intent; the first generated plan uses real zones; smallest surface.
- **Cover all three active sports** (swim / rowing / run+hyrox) — all three benefit at onboarding because a new
  athlete has no logs to derive from.
- **HR-fallback zones are 2b-iii; cycling FTP is 2c.** 2b-ii's ladder is `self_report > data-derive > tier`.

## 2. This slice is app-only — no migration, no edge-fn change

The key architectural fact that scopes 2b-ii tightly:
- **No migration.** `user_goals.threshold_anchor JSONB` already exists (Phase 1, migration `20260714000002`) and
  is currently unused. 2b-ii is its first reader/writer.
- **No edge-fn change, no redeploy.** `computeEnvelope` + `build-envelope` run **in the app** (`OSPREY-app/src/services/coaching/`); the app resolves the `CoachingEnvelope` and hands `envelope.zones` to `ozzie-generate-plan`, which since 2a/2b-i already accepts any `ZoneSet`. A more-accurate anchor only changes the *numbers* inside `zones` — the contract is unchanged.

So 2b-ii ships entirely with the app build and adds **nothing** to the 2b-i go-live deploy coupling. Low-risk.

## 3. Anchor priority in `computeEnvelope` (the pure core)

`computeEnvelope` (`envelope.ts`) gains one optional input carrying the athlete's self-reported anchor, and prefers
it per sport before today's data/tier resolution:

```ts
// added to EnvelopeInput:
selfReportAnchor?: {
  thresholdSecPerMile?: number | null;
  cssSecPer100?: number | null;
  splitSecPer500?: number | null;
} | null;
```

- **run / hyrox** (`blueprintSport === 'run'`): `selfReportAnchor?.thresholdSecPerMile ?? resolveRunningAnchor(data/tier).thresholdSecPerMile`
- **swim**: `selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(fitnessLevel)`
- **rowing**: `selfReportAnchor?.splitSecPer500 ?? input.rowingSplitSecPer500 ?? estimateRowingSplitByTier(fitnessLevel)`

The rest of `computeEnvelope` (band construction via `runningPaceZones`/`swimPaceZones`/`rowingTrainingZones`,
periodization, fuel) is unchanged. **Regression guard:** when `selfReportAnchor` is absent/null the output is
byte-identical to today for every sport.

## 4. `build-envelope` wiring

`build-envelope.ts` already fetches `user_goals`; extend it to read and thread the anchor:
- Add `threshold_anchor` to the `user_goals` select (`build-envelope.ts:57`).
- Flatten the stored per-sport map into the flat `selfReportAnchor` (the athlete has one primary sport, but
  passing all present fields is harmless — `computeEnvelope` picks by sport):
  `{ thresholdSecPerMile: anchor?.run?.thresholdSecPerMile ?? null, cssSecPer100: anchor?.swim?.cssSecPer100 ?? null, splitSecPer500: anchor?.row?.splitSecPer500 ?? null }`.
- Pass it into `EnvelopeInputs` → `envelopeFromInputs` → `computeEnvelope`. A malformed/absent column resolves to
  all-null (falls to data/tier) — never throws.

## 5. Storage shape (existing JSONB)

`user_goals.threshold_anchor` holds a per-sport map; 2b-ii writes only the onboarded sport's entry:
```json
{ "run":  { "thresholdSecPerMile": 443, "source": "self_report" },
  "swim": { "cssSecPer100": 95,        "source": "self_report" },
  "row":  { "splitSecPer500": 108,     "source": "self_report" } }
```
Keys `run` / `swim` / `row` (matching the parent spec §3). `source` is persisted for a future confidence/"measured
vs estimated" UI; 2b-ii stores it but does not yet surface it.

## 6. Baseline onboarding screen

A new **skippable** screen `app/(onboarding)/baseline.tsx`, inserted after `goals.tsx` (which routes to it instead
of straight to `health`), branching on the selected `primaryGoal`:

- **Swim** → two time fields (400m TT, 200m TT) → `computeCSSPer100(t400, t200)` → `cssSecPer100`. Lead with the
  gentle framing "Know your times? This sharpens your zones. Otherwise skip — we'll estimate and refine as you log."
- **Rowing** → one 2k-time field → `splitSecPer500 = t2k / 4` (2000 m ÷ 500).
- **Run / Hyrox** → a recent-run distance + time → `deriveThresholdSecPerMile(distanceMiles, timeS)` (Riegel,
  `anchor.ts`).
- **Any non-endurance goal (lift / weight_loss / general_fitness)** → the step self-skips (no anchor to collect).

**Skippable:** a "Skip" control routes to `health` without writing an anchor → the ladder falls to data/tier.
On submit, the computed entry is written to the onboarding draft and persisted in `completeOnboarding`'s
`user_goals` insert (`onboarding.ts:52`) as `threshold_anchor`.

**Validation** (pure, in a new `src/services/coaching/baseline.ts`, wrapping the existing calculators):
- All times/distances must be positive and within plausible bounds.
- **Swim: the 400 TT must exceed the 200 TT** (otherwise `computeCSSPer100` returns a non-positive/negative CSS).
- Invalid input blocks submit with an inline message; it never writes a bad anchor.

`baseline.ts` exposes pure `parseSwimBaseline(t400, t200)`, `parseRowingBaseline(t2k)`, `parseRunBaseline(distanceMiles, timeS)`
each returning the anchor entry or a validation error — this is the TDD core, keeping the screen a thin shell.

## 7. Onboarding flow & step numbering

Insert Baseline between `goals` (currently step 3 of 4) and `health`. Renumber so the progress bar stays accurate:
`goals` keeps its position, `baseline` becomes the next step, `health` shifts up one, and **every** onboarding
screen's `totalSteps` bumps by one (the same consistency the Phase-1 `totalSteps` fix enforced). The exact
per-screen `step`/`totalSteps` values are enumerated in the implementation plan after reading each screen. Routing:
`goals → /(onboarding)/baseline → /(onboarding)/health`, with Baseline's Skip also going to `health`.

## 8. Testing (TDD)
- App (Jest):
  - `baseline.ts` — `parseSwimBaseline` (incl. the 400>200 rule + non-positive/implausible rejection),
    `parseRowingBaseline` (split = t2k/4), `parseRunBaseline` (Riegel via `deriveThresholdSecPerMile`).
  - `envelope.ts` — `computeEnvelope` prefers `selfReportAnchor` over data/tier for run, swim, and rowing; and
    is byte-identical to today when `selfReportAnchor` is null (regression guard).
  - `build-envelope.ts` — reads `threshold_anchor`, flattens it, threads `selfReportAnchor`; missing/malformed
    column → all-null, no throw.
- The `baseline.tsx` screen is RN UI (no component-test harness) — verified by `npm run typecheck` and on-device.
- Existing 120 Jest + 16 Deno stay green; `no-restricted-syntax` lint clean.

## 9. Deploy
App-only. No migration (column exists), no edge-fn deploy. Ships with the app build. Nothing to add to the go-live
runbook beyond what 2b-i already records.

## 10. Risks & open questions
- **Swim TT friction** — two all-out time trials is a big ask at onboarding; most beginners will skip. Mitigate
  with gentle copy and a prominent Skip; the tier estimate is a fine fallback.
- **Run baseline sparsity** — many new runners have no recent *timed* run; skippable, and data-derivation takes
  over once they log.
- **No edit path yet** — 2b-ii captures the anchor only at onboarding. Changing it later (a settings "your zones"
  editor, or a post-onboarding "sharpen" prompt) is out of scope; re-deriving from logs still improves non-self-report
  anchors over time. **Open:** is onboarding-only acceptable for now, or is a minimal edit entry needed this slice?
  Lean: onboarding-only.
- **Plan-builder path** — a user selecting a sport in `preferences.tsx` (not onboarding) gets no Baseline prompt in
  2b-ii; they resolve via data/tier, and `computeEnvelope` still honors any `threshold_anchor` already stored.
- **`source` stored but unused** — persisted for a later confidence UI; harmless now.

## 11. Out of scope
Cycling FTP input + power zones (2c); HR-fallback zones (2b-iii); a post-onboarding "sharpen your zones" prompt or
settings zone-editor; surfacing measured-vs-estimated confidence; a plan-builder Baseline entry; changing the LLM.
