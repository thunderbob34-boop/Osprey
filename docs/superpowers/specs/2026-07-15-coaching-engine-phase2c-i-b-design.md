# Coaching-Engine Phase 2c-i-b — Cycling Power Zones + FTP — Design Spec

> Created 2026-07-15. "Half 2" of cycling: a cyclist enters their **FTP** and gets precise **power (watts) zones**
> in their plan, on both the phone and the web dashboard. Builds the cycling power-zone engine + FTP self-report +
> the FTP inputs. Reuses three proven patterns: the 2a zone-engine, the 2b-ii anchor-capture, and the 2b-ii-web
> webapp port+parity. Read those specs alongside.

## 1. Why this exists / what it delivers

2c-i-a made cycling selectable, but a cyclist has no power anchor, so `computeEnvelope` returns `zones: null` and
they fall to HR guidance. 2c-i-b lets them state their **FTP** (functional threshold power — the watts they can hold
for ~1 hour), turns it into the Coggan 7-zone power model, and feeds those watt targets to the plan generator. A
cyclist who skips FTP still gets HR guidance (2b-iii) — nothing regresses.

**Decisions locked in brainstorming:**
- **Everything at once** — phone FTP input + web-dashboard FTP input + the power-zone engine + the generator changes,
  as one coherent cycling-power feature.
- **Power is prompt-only, never clamped.** Watts can't be derived from a distance/duration prescription (no power in
  `workout_logs`), so cycling zones inform the prompt but the pace-clamp skips them (Phase 2 spec §3).
- **FTP entered directly, or computed from 20-min power** (`estimateFTPFromTwentyMinPower` = 0.95 × 20-min watts).

## 2. Cycling ZoneSet + `computeEnvelope` (mirrors 2a)

- `ZoneSet` (`zones.ts`) gains `| { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones }`.
- `BlueprintSport` gains `'cycling'`; `blueprintSport('cycling')` returns `'cycling'` (was `null` in 2c-i-a).
- `computeEnvelope` adds a cycling branch: **`if selfReportAnchor.ftpWatts` present → `cyclingPowerZones(ftp)`**, else
  leave `zones: null` (→ the 2b-iii `hrZones` fallback carries the cyclist's guidance). No FTP tier estimate + no
  data-derivation (no power logged), so absent-FTP cyclists get HR, not a guessed power zone.
- Regression: run/swim/rowing/null branches unchanged; `hrZones` still populated universally.

## 3. FTP self-report (mirrors 2b-ii)

The `threshold_anchor` JSONB gains a `bike` key; the flat `SelfReportAnchor` gains `ftpWatts`:
- `ThresholdAnchorMap` (`baseline.ts`) += `bike?: { ftpWatts: number; source: 'self_report' }`.
- `SelfReportAnchor` += `ftpWatts: number | null`; `toSelfReportAnchor` reads `map.bike?.ftpWatts`.
- `anchorKeyForGoal('cycling')` → `'bike'` (extend it; it already maps rowing→`row`).
- New pure `parseFTPBaseline(ftpWatts): ParseResult` — validates a plausible FTP (≈50–600 W). The 20-min→FTP
  conversion uses the existing `estimateFTPFromTwentyMinPower` before the parse.
- `build-envelope` already reads `threshold_anchor` + threads `selfReportAnchor` (2b-ii) — no query change; the new
  `ftpWatts` field rides the existing path.

## 4. Prompt-only guardrail (edge fn)

- **`validate.ts`:** add `cycling` to its hand-copied `Zones` union, and **narrow the pace-clamp block to
  run/swim/rowing** (`if (z && (z.kind === 'run' || z.kind === 'swim' || z.kind === 'rowing'))`), so a `cycling`
  envelope skips the clamp entirely. Fuel-attach + polarization still run for all sessions. Extend `validate.test.ts`
  to prove a cycling envelope passes bike sessions through unclamped.
- **`index.ts`:** the `Envelope` `ZoneSet` mirror gains `cycling`; `zoneGuidance` gains a cycling branch emitting the
  **watt** bands (endurance Z2 `z2Endurance`, threshold Z4 `z4Threshold`) with an explicit "advice only — not
  clamped" note so the LLM treats them as targets, not a distance/pace constraint.

## 5. Phone FTP input (mirrors the 2b-ii Baseline screen)

`app/(onboarding)/baseline.tsx` gains a cycling branch (reached because `anchorKeyForGoal('cycling')` is now
non-null, so `goals.tsx` routes a cyclist to the Baseline step): an **FTP (watts)** field, plus a secondary
"don't know it? enter your best 20-minute power" that converts via `estimateFTPFromTwentyMinPower`. On submit, writes
`threshold_anchor.bike = { ftpWatts, source: 'self_report' }`; skippable (→ HR fallback). Validation via
`parseFTPBaseline`.

## 6. Web-dashboard FTP input (mirrors 2b-ii-web)

- `webapp/src/lib/training-zones.ts` — port `cyclingPowerZones` + `CyclingPowerZones` (verbatim, `// ported from …`).
- `webapp/src/lib/baseline.ts` — port `parseFTPBaseline` + `estimateFTPFromTwentyMinPower`.
- `webapp/src/lib/threshold-anchor.ts` — `ThresholdAnchorSchema` gains `bike`; `AnchorKey` gains `'bike'`;
  `setAnchorEntry`/`clearAnchorEntry` already generic over `AnchorKey`.
- `webapp/tests/zone-parity.test.ts` — add `cyclingPowerZones` to the parity guard (webapp port === OSPREY-app
  original).
- The **Training Zones card** (`TrainingZonesCard.tsx`) gains a Cycling section (FTP input + live power-band
  preview + Save/Clear), reusing the existing per-sport section machinery.

## 7. Data model
No migration. `primary_goal_enum` already has `cycling` (2c-i-a); `threshold_anchor` is existing JSONB — 2c-i-b just
adds the `bike` key to the app + webapp schemas. Shape: `{ …, "bike": { "ftpWatts": 240, "source": "self_report" } }`.

## 8. Testing (TDD)
- App (Jest): `parseFTPBaseline` (valid + implausible); `computeEnvelope` cycling branch (FTP → `cyclingPowerZones`;
  no FTP → `zones: null` + `hrZones` present); `anchorKeyForGoal('cycling') === 'bike'`; `toSelfReportAnchor` reads
  `bike.ftpWatts`; regression: other sports' `zones` unchanged.
- Edge fn (Deno): `validate.ts` — a cycling envelope leaves bike sessions unclamped (fuel still attached); the pure
  cycling `zoneGuidance` string (extract/pin the watt output).
- Webapp (vitest): the ported `parseFTPBaseline` + `cyclingPowerZones`; the parity test covering cycling; the
  `bike` schema round-trip.
- The Baseline cycling branch + the webapp card section are UI — typecheck + on-device / browser. Existing suites
  stay green; `no-restricted-syntax` + parity clean.

## 9. Deploy
App (`computeEnvelope`, `baseline`, `zones`) + edge fn (`validate.ts`, `index.ts`) deploy together — joins the
go-live redeploy coupling (2a/2b-i/2b-iii/2c-i-a) in `docs/DEPLOY-CHECKLIST.md`. **This is the first coaching change
that redeploys the edge fn AND changes `validate.ts`** since 2a. Webapp ships with its own deploy. No migration.

## 10. Risks & open questions
- **Cycling has the weakest guardrail** — prompt + weekly-volume only, no per-session clamp (no power data). Accepted
  in Phase 2 spec §13; the "advice only" prompt note keeps expectations honest.
- **FTP staleness** — an entered FTP doesn't decay; a cyclist who detrains keeps optimistic zones until they re-enter.
  The webapp editor (this slice) is the fix path. A future auto-refresh from logged power is out of scope (no power
  logged).
- **Two ports of the cycling calculator** (app + webapp) — guarded by the parity test, same as swim/run/rowing.
- **Open:** FTP plausibility bounds — 50–600 W spans most humans; confirm during planning against `docs/coaching/cycling.md`.

## 11. Out of scope
Triathlon composite (2c-ii — now unblocked, has the bike anchor); fuel-per-day-type (2c-iii); power-meter import /
auto-FTP from logs; a cycling FTP-test workout prescription; changing the LLM.
