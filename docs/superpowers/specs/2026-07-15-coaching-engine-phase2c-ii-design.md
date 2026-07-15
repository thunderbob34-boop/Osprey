# Coaching-Engine Phase 2c-ii — Triathlon Composite — Design Spec

> Created 2026-07-15. Blends swim + bike + run into ONE plan where each workout is guided (and swim/run auto-corrected)
> by that discipline's zone. Reuses everything built for the individual sports (2a swim/run/rowing zones, 2c-i-b
> cycling power) via a composite `ZoneSet`. App + edge fn only — the anchor inputs already exist (the 2c-i-b webapp
> Training Zones card sets swim/bike/run). Read the Phase 2 spec (§5, §6, §8) and the 2c-i-b spec alongside.

## 1. Why this exists / what it delivers

A `triathlon` athlete already gets a swim/bike/run/lift **day split** (2b-i) and the goal is already selectable — but
`blueprintSport('triathlon')` is `null`, so `computeEnvelope` returns `zones: null` and their swim/bike/run sessions
get only generic HR guidance. 2c-ii gives triathlon a **composite zone** so each discipline is guided by its own
anchor: swim by CSS pace, bike by watts (FTP), run by threshold pace — and the swim/run paces are auto-corrected the
way single-sport swim/run already are.

**Decisions locked in brainstorming:**
- **Full scope:** composite zones + per-workout auto-correction (the validator dispatches per session type), not just
  prompt guidance.
- **Anchors reuse the existing capture:** a triathlete sets swim + bike + run on the 2c-i-b webapp Training Zones
  card; unset disciplines fall to data/tier (swim tier, run data/tier) or — for bike without FTP — HR. **No new input
  screens.**
- **App + edge only.** No migration (triathlon enum exists), no webapp change (card already has the 3 sections), no
  mobile Baseline change (single-anchor stays; mobile triathletes use the webapp card or estimates).

## 2. The composite `ZoneSet`

Refactor `zones.ts`'s inline union into named per-discipline interfaces (structurally identical — constructors
unchanged) so the composite can reference them:

```ts
export interface RunZone     { kind: 'run';     thresholdSecPerMile: number; bands: RunningPaceZones }
export interface SwimZone    { kind: 'swim';    cssSecPer100: number;        bands: SwimPaceZones }
export interface RowingZone  { kind: 'rowing';  splitSecPer500: number;      bands: RowingTrainingZones }
export interface CyclingZone { kind: 'cycling'; ftpWatts: number;            bands: CyclingPowerZones }
export interface TriathlonZone {
  kind: 'triathlon';
  swim: SwimZone | null;    // null → tier fell through / unset → HR guidance for swims
  bike: CyclingZone | null; // null → no FTP → HR guidance for bikes
  run: RunZone | null;
}
export type ZoneSet = RunZone | SwimZone | RowingZone | CyclingZone | TriathlonZone;
```

In practice swim + run always resolve (tier/data floors exist); only `bike` is commonly `null` (no FTP tier).

## 3. `computeEnvelope` — resolve the three sub-anchors

Triathlon is handled BEFORE the single-sport `blueprintSport` dispatch (it isn't one sport):

```ts
if (input.sport === 'triathlon') {
  const t = input.selfReportAnchor?.thresholdSecPerMile ?? resolveRunningAnchor({…}).thresholdSecPerMile;
  const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
  const ftp = input.selfReportAnchor?.ftpWatts;
  zones = {
    kind: 'triathlon',
    swim: { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) },
    run:  { kind: 'run',  thresholdSecPerMile: t, bands: runningPaceZones(t) },
    bike: ftp != null ? { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) } : null,
  };
} else { /* existing blueprintSport branches, unchanged */ }
```

Regression: run/swim/rowing/cycling/null branches are byte-identical; `hrZones` stays universally populated (so a
`null` bike sub-zone → bike sessions get HR guidance).

## 4. `validate.ts` — per-session-type zone dispatch (the key refactor)

Today the clamp is "clamp sessions whose type matches the one zone kind." Generalize it to **"pick the pace zone that
applies to each session's type"** — which unifies single-sport and triathlon and preserves single-sport behavior:

```ts
type PaceZone = RunZone | SwimZone | RowingZone; // clampable (has a pace/split); cycling is not

function paceZoneForSession(z: Zones | null, sessionType: string): PaceZone | null {
  if (!z) return null;
  if (z.kind === 'run')    return sessionType === 'run'    ? z : null;
  if (z.kind === 'swim')   return sessionType === 'swim'   ? z : null;
  if (z.kind === 'rowing') return sessionType === 'rowing' ? z : null;
  if (z.kind === 'triathlon') {
    if (sessionType === 'swim') return z.swim;   // SwimZone | null
    if (sessionType === 'run')  return z.run;    // RunZone | null
    return null;                                  // bike / lift / cross → no pace clamp
  }
  return null; // cycling → prompt-only
}
```

The clamp loop calls `paceZoneForSession(z, d.session_type)`; if it returns a zone, apply the existing pace-clamp
(`KIND_UNIT_PER_KM[pz.kind]`, `bandFor(d.intensity, pz)`, the Phase-1.1 direction-aware rounding — all unchanged).
For single-sport this yields exactly today's behavior (proven by the untouched clamp tests); for triathlon it clamps
swim sessions by the swim sub-zone and run sessions by the run sub-zone, and leaves bike/lift/cross alone. The
`Zones` union gains the `triathlon` composite; polarization + fuel-attach still run for all sessions.

## 5. Edge prompt (`index.ts`)

The `Envelope` `ZoneSet` mirror gains the `triathlon` composite. `zoneGuidance` gains a triathlon branch that emits
each present sub-zone's guidance — reusing the existing swim-CSS / run-pace / bike-watts phrasing — e.g. *"Triathlon
— Swim CSS …; Run threshold …; Bike power …"*; a `null` sub-zone is described as "use HR zones" (the universal
`hrZones` already carries HR guidance for those sessions). Brick sessions stay prompt-driven (unchanged).

## 6. What 2c-ii does NOT touch
- **Webapp** — the Training Zones card already sets swim/bike/run anchors; a triathlete just uses all three sections.
- **Mobile Baseline** — stays single-anchor. A mobile triathlete's zones come from the webapp card or data/tier
  (a multi-anchor onboarding screen is a future nicety, not this slice).
- **Day split** — the existing edge-fn triathlon split (bike/swim/lift/run) is kept. Aligning it to the blueprint's
  `disciplineHourSplit` (swim 20 / bike 50 / run 30) is a possible later tweak (§10).
- **No migration** (triathlon `primary_goal_enum` value exists).

## 7. Testing (TDD)
- App (Jest): `computeEnvelope('triathlon')` builds the composite (swim + run always; bike present iff FTP; bike
  `null` otherwise); a triathlete with all three self-report anchors gets all three sub-zones; the named-interface
  refactor leaves run/swim/rowing/cycling `zones` byte-identical (regression).
- Edge (Deno): `paceZoneForSession` (single-sport unchanged; triathlon swim→swim, run→run, bike→null); a triathlon
  envelope clamps a too-fast swim session AND a too-slow run session while leaving a bike session's
  `planned_distance_km` untouched; every existing single-sport clamp test stays green byte-for-byte.
- Existing 153 Jest + 22 Deno stay green; `no-restricted-syntax` + parity clean.

## 8. Deploy
App (`zones.ts`, `envelope.ts`) + edge fn (`validate.ts`, `index.ts`) deploy together — joins the go-live redeploy
coupling. This is the second `validate.ts` change of the 2c arc (after 2c-i-b). No migration; no webapp change.

## 9. Risks & open questions
- **The `validate.ts` refactor is the riskiest change** — it restructures the clamp dispatch. Mitigation: the
  refactor is behavior-preserving for single sports (every existing clamp test must stay byte-identical — that's the
  regression gate), and the new triathlon tests pin the per-discipline dispatch.
- **Partial anchors** — a triathlete with only a run anchor gets run pace zones + HR for swim/bike. Acceptable and
  honest; the webapp card lets them fill the rest.
- **Edge mirror bloat** — `validate.ts` + `index.ts` each hand-copy the growing `ZoneSet` (now incl. the composite).
  Independent copies by design (Deno can't import `@/`); kept minimal per file.
- **Open:** align the day split to `disciplineHourSplit`? Lean: keep the current split for this slice (it includes a
  strength day, which triathletes use); revisit if plans read bike-light.

## 10. Out of scope
Fuel-per-day-type (2c-iii); a mobile multi-anchor triathlon Baseline screen; `disciplineHourSplit` day-count
alignment; brick-session structural prescription; a triathlon-specific race taper; changing the LLM.
