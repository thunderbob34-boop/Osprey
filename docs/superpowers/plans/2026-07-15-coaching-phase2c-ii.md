# Coaching-Engine Phase 2c-ii — Triathlon Composite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A triathlete gets one plan where each workout is guided (and swim/run auto-corrected) by its discipline's zone — via a composite `{ kind: 'triathlon', swim, bike, run }` `ZoneSet`.

**Architecture:** App: refactor `ZoneSet` to named per-discipline interfaces + a `TriathlonZone` composite; `computeEnvelope` resolves all three sub-anchors. Edge: refactor `validate.ts`'s clamp from "clamp the one zone kind" to `paceZoneForSession(z, sessionType)` (unifies single-sport — byte-identical — and triathlon: swim/run clamped, bike prompt-only); `index.ts` mirrors the composite + emits three-discipline guidance. App + edge only — no migration, no webapp (the 2c-i-b card already sets swim/bike/run), no mobile Baseline change.

**Tech Stack:** TypeScript, Jest (`TZ=Asia/Kolkata jest`), Deno (`deno test`/`check`). Reuses `swimPaceZones`/`runningPaceZones`/`cyclingPowerZones` + `estimateSwimCssByTier`/`resolveRunningAnchor` (all exist).

## Global Constraints

- **TDD.** App: `npm test` (from `OSPREY-app/`). Edge: `deno test`.
- **Regression is the primary gate:** `computeEnvelope`'s run/swim/rowing/cycling/null `zones` output stays byte-identical (the `ZoneSet` refactor is structural only), and **every existing `validate.ts` single-sport clamp test stays byte-for-byte green** (the `paceZoneForSession` refactor must not change single-sport clamping).
- **⚠️ GIT HYGIENE:** each task `git add`s ONLY its own files (never `git add -A`/`git add .` — untracked audit-reports/worktree files must stay out; `git status` before committing).
- **No migration** (triathlon `primary_goal_enum` value exists), **no webapp change**, **no mobile Baseline change**.
- App + edge deploy together (go-live coupling). Deno assert `https://deno.land/std@0.224.0/assert/mod.ts`; `@/` → `OSPREY-app/src`; lint clean.

---

## File Structure

**App:** `src/services/coaching/zones.ts` (refactor + composite), `src/services/coaching/envelope.ts` (triathlon branch) + `__tests__/envelope.test.ts`.
**Edge:** `supabase/functions/ozzie-generate-plan/validate.ts` (+`validate.test.ts`), `index.ts`.

---

### Task 1: App — composite `ZoneSet` + `computeEnvelope` triathlon branch

**Files:**
- Modify: `OSPREY-app/src/services/coaching/zones.ts`, `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts`

**Interfaces:**
- Produces: `RunZone`/`SwimZone`/`RowingZone`/`CyclingZone`/`TriathlonZone` named interfaces; `ZoneSet` gains the `triathlon` composite; `computeEnvelope('triathlon')` builds it. The edge mirrors (Tasks 2/3) hand-copy the composite.

- [ ] **Step 1: Write the failing tests** — add to `envelope.test.ts`:

```typescript
import { cyclingPowerZones } from '@/services/calculators/cycling';
import { swimPaceZones } from '@/services/calculators/swimming';
import { runningPaceZones } from '@/services/calculators/running';
import { estimateSwimCssByTier } from '@/services/coaching/anchor';

describe('computeEnvelope triathlon composite', () => {
  it('resolves swim + run + bike from self-report anchors', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'triathlon', maxHR: 180,
      selfReportAnchor: { thresholdSecPerMile: 440, cssSecPer100: 95, splitSecPer500: null, ftpWatts: 240 } });
    expect(env.zones).toEqual({
      kind: 'triathlon',
      swim: { kind: 'swim', cssSecPer100: 95, bands: swimPaceZones(95) },
      run: { kind: 'run', thresholdSecPerMile: 440, bands: runningPaceZones(440) },
      bike: { kind: 'cycling', ftpWatts: 240, bands: cyclingPowerZones(240) },
    });
  });
  it('leaves bike null when the triathlete has no FTP (→ HR for bikes); swim falls to tier', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'triathlon', fitnessLevel: 'beginner', maxHR: 180,
      selfReportAnchor: { thresholdSecPerMile: 440, cssSecPer100: null, splitSecPer500: null, ftpWatts: null } });
    const z = env.zones as Extract<typeof env.zones, { kind: 'triathlon' }>;
    expect(z.bike).toBeNull();
    expect(z.swim).toEqual({ kind: 'swim', cssSecPer100: estimateSwimCssByTier('beginner'), bands: swimPaceZones(estimateSwimCssByTier('beginner')) });
    expect(env.hrZones.maxHR).toBe(180); // HR still there for the bike sessions
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`triathlon` isn't a `ZoneSet` kind; `computeEnvelope` has no triathlon branch → `zones` null).

Run: `npm test -- src/services/coaching/__tests__/envelope.test.ts`

- [ ] **Step 3: Refactor `zones.ts` to named interfaces + the composite:**

```typescript
import { RunningPaceZones } from '@/services/calculators/running';
import { SwimPaceZones } from '@/services/calculators/swimming';
import { RowingTrainingZones } from '@/services/calculators/rowing';
import { CyclingPowerZones } from '@/services/calculators/cycling';

export interface RunZone { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones }
export interface SwimZone { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones }
export interface RowingZone { kind: 'rowing'; splitSecPer500: number; bands: RowingTrainingZones }
export interface CyclingZone { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones }
export interface TriathlonZone {
  kind: 'triathlon';
  swim: SwimZone | null;
  bike: CyclingZone | null;
  run: RunZone | null;
}
export type ZoneSet = RunZone | SwimZone | RowingZone | CyclingZone | TriathlonZone;

export type BlueprintSport = 'run' | 'swim' | 'rowing' | 'cycling';

/** Canonical primaryGoal → the blueprint whose zones drive the plan. Triathlon is a
 *  COMPOSITE handled directly in computeEnvelope, not a single blueprint sport. */
export function blueprintSport(primaryGoal: string): BlueprintSport | null {
  if (primaryGoal === 'run' || primaryGoal === 'hybrid' || primaryGoal === 'hyrox') return 'run';
  if (primaryGoal === 'swim') return 'swim';
  if (primaryGoal === 'rowing') return 'rowing';
  if (primaryGoal === 'cycling') return 'cycling';
  return null; // triathlon (composite) / lift / cross
}
```
(The named interfaces are structurally identical to the old inline members — every existing `zones = { kind: 'run', … }` construction still typechecks.)

- [ ] **Step 4: Add the triathlon branch to `computeEnvelope`** (`envelope.ts`). Wrap the existing `blueprintSport` dispatch so triathlon is handled first:

```typescript
  let zones: ZoneSet | null = null;
  if (input.sport === 'triathlon') {
    const t =
      input.selfReportAnchor?.thresholdSecPerMile ??
      resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).thresholdSecPerMile;
    const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
    const ftp = input.selfReportAnchor?.ftpWatts;
    zones = {
      kind: 'triathlon',
      swim: { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) },
      run: { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) },
      bike: ftp != null ? { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) } : null,
    };
  } else {
    const bp = blueprintSport(input.sport);
    if (bp === 'run') {
      // … the existing run/swim/rowing/cycling branches, UNCHANGED, moved inside this else …
    }
  }
```
(Keep the existing `if (bp === 'run') … else if (bp === 'cycling') …` chain verbatim inside the new `else`. `swimPaceZones`, `runningPaceZones`, `cyclingPowerZones`, `estimateSwimCssByTier`, `resolveRunningAnchor` are already imported.)

- [ ] **Step 5: Run — expect PASS** (triathlon composite + the FTP-absent case; existing zone/regression tests green), then `npm run typecheck`.

- [ ] **Step 6: Commit** — `git add OSPREY-app/src/services/coaching/zones.ts OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` ; `git commit -m "feat(coaching): triathlon composite ZoneSet + computeEnvelope branch (2c-ii)"`

---

### Task 2: Edge — `validate.ts` per-session-type clamp dispatch

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/validate.ts`
- Test: `supabase/functions/ozzie-generate-plan/validate.test.ts`

**Interfaces:**
- Produces: `Zones` gains the `triathlon` composite; the clamp dispatches via `paceZoneForSession`. Single-sport clamping is byte-identical.

- [ ] **Step 1: Write the failing test** — add to `validate.test.ts` (Deno assert style):

```typescript
Deno.test('triathlon clamps swim + run by their sub-zones, leaves bike unclamped', () => {
  const envelope = {
    hardSessionShareMax: 0.5,
    zones: {
      kind: 'triathlon',
      swim: { kind: 'swim', cssSecPer100: 95, bands: { z1EasyRecovery: { min: 103, max: 999 }, z2Aerobic: { min: 98, max: 101 }, z3Threshold: { min: 93, max: 97 }, z4Vo2Max: { min: 90, max: 93 } } },
      run:  { kind: 'run',  thresholdSecPerMile: 440, bands: { easy: { min: 500, max: 560 }, marathonPace: { min: 455, max: 470 }, tenKPace: { min: 425, max: 435 }, fiveKPace: { min: 410, max: 420 } } },
      bike: { kind: 'cycling', ftpWatts: 240, bands: { z2Endurance: { min: 134, max: 180 }, z4Threshold: { min: 218, max: 252 } } },
    },
    fuel: { dailyCarbG: { min: 1, max: 2 }, proteinG: { min: 1, max: 2 }, longSessionCarbGPerHour: 60 },
  };
  const days = [
    // easy swim implied WAY too fast (short distance / long time) → clamped into z2Aerobic
    { dayOffset: 0, session_type: 'swim', intensity: 'easy', planned_minutes: 30, planned_distance_km: 2 },
    // easy run implied too fast → clamped into the easy band
    { dayOffset: 1, session_type: 'run', intensity: 'easy', planned_minutes: 30, planned_distance_km: 8 },
    // bike → never clamped (advice-only), distance untouched
    { dayOffset: 2, session_type: 'bike', intensity: 'threshold', planned_minutes: 60, planned_distance_km: 30 },
  ];
  const { days: out, changed } = validateAndClamp(days as any, envelope as any);
  assertEquals(out[2].planned_distance_km, 30);          // bike untouched
  assert(changed.some((c) => c.includes('swim')));        // swim clamped
  assert(changed.some((c) => c.includes('run')));         // run clamped
  assert(!changed.some((c) => c.includes('day2')));       // bike not in the change log
});
```
> Adjust the swim/run `planned_*` so the implied pace genuinely lands outside the band (the goal is to observe a clamp on swim + run and none on bike). Match the existing `validate.test.ts` assertion idioms.

- [ ] **Step 2: Run — expect FAIL** (`triathlon` not in `Zones`; the clamp only handles single `run|swim|rowing`).

- [ ] **Step 3: Refactor `validate.ts`.** Name the zone sub-types, add the composite + `PaceZone`, retype `bandFor`, add `paceZoneForSession`, and rewrite the clamp loop:

Replace the `Zones` type block with named types:
```typescript
type Band = { min: number; max: number };
type RunZone = { kind: 'run'; thresholdSecPerMile: number; bands: { easy: Band; marathonPace: Band; tenKPace: Band; fiveKPace: Band } };
type SwimZone = { kind: 'swim'; cssSecPer100: number; bands: { z1EasyRecovery: Band; z2Aerobic: Band; z3Threshold: Band; z4Vo2Max: Band } };
type RowingZone = { kind: 'rowing'; splitSecPer500: number; bands: { ut2: { splitSecPer500: Band }; ut1: { splitSecPer500: Band }; at: { splitSecPer500: Band }; tr: { splitSecPer500: Band } } };
type CyclingZone = { kind: 'cycling'; ftpWatts: number; bands: { z2Endurance: Band; z4Threshold: Band } };
type TriZone = { kind: 'triathlon'; swim: SwimZone | null; bike: CyclingZone | null; run: RunZone | null };
type PaceZone = RunZone | SwimZone | RowingZone; // clampable (implied pace/split); cycling/tri are not directly clampable
type Zones = RunZone | SwimZone | RowingZone | CyclingZone | TriZone;
```

Retype `bandFor` to `PaceZone` (its body already only handles run/swim/rowing — drop the trailing `return null`'s reliance on other kinds):
```typescript
function bandFor(intensity: string, z: PaceZone): Band | null {
  if (z.kind === 'run') {
    if (intensity === 'easy') return z.bands.easy;
    if (intensity === 'moderate') return z.bands.marathonPace;
    if (intensity === 'threshold') return z.bands.tenKPace;
    if (intensity === 'interval') return z.bands.fiveKPace;
  } else if (z.kind === 'swim') {
    if (intensity === 'easy') return z.bands.z2Aerobic;
    if (intensity === 'moderate') return z.bands.z2Aerobic;
    if (intensity === 'threshold') return z.bands.z3Threshold;
    if (intensity === 'interval') return z.bands.z4Vo2Max;
  } else {
    if (intensity === 'easy') return z.bands.ut2.splitSecPer500;
    if (intensity === 'moderate') return z.bands.ut1.splitSecPer500;
    if (intensity === 'threshold') return z.bands.at.splitSecPer500;
    if (intensity === 'interval') return z.bands.tr.splitSecPer500;
  }
  return null;
}

// The pace zone (if any) that applies to a given session type. Single-sport zones
// apply only to their own session type; a triathlon composite routes swim→swim,
// run→run; bike (and lift/cross) have no pace clamp.
function paceZoneForSession(z: Zones | null, sessionType: string): PaceZone | null {
  if (!z) return null;
  if (z.kind === 'run') return sessionType === 'run' ? z : null;
  if (z.kind === 'swim') return sessionType === 'swim' ? z : null;
  if (z.kind === 'rowing') return sessionType === 'rowing' ? z : null;
  if (z.kind === 'triathlon') {
    if (sessionType === 'swim') return z.swim;
    if (sessionType === 'run') return z.run;
    return null; // bike / lift / cross → no pace clamp
  }
  return null; // cycling → prompt-only
}
```

Rewrite the clamp block (the `const z = envelope.zones; if (z && (…)) { … }` section) to dispatch per session:
```typescript
  const z = envelope.zones;
  out = out.map((d) => {
    const pz = paceZoneForSession(z, d.session_type);
    if (pz && d.planned_minutes && d.planned_distance_km) {
      const perKm = KIND_UNIT_PER_KM[pz.kind];
      const band = bandFor(d.intensity, pz);
      if (band) {
        const implied = (d.planned_minutes * 60) / (d.planned_distance_km * perKm);
        const target = Math.min(band.max, Math.max(band.min, implied));
        if (target !== implied) {
          const newKm = (d.planned_minutes * 60) / (target * perKm);
          const roundedKm = target === band.min ? Math.floor(newKm * 10) / 10 : Math.ceil(newKm * 10) / 10;
          changed.push(`day${d.dayOffset}: pace ${Math.round(implied)}→${Math.round(target)} (${pz.kind})`);
          return { ...d, planned_distance_km: roundedKm };
        }
      }
    }
    return d;
  });
```
(`KIND_TYPE` is no longer used — the session-type match now lives in `paceZoneForSession`; delete the `KIND_TYPE` const. `KIND_UNIT_PER_KM` stays. The clamp arithmetic + direction-aware rounding are unchanged.)

- [ ] **Step 4: Run — expect PASS**: `deno test supabase/functions/ozzie-generate-plan/validate.test.ts` — the new triathlon test AND **every existing single-sport clamp test byte-identical** (run/swim/rowing clamp + cycling passthrough + polarization + fuel). This is the regression gate.

- [ ] **Step 5: Commit** — `git add` validate.ts + validate.test.ts ; `git commit -m "refactor(edge): per-session-type clamp dispatch + triathlon composite (2c-ii)"`

---

### Task 3: Edge — `index.ts` triathlon mirror + guidance

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts`

**Interfaces:**
- Consumes: the composite shape (app Task 1).
- Produces: the `Envelope` `ZoneSet` mirror includes `triathlon`; `zoneGuidance` emits the three disciplines.

Integration wiring; verified by `deno check` (no new errors) + `deno test` green.

- [ ] **Step 1: Extend the `ZoneSet` mirror** with the composite (the sub-members are the existing mirror interfaces — reference them by giving them names if inline, or inline the composite fields to match). Add after the `cycling` member:
```typescript
  | { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones }
  | { kind: 'triathlon'; swim: { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones } | null; bike: { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones } | null; run: { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones } | null };
```

- [ ] **Step 2: Add the triathlon `zoneGuidance` branch.** After the cycling arm, add a `z.kind === 'triathlon'` arm that concatenates each present sub-zone's guidance (reuse the existing swim-CSS / run-pace / bike-watts phrasing), and notes HR for a null sub-zone:
```typescript
          : z.kind === 'triathlon'
            ? ` Triathlon — build each discipline to its own zone:` +
              (z.run ? ` Run threshold ~${z.run.thresholdSecPerMile} sec/mi (easy ${z.run.bands.easy.min}-${z.run.bands.easy.max}).` : '') +
              (z.swim ? ` Swim CSS ~${z.swim.cssSecPer100} s/100m (easy ${z.swim.bands.z2Aerobic.min}-${z.swim.bands.z2Aerobic.max}).` : '') +
              (z.bike ? ` Bike power endurance Z2 ${z.bike.bands.z2Endurance.min}-${z.bike.bands.z2Endurance.max}w, threshold Z4 ${z.bike.bands.z4Threshold.min}-${z.bike.bands.z4Threshold.max}w (advice only — do NOT pace-clamp bike).` : ' Bike: no FTP — use the HR zones for rides.')
            : ` Bike power zones …`;  // ← the existing cycling arm becomes this final else
```
(Restructure the tail of the `zoneGuidance` ternary: the current final `: (cycling)` becomes `: z.kind === 'triathlon' ? (triathlon) : (cycling)`. Keep the run/swim/rowing/cycling strings verbatim.)

- [ ] **Step 3: Verify.** `deno test supabase/functions/ozzie-generate-plan/` — all green (validate incl. Task-2 triathlon test, goals, guidance). `deno check supabase/functions/ozzie-generate-plan/index.ts` — only the ~26 pre-existing `@supabase/supabase-js` errors (grep `ERROR`), none referencing `triathlon`.

- [ ] **Step 4: Commit** — `git add index.ts` ; `git commit -m "feat(edge): mirror triathlon composite + three-discipline guidance (2c-ii)"`

---

## Post-implementation
App + edge deploy together at go-live (composite zones + the `validate.ts` dispatch refactor + triathlon guidance) — add a 2c-ii line to `DEPLOY-CHECKLIST.md` (**second `validate.ts` change of the 2c arc**). No migration; no webapp change. On-device/analyst check: a triathlete who set swim+bike+run FTP on the webapp card gets a plan whose swim/run paces sit in-band and bike sessions carry watt targets.

## Self-Review

**Spec coverage** (against `2026-07-15-coaching-engine-phase2c-ii-design.md`):
- §2 composite `ZoneSet` (named interfaces + `TriathlonZone`) → Task 1. ✅
- §3 `computeEnvelope` triathlon (swim/run/bike resolution; bike null; handled before `blueprintSport`) → Task 1. ✅
- §4 `validate.ts` `paceZoneForSession` dispatch (single-sport byte-identical; tri swim/run clamp, bike none) → Task 2. ✅
- §5 `index.ts` mirror + three-discipline guidance → Task 3. ✅
- §6 no webapp/migration/mobile-Baseline; day-split kept → no such task. ✅
- §7 TDD (composite build + regression; per-session dispatch + single-sport byte-identical) → Tasks 1–2. ✅

**Placeholder scan:** none — code is complete. The two `>` notes are explicit reconciliations (tune the swim/run test distances to land out-of-band; match Deno assert idioms).

**Type consistency:** the app named interfaces (Task 1) are hand-mirrored in `validate.ts` (Task 2, own `PaceZone`/`TriZone`) and `index.ts` (Task 3, inline composite) — independent Deno copies by design. `paceZoneForSession` returns `PaceZone` (run/swim/rowing) consumed by the retyped `bandFor(z: PaceZone)`. The composite field names (`swim`/`bike`/`run`) are identical across app + both edge mirrors. `computeEnvelope`'s triathlon branch reads `selfReportAnchor.{thresholdSecPerMile,cssSecPer100,ftpWatts}` (all present since 2c-i-b).
