# Coaching-Engine Phase 2c-i-b — Cycling Power Zones + FTP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cyclist enters their FTP (or 20-min power) and gets Coggan power (watts) zones in their plan — on the phone and the web dashboard.

**Architecture:** Reuses three proven patterns for cycling. **App:** a `cycling` `ZoneSet` variant + a `computeEnvelope` branch (FTP → `cyclingPowerZones`, else `null` → 2b-iii HR fallback) + FTP self-report (`threshold_anchor.bike`) + a mobile Baseline FTP branch. **Edge fn:** `validate.ts` narrows the pace-clamp to run/swim/rowing (cycling is prompt-only) + `index.ts` emits watt guidance. **Webapp:** port `cyclingPowerZones` + `parseFTPBaseline` (parity-guarded) + a Cycling section in the Training Zones card.

**Tech Stack:** React Native/Expo, TypeScript, Jest (`TZ=Asia/Kolkata jest`), Deno (`deno test`/`check`), Vite/React + vitest (webapp). Reuses `cyclingPowerZones` + `estimateFTPFromTwentyMinPower` (already exist).

## Global Constraints

- **TDD.** App: `npm test` (from `OSPREY-app/`). Edge: `deno test`. Webapp: `cd webapp && npm test`.
- **Additive / regression-guarded:** `computeEnvelope`'s run/swim/rowing/null `zones` output stays byte-identical; a no-FTP cyclist gets `zones: null` + the universal `hrZones`. `validate.ts`'s run/swim/rowing clamp behavior stays identical (a test proves cycling passes through unclamped).
- **Cycling is prompt-only** — never pace-clamped (no power in `workout_logs`).
- **No migration** — `primary_goal_enum` has `cycling` (2c-i-a); `threshold_anchor` is existing JSONB. Just add the `bike` key to the app + webapp schemas.
- **App + edge fn deploy together** (joins the go-live coupling); webapp ships separately. This is the first `validate.ts` change since 2a.
- **Webapp mirror convention:** ported files carry `// ported from …`; the parity test (extended for cycling) is the drift guard.
- Deno assert `https://deno.land/std@0.224.0/assert/mod.ts`; `@/` → `OSPREY-app/src`; lint/`no-restricted-syntax` clean.

**FTP plausibility bound:** 50–600 W (used by `parseFTPBaseline` on both app + webapp — keep in sync).

---

## File Structure

**App:** `src/services/coaching/baseline.ts` (+test), `src/services/coaching/zones.ts`, `src/services/coaching/envelope.ts` (+`__tests__/envelope.test.ts`), `app/(onboarding)/baseline.tsx`.
**Edge:** `supabase/functions/ozzie-generate-plan/validate.ts` (+`validate.test.ts`), `index.ts`.
**Webapp:** `src/lib/training-zones.ts`, `src/lib/baseline.ts`, `src/lib/threshold-anchor.ts` (+tests), `tests/zone-parity.test.ts`, `src/features/settings/TrainingZonesCard.tsx`.

---

### Task 1: App anchor plumbing — FTP parse + `bike` anchor (`baseline.ts`)

**Files:**
- Modify: `OSPREY-app/src/services/coaching/baseline.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/baseline.test.ts`

**Interfaces:**
- Produces: `ThresholdAnchorMap.bike?: { ftpWatts; source }`; `SelfReportAnchor.ftpWatts: number | null`; `parseFTPBaseline(ftpWatts): ParseResult`; `anchorKeyForGoal('cycling') === 'bike'`; `toSelfReportAnchor` reads `bike.ftpWatts`. Tasks 2/3 consume these.

- [ ] **Step 1: Write the failing tests** — add to `baseline.test.ts`:

```typescript
import { parseFTPBaseline, anchorKeyForGoal, toSelfReportAnchor } from '@/services/coaching/baseline';

describe('parseFTPBaseline', () => {
  it('accepts a plausible FTP', () => {
    expect(parseFTPBaseline(240)).toEqual({ ok: true, value: 240 });
  });
  it('rejects non-positive / implausible watts', () => {
    expect(parseFTPBaseline(0).ok).toBe(false);
    expect(parseFTPBaseline(49).ok).toBe(false);
    expect(parseFTPBaseline(601).ok).toBe(false);
  });
});

describe('anchorKeyForGoal cycling', () => {
  it('maps cycling to the bike anchor key', () => {
    expect(anchorKeyForGoal('cycling')).toBe('bike');
  });
});

describe('toSelfReportAnchor bike', () => {
  it('reads bike.ftpWatts into the flat anchor', () => {
    expect(toSelfReportAnchor({ bike: { ftpWatts: 240, source: 'self_report' } })).toEqual({
      thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: null, ftpWatts: 240,
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`parseFTPBaseline` missing; `anchorKeyForGoal('cycling')` currently `null`; `toSelfReportAnchor` lacks `ftpWatts`).

Run: `npm test -- src/services/coaching/__tests__/baseline.test.ts`

- [ ] **Step 3: Implement** in `baseline.ts`:

Add `bike` to `ThresholdAnchorMap`:
```typescript
  row?: { splitSecPer500: number; source: AnchorSource };
  bike?: { ftpWatts: number; source: AnchorSource };
}
```
Add `ftpWatts` to `SelfReportAnchor`:
```typescript
  splitSecPer500: number | null;
  ftpWatts: number | null;
}
```
Add `parseFTPBaseline` (after `parseRunBaseline`):
```typescript
export function parseFTPBaseline(ftpWatts: number): ParseResult {
  if (!Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    return { ok: false, error: 'Enter your FTP in watts.' };
  }
  if (ftpWatts < 50 || ftpWatts > 600) {
    return { ok: false, error: "That doesn't look like a valid FTP — check your watts." };
  }
  return { ok: true, value: Math.round(ftpWatts) };
}
```
Handle cycling in `anchorKeyForGoal` (cycling maps to `bike` directly — decoupled from `blueprintSport` so this task stands alone):
```typescript
export function anchorKeyForGoal(goal: string): 'run' | 'swim' | 'row' | 'bike' | null {
  if (goal === 'cycling') return 'bike';
  const bp = blueprintSport(goal);
  return bp === 'rowing' ? 'row' : bp; // 'run' | 'swim' | null pass through
}
```
Read `bike` in `toSelfReportAnchor`:
```typescript
    splitSecPer500: map?.row?.splitSecPer500 ?? null,
    ftpWatts: map?.bike?.ftpWatts ?? null,
  };
```

- [ ] **Step 4: Run — expect PASS**, then `npm run typecheck`.

Note: adding `ftpWatts` (required) to `SelfReportAnchor` means every `SelfReportAnchor` literal must supply it. `toSelfReportAnchor` is the only constructor in app code; if `envelope.test.ts`/`build-envelope.test.ts` build `SelfReportAnchor` literals, they'll need `ftpWatts` — Task 2 updates the envelope tests, and any build-envelope test literal gets `ftpWatts: null` added. (typecheck will point to any.)

- [ ] **Step 5: Commit** — `git add` the two files; `git commit -m "feat(coaching): FTP parse + bike anchor plumbing (2c-i-b)"`

---

### Task 2: App cycling zones — `ZoneSet` variant + `computeEnvelope` branch

**Files:**
- Modify: `OSPREY-app/src/services/coaching/zones.ts`, `OSPREY-app/src/services/coaching/envelope.ts`
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts`

**Interfaces:**
- Consumes: `SelfReportAnchor.ftpWatts` (Task 1), `cyclingPowerZones`/`CyclingPowerZones` (`@/services/calculators/cycling`).
- Produces: `ZoneSet` `cycling` variant; `blueprintSport('cycling') === 'cycling'`; `computeEnvelope` emits cycling power zones from FTP, else `null`.

- [ ] **Step 1: Write the failing tests** — add to `envelope.test.ts`:

```typescript
import { cyclingPowerZones } from '@/services/calculators/cycling';

// hrBase (from the 2b-iii tests) has all fields; extend with the FTP anchor.
describe('computeEnvelope cycling', () => {
  it('builds cycling power zones from a self-reported FTP', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'cycling', maxHR: 180,
      selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: null, ftpWatts: 240 } });
    expect(env.zones).toEqual({ kind: 'cycling', ftpWatts: 240, bands: cyclingPowerZones(240) });
  });
  it('falls to zones:null + HR when a cyclist has no FTP', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'cycling', maxHR: 180, selfReportAnchor: null });
    expect(env.zones).toBeNull();
    expect(env.hrZones.maxHR).toBe(180);
  });
});
```
> If `hrBase` doesn't already carry an `ftpWatts` field in `selfReportAnchor`, none is needed here — these tests pass `selfReportAnchor` explicitly. Ensure any pre-existing `selfReportAnchor` literals in this file gain `ftpWatts: null` (Task 1 made the field required).

- [ ] **Step 2: Run — expect FAIL** (no cycling branch; `blueprintSport('cycling')` is `null` → `zones` null even with FTP).

- [ ] **Step 3: Implement.**

In `zones.ts`, import + extend the union + `BlueprintSport` + `blueprintSport`:
```typescript
import { CyclingPowerZones } from '@/services/calculators/cycling';
// … in ZoneSet, after the rowing member:
  | { kind: 'rowing'; splitSecPer500: number; bands: RowingTrainingZones }
  | { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones };

export type BlueprintSport = 'run' | 'swim' | 'rowing' | 'cycling';
// … in blueprintSport, before `return null`:
  if (primaryGoal === 'rowing') return 'rowing';
  if (primaryGoal === 'cycling') return 'cycling';
  return null;
```

In `envelope.ts`, import `cyclingPowerZones` and add the branch after the `rowing` branch:
```typescript
import { cyclingPowerZones } from '@/services/calculators/cycling';
// … after the `} else if (bp === 'rowing') { … }` block:
  } else if (bp === 'cycling') {
    const ftp = input.selfReportAnchor?.ftpWatts;
    if (ftp != null) {
      zones = { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) };
    }
    // else zones stays null → the universal hrZones (2b-iii) carries the cyclist's guidance
  }
```

- [ ] **Step 4: Run — expect PASS** (cycling FTP + no-FTP fallback; existing zone/regression tests still green), then `npm run typecheck`.

- [ ] **Step 5: Commit** — `git commit -m "feat(coaching): cycling ZoneSet + computeEnvelope power branch (2c-i-b)"`

---

### Task 3: Mobile Baseline — FTP branch (`baseline.tsx`)

**Files:**
- Modify: `OSPREY-app/app/(onboarding)/baseline.tsx`

**Interfaces:**
- Consumes: `parseFTPBaseline`, `anchorKeyForGoal`(→`'bike'`), `ThresholdAnchorMap.bike` (Task 1).

RN screen — no unit test; verified by `npm run typecheck` + on-device.

- [ ] **Step 1: Add cycling state + import.** Add `parseFTPBaseline` to the `@/services/coaching/baseline` import. Add state near the other fields:
```typescript
  const [ftp, setFtp] = useState(''); const [twentyMin, setTwentyMin] = useState('');
```

- [ ] **Step 2: Add the `bike` save branch.** In `onContinue`, add before the final `else` (run):
```typescript
    } else if (key === 'bike') {
      // FTP entered directly, or derived from 20-min power (0.95×) when FTP is blank.
      const ftpW = num(ftp) || (num(twentyMin) ? Math.round(num(twentyMin) * 0.95) : NaN);
      const r = parseFTPBaseline(ftpW);
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { bike: { ftpWatts: value, source: 'self_report' } };
    } else {
```

- [ ] **Step 3: Add the title + input UI.** Extend the `title` ternary with a `key === 'bike'` case (`'Know your FTP?'`), and add the bike input block to the JSX (mirror the run block's field style):
```tsx
      ) : key === 'bike' ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>FTP (watts)</Text>
            <TextInput style={styles.input} value={ftp} onChangeText={setFtp} keyboardType="number-pad" placeholder="240" placeholderTextColor={Colors.textMuted} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>…or your best 20-min power (watts)</Text>
            <TextInput style={styles.input} value={twentyMin} onChangeText={setTwentyMin} keyboardType="number-pad" placeholder="253" placeholderTextColor={Colors.textMuted} />
          </View>
        </>
      ) : (
```
(This slots into the existing `key === 'swim' ? … : key === 'row' ? … : (run)` chain — insert the `bike` arm before the run fallback.)

- [ ] **Step 4: Typecheck.** Run: `npm run typecheck` — clean. On-device: onboard as Cycling → Baseline shows the FTP fields → entering FTP produces power-zone paces in the plan; Skip still lands on Health.

- [ ] **Step 5: Commit** — `git commit -m "feat(onboarding): cycling FTP Baseline branch (2c-i-b)"`

---

### Task 4: Edge — `validate.ts` cycling no-clamp

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/validate.ts`
- Test: `supabase/functions/ozzie-generate-plan/validate.test.ts`

**Interfaces:**
- Produces: a `cycling` envelope passes all sessions through the clamp unchanged (fuel still attached).

- [ ] **Step 1: Write the failing test** — add to `validate.test.ts`:

```typescript
Deno.test('cycling envelope does not pace-clamp bike sessions (prompt-only)', () => {
  const envelope = {
    hardSessionShareMax: 0.2,
    zones: { kind: 'cycling', ftpWatts: 240, bands: { z2Endurance: { min: 134, max: 180 }, z4Threshold: { min: 218, max: 252 } } },
    fuel: { dailyCarbG: { min: 1, max: 2 }, proteinG: { min: 1, max: 2 }, longSessionCarbGPerHour: 60 },
  };
  const days = [{ dayOffset: 0, session_type: 'bike', intensity: 'threshold', planned_minutes: 60, planned_distance_km: 30 }];
  const { days: out, changed } = validateAndClamp(days as any, envelope as any);
  expect(out[0].planned_distance_km).toBe(30);  // untouched — no pace clamp
  expect(changed.length).toBe(0);
  expect((out[0] as any).fuel).toBeDefined();     // fuel still attached
});
```
> `validate.test.ts` uses Deno's assert, not `expect`. Match the file's existing style — rewrite the assertions with `assertEquals`/`assert` (e.g. `assertEquals(out[0].planned_distance_km, 30)`).

- [ ] **Step 2: Run — expect FAIL** (`cycling` isn't in `Zones`, so this won't even typecheck under `deno test`; and/or the clamp/`bandFor` mishandles it).

- [ ] **Step 3: Implement** in `validate.ts`:

Add `cycling` to the `Zones` union:
```typescript
  | { kind: 'rowing'; … }
  | { kind: 'cycling'; ftpWatts: number; bands: { z2Endurance: Band; z4Threshold: Band } };
```
Make `bandFor`'s rowing branch explicit so cycling returns `null` (the `else` currently assumes rowing — with cycling in the union it must be guarded):
```typescript
  } else if (z.kind === 'rowing') {
    if (intensity === 'easy') return z.bands.ut2.splitSecPer500;
    if (intensity === 'moderate') return z.bands.ut1.splitSecPer500;
    if (intensity === 'threshold') return z.bands.at.splitSecPer500;
    if (intensity === 'interval') return z.bands.tr.splitSecPer500;
  }
  return null;
```
Narrow the clamp block to the pace kinds so cycling skips it (was `if (z) {`):
```typescript
  const z = envelope.zones;
  if (z && (z.kind === 'run' || z.kind === 'swim' || z.kind === 'rowing')) {
    const clampType = KIND_TYPE[z.kind];
    // … unchanged …
  }
```

- [ ] **Step 4: Run — expect PASS**: `deno test supabase/functions/ozzie-generate-plan/validate.test.ts` (the new cycling test + all existing clamp tests green — run/swim/rowing behavior unchanged).

- [ ] **Step 5: Commit** — `git commit -m "fix(edge): validate.ts skips the pace-clamp for cycling (prompt-only) (2c-i-b)"`

---

### Task 5: Edge — `index.ts` cycling mirror + watt guidance

**Files:**
- Modify: `supabase/functions/ozzie-generate-plan/index.ts`

**Interfaces:**
- Consumes: the cycling envelope shape (app Task 2).
- Produces: the `Envelope` `ZoneSet` mirror includes `cycling`; `zoneGuidance` emits watt bands for a cycling envelope.

Integration wiring; verified by `deno check` (no new errors) + `deno test` staying green.

- [ ] **Step 1: Mirror `CyclingPowerZones` + extend the `ZoneSet` mirror.** Beside the other hand-narrowed interfaces (`RowingTrainingZones` etc.), add:
```typescript
interface CyclingPowerZones {
  ftpWatts: number;
  z1ActiveRecovery: Range; z2Endurance: Range; z3Tempo: Range; z4Threshold: Range;
  z5Vo2Max: Range; z6Anaerobic: Range; z7Neuromuscular: Range; sweetSpot: Range;
}
```
Extend the `ZoneSet` union:
```typescript
  | { kind: 'rowing'; splitSecPer500: number; bands: RowingTrainingZones }
  | { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones };
```

- [ ] **Step 2: Add the cycling `zoneGuidance` branch.** The current chain ends `… : z.kind === 'swim' ? (swim) : (rowing)`. Make rowing explicit and add cycling as the final arm:
```typescript
      : z.kind === 'swim'
        ? ` Swim CSS …`
        : z.kind === 'rowing'
          ? ` Rowing 2k split …`
          : ` Bike power zones (from FTP ~${z.ftpWatts}w): endurance Z2 ${z.bands.z2Endurance.min}-${z.bands.z2Endurance.max}w, threshold Z4 ${z.bands.z4Threshold.min}-${z.bands.z4Threshold.max}w. Advice only — target these watts for rides; do NOT distance/pace-clamp bike sessions.`;
```
(Keep the existing run/swim/rowing strings verbatim; only split the final `: rowing` into `? rowing : cycling`.)

- [ ] **Step 3: Verify.** `deno test supabase/functions/ozzie-generate-plan/` — all green (validate incl. the Task-4 cycling test; goals; guidance). `deno check supabase/functions/ozzie-generate-plan/index.ts` — only the ~26 pre-existing `@supabase/supabase-js` errors, none referencing `CyclingPowerZones`/`cycling`.

- [ ] **Step 4: Commit** — `git commit -m "feat(edge): mirror cycling zones + emit watt guidance (2c-i-b)"`

---

### Task 6: Webapp cycling pure logic — port + schema + parity

**Files:**
- Modify: `webapp/src/lib/training-zones.ts`, `webapp/src/lib/baseline.ts`, `webapp/src/lib/threshold-anchor.ts`, `webapp/tests/zone-parity.test.ts`
- Test: `webapp/tests/training-zones.test.ts`, `webapp/tests/baseline.test.ts`, `webapp/tests/threshold-anchor.test.ts`

**Interfaces:**
- Produces (webapp): `cyclingPowerZones`/`CyclingPowerZones`, `parseFTPBaseline`, `estimateFTPFromTwentyMinPower`, `ThresholdAnchorMap.bike`, `AnchorKey` += `'bike'`.

- [ ] **Step 1: Write failing tests** (vitest) — add:
`training-zones.test.ts`: `cyclingPowerZones(240)` → `z2Endurance {134,180}`, `z4Threshold {218,252}` (pins `pct(56)=134, pct(75)=180, pct(91)=218, pct(105)=252`).
`baseline.test.ts`: `parseFTPBaseline(240) === {ok:true,value:240}`; `parseFTPBaseline(0/49/601).ok === false`; `estimateFTPFromTwentyMinPower(253) === 240` (round(253×0.95)=240).
`threshold-anchor.test.ts`: `parseThresholdAnchor({ bike: { ftpWatts: 240, source: 'self_report' } })` round-trips; `setAnchorEntry(map, 'bike', {ftpWatts:240,source:'self_report'})` preserves other sports.

- [ ] **Step 2: Run — expect FAIL** (`cd webapp && npm test`).

- [ ] **Step 3: Implement the ports.**
- `training-zones.ts` — port `cyclingPowerZones` + `CyclingPowerZones` **verbatim** from `OSPREY-app/src/services/calculators/cycling.ts` (the interface + the `pct`-based function; NOT the `cyclingInRideCarbGPerHour` fuel fn). Keep the `// ported from …` header note.
- `baseline.ts` — add `parseFTPBaseline` (same body + 50–600 bound as app Task 1) and `estimateFTPFromTwentyMinPower` (port verbatim from `OSPREY-app/src/services/calculators/triathlon.ts` — `Math.round(watts * 0.95)`).
- `threshold-anchor.ts` — add `bike: z.object({ ftpWatts: z.number(), source: SourceEnum })` to `ThresholdAnchorSchema` (`.partial()` already applied) and `'bike'` to `AnchorKey`.

- [ ] **Step 4: Extend the parity guard** — in `zone-parity.test.ts`, import the OSPREY-app original and assert equality:
```typescript
import { cyclingPowerZones as mCyc } from '../../OSPREY-app/src/services/calculators/cycling';
// … inside the describe:
  it('cyclingPowerZones matches across FTP values', () => {
    for (const ftp of [180, 240, 300, 400]) expect(web.cyclingPowerZones(ftp)).toEqual(mCyc(ftp));
  });
```

- [ ] **Step 5: Run — expect PASS** (`cd webapp && npm test`), then `npx tsc --noEmit` (clean, incl. the cross-package parity import).

- [ ] **Step 6: Commit** — `git commit -m "feat(webapp): port cyclingPowerZones + FTP parse + bike schema + parity (2c-i-b)"`

---

### Task 7: Webapp Training Zones card — Cycling section

**Files:**
- Modify: `webapp/src/features/settings/TrainingZonesCard.tsx`

**Interfaces:**
- Consumes: the Task-6 webapp cycling logic + `bike` `AnchorKey`.

React UI — no unit test; verified by `npx tsc --noEmit` + `npm run build` + browser.

- [ ] **Step 1: Add the row + imports.** Import `parseFTPBaseline` and `cyclingPowerZones`. Add to `ROWS`:
```typescript
  { key: 'row', title: 'Rowing' },
  { key: 'bike', title: 'Cycling' },
];
```

- [ ] **Step 2: Add the `bike` arms** to `SportZone` — `preview`, `stored`, `save`, and the input JSX (an FTP watts field), mirroring the existing per-sport branches:
```typescript
// preview: add before the run fallback
else if (row.key === 'bike') { const r = parseFTPBaseline(num(a)); if (r.ok) preview = r.value; }
// stored: add a bike arm
row.key === 'bike' ? (entry && 'ftpWatts' in entry ? entry.ftpWatts : null) :
// save: add before the run fallback
else if (row.key === 'bike') { const r = parseFTPBaseline(num(a)); if (!r.ok) return setError(r.error); value = r.value; payload = { ftpWatts: value, source: 'self_report' }; }
// input JSX: add
{row.key === 'bike' && <input placeholder="FTP (watts)" value={a} onChange={(e) => setA(e.target.value)} inputMode="numeric" />}
```

- [ ] **Step 3: Add the cycling `ZonePreview` arm:**
```typescript
if (sportKey === 'bike') { const z = cyclingPowerZones(value); return <div style={{ color: 'var(--mut)' }}>FTP {value}w · endurance {z.z2Endurance.min}-{z.z2Endurance.max}w · threshold {z.z4Threshold.min}-{z.z4Threshold.max}w</div>; }
```

- [ ] **Step 4: Verify.** `cd webapp && npx tsc --noEmit` (clean), `npm test` (Task-6 suites green), `npm run build` (clean). Browser: the settings Training Zones card shows a Cycling section; entering an FTP shows a live watt-band preview; Save persists.

- [ ] **Step 5: Commit** — `git commit -m "feat(webapp): Cycling section in the Training Zones card (2c-i-b)"`

---

## Post-implementation
App + edge fn deploy together at go-live (cycling `ZoneSet`/`computeEnvelope` + `validate.ts` narrow + watt guidance) — add a 2c-i-b line to the `DEPLOY-CHECKLIST.md` pending-redeploy note (**this is the first `validate.ts` change since 2a**). Webapp ships separately. No migration.

## Self-Review

**Spec coverage** (against `2026-07-15-coaching-engine-phase2c-i-b-design.md`):
- §2 cycling ZoneSet + computeEnvelope (FTP→power, else null→HR) → Task 2. ✅
- §3 FTP self-report (`bike` key, `ftpWatts`, `parseFTPBaseline`, `anchorKeyForGoal`, `toSelfReportAnchor`) → Task 1. ✅
- §4 validate no-clamp + edge watt guidance → Tasks 4 + 5. ✅
- §5 phone FTP input → Task 3. ✅
- §6 webapp (port + schema + parity + card) → Tasks 6 + 7. ✅
- §7 no migration; `bike` key added app+webapp → Tasks 1 + 6. ✅
- §8 TDD across app/edge/webapp → all tasks. ✅

**Placeholder scan:** none — every code step is concrete. The `>` notes are explicit reconciliations (Deno assert style; `SelfReportAnchor` literals gaining `ftpWatts: null`).

**Type consistency:** `ThresholdAnchorMap.bike`/`SelfReportAnchor.ftpWatts` (Task 1) consumed by `computeEnvelope` (Task 2) and mirrored in the webapp schema (Task 6). `ZoneSet` cycling variant (Task 2, app) is hand-mirrored in `validate.ts` (Task 4, minimal `z2Endurance`/`z4Threshold`) and `index.ts` (Task 5, full `CyclingPowerZones`) — the two edge mirrors are independent copies by design (Deno can't import `@/`). `anchorKeyForGoal` gains `'bike'` (Task 1) consumed by the Baseline screen (Task 3) and the webapp `AnchorKey` gains `'bike'` (Task 6) consumed by the card (Task 7). FTP bound 50–600 identical in app (Task 1) + webapp (Task 6) `parseFTPBaseline`.
