# Coaching-Engine Phase 2b-ii-web — Webapp Training Zones Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Training Zones panel on the webapp settings route where an athlete views + edits their per-sport anchor (run/swim/row) with a live zone-band preview, writing the same `user_goals.threshold_anchor` mobile reads.

**Architecture:** Webapp-only. Pure zone math + baseline parse are **ported** into `webapp/src/lib/` (the webapp's mirror convention), guarded against drift by a parity test that imports the OSPREY-app originals. A zod schema hardens the JSONB read; TanStack Query hooks read/merge-write the column (with a no-row guard). A React card renders per-sport sections with live band preview.

**Tech Stack:** Vite/React, TypeScript (`strict`, `noUnusedLocals`), vitest (`TZ=America/New_York vitest run`), TanStack Query, zod, Supabase JS.

## Global Constraints

- **TDD** for all pure logic: failing test → watch fail → implement → pass. Webapp tests: `cd webapp && npm test` (`TZ=America/New_York vitest run`).
- **Mirror convention:** ported files carry a `// ported from OSPREY-app/…` header and must be **byte-faithful** to the original math. The parity test (Task 3) enforces it for the calculators.
- **Webapp-only:** no migration, no edge-fn, no `OSPREY-app/**` change. Reads/writes the existing `user_goals.threshold_anchor JSONB`.
- **Storage shape:** `{ run?: {thresholdSecPerMile, source}, swim?: {cssSecPer100, source}, row?: {splitSecPer500, source} }`, `source: 'self_report'`. Rowing key is **`row`**.
- **No new dependencies** (zod, TanStack Query, supabase-js already in `webapp/`).
- Imports in `webapp/` are **relative** (no `@/` alias); the webapp does not import from `OSPREY-app/` except in the Task-3 parity test.

---

## File Structure

**New files (all under `webapp/`):**
- `src/lib/training-zones.ts` — ported `Range`/`formatMinSec`/`midpoint`, `swimPaceZones`, `runningPaceZones`, `rowingTrainingZones`, `computeCSSPer100` + their types.
- `src/lib/baseline.ts` — ported `parseSwimBaseline`/`parseRowingBaseline`/`parseRunBaseline` + `deriveThresholdSecPerMile`.
- `src/lib/threshold-anchor.ts` — `ThresholdAnchorSchema` (zod) + `ThresholdAnchorMap` type + `setAnchorEntry`/`clearAnchorEntry` pure helpers.
- `tests/training-zones.test.ts`, `tests/baseline.test.ts`, `tests/threshold-anchor.test.ts`, `tests/zone-parity.test.ts`
- `src/features/settings/TrainingZonesCard.tsx` — the card component.

**Modified files:**
- `src/features/settings/queries.ts` — add `useThresholdAnchor` + `useUpdateThresholdAnchor`.
- `src/routes/_authed/settings.tsx` — render `<TrainingZonesCard userId={…} />`.

---

### Task 1: Port the zone calculators (`training-zones.ts`)

**Files:**
- Create: `webapp/src/lib/training-zones.ts`
- Test: `webapp/tests/training-zones.test.ts`

**Interfaces:**
- Produces: `Range`, `formatMinSec`, `computeCSSPer100`, `SwimPaceZones`+`swimPaceZones`, `RunningPaceZones`+`runningPaceZones`+`formatRunningPace`, `RowingZone`+`RowingTrainingZones`+`rowingTrainingZones`. Tasks 2 (parse) and 5 (card preview) consume these.

- [ ] **Step 1: Write the failing test**

Create `webapp/tests/training-zones.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { swimPaceZones, runningPaceZones, rowingTrainingZones, computeCSSPer100 } from '../src/lib/training-zones';

describe('swimPaceZones', () => {
  it('offsets bands from CSS', () => {
    const z = swimPaceZones(95);
    expect(z.z3Threshold).toEqual({ min: 93, max: 97 });
    expect(z.z2Aerobic).toEqual({ min: 98, max: 101 });
    expect(z.z1EasyRecovery).toEqual({ min: 103, max: null });
  });
  it('computeCSSPer100 = (400 − 200) / 2', () => {
    expect(computeCSSPer100(360, 170)).toBe(95);
  });
});

describe('runningPaceZones', () => {
  it('offsets bands from threshold sec/mile', () => {
    const z = runningPaceZones(443);
    expect(z.easy).toEqual({ min: 503, max: 563 });
    expect(z.tenKPace).toEqual({ min: 428, max: 438 });
    expect(z.fiveKPace).toEqual({ min: 413, max: 423 });
  });
});

describe('rowingTrainingZones', () => {
  it('offsets bands from 2k split', () => {
    const z = rowingTrainingZones(108);
    expect(z.ut2.splitSecPer500).toEqual({ min: 120, max: 124 });
    expect(z.at.splitSecPer500).toEqual({ min: 111, max: 113 });
    expect(z.an.splitSecPer500).toEqual({ min: null, max: 108 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webapp && npm test -- training-zones`
Expected: FAIL — `../src/lib/training-zones` does not exist.

- [ ] **Step 3: Implement the port**

Create `webapp/src/lib/training-zones.ts` (ported verbatim; ONLY the zone + format helpers — omit the fuel/carb/watts/HR functions from the originals):

```typescript
// Training-zone math — ported verbatim from OSPREY-app/src/services/calculators/
// {types,swimming,running,rowing}.ts, the tested, shipped formulas the mobile app
// uses. Keep in sync with those; do not fork the math (parity test: tests/zone-parity.test.ts).

/** A numeric band; either bound is null when the zone is open-ended. */
export interface Range {
  min: number | null;
  max: number | null;
}

export function midpoint(range: Range): number | null {
  if (range.min == null || range.max == null) return null;
  return (range.min + range.max) / 2;
}

export function formatMinSec(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

/** CSS per 100 = (400 time − 200 time) ÷ 2, both in seconds. */
export function computeCSSPer100(time400Sec: number, time200Sec: number): number {
  return (time400Sec - time200Sec) / 2;
}

export interface SwimPaceZones {
  cssSecPer100: number;
  z1EasyRecovery: Range;
  z2Aerobic: Range;
  z3Threshold: Range;
  z4Vo2Max: Range;
}

export function swimPaceZones(cssSecPer100: number): SwimPaceZones {
  return {
    cssSecPer100,
    z1EasyRecovery: { min: cssSecPer100 + 8, max: null },
    z2Aerobic: { min: cssSecPer100 + 3, max: cssSecPer100 + 6 },
    z3Threshold: { min: cssSecPer100 - 2, max: cssSecPer100 + 2 },
    z4Vo2Max: { min: cssSecPer100 - 5, max: cssSecPer100 - 2 },
  };
}

export interface RunningPaceZones {
  thresholdSecPerMile: number;
  easy: Range;
  marathonPace: Range;
  halfMarathonPace: Range;
  tenKPace: Range;
  fiveKPace: Range;
  intervalPace: Range;
}

export function runningPaceZones(thresholdSecPerMile: number): RunningPaceZones {
  const t = thresholdSecPerMile;
  return {
    thresholdSecPerMile: t,
    easy: { min: t + 60, max: t + 120 },
    marathonPace: { min: t + 15, max: t + 30 },
    halfMarathonPace: { min: t + 5, max: t + 15 },
    tenKPace: { min: t - 15, max: t - 5 },
    fiveKPace: { min: t - 30, max: t - 20 },
    intervalPace: { min: t - 20, max: t - 10 },
  };
}

export function formatRunningPace(secPerMile: number): string {
  return `${formatMinSec(secPerMile)}/mi`;
}

export interface RowingZone {
  splitSecPer500: Range;
  strokeRateSpm: Range;
  percentOf2kPower: Range;
}

export interface RowingTrainingZones {
  current2kSplitSecPer500: number;
  ut2: RowingZone;
  ut1: RowingZone;
  at: RowingZone;
  tr: RowingZone;
  an: RowingZone;
}

export function rowingTrainingZones(current2kSplitSecPer500: number): RowingTrainingZones {
  const split = current2kSplitSecPer500;
  return {
    current2kSplitSecPer500: split,
    ut2: { splitSecPer500: { min: split + 12, max: split + 16 }, strokeRateSpm: { min: 18, max: 20 }, percentOf2kPower: { min: 55, max: 65 } },
    ut1: { splitSecPer500: { min: split + 6, max: split + 10 }, strokeRateSpm: { min: 22, max: 24 }, percentOf2kPower: { min: 65, max: 75 } },
    at: { splitSecPer500: { min: split + 3, max: split + 5 }, strokeRateSpm: { min: 26, max: 28 }, percentOf2kPower: { min: 75, max: 85 } },
    tr: { splitSecPer500: { min: split, max: split + 2 }, strokeRateSpm: { min: 28, max: 32 }, percentOf2kPower: { min: 85, max: 95 } },
    an: { splitSecPer500: { min: null, max: split }, strokeRateSpm: { min: 34, max: 40 }, percentOf2kPower: { min: 95, max: 110 } },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webapp && npm test -- training-zones`
Expected: PASS (3 describes).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/training-zones.ts webapp/tests/training-zones.test.ts
git commit -m "feat(webapp): port training-zone calculators (2b-ii-web)"
```

---

### Task 2: Port the baseline parse (`baseline.ts`)

**Files:**
- Create: `webapp/src/lib/baseline.ts`
- Test: `webapp/tests/baseline.test.ts`

**Interfaces:**
- Consumes: `computeCSSPer100` (Task 1), `riegelPredict` (existing `webapp/src/lib/predictions.ts`).
- Produces: `ParseResult`, `parseSwimBaseline`, `parseRowingBaseline`, `parseRunBaseline`, `deriveThresholdSecPerMile`.

- [ ] **Step 1: Write the failing test**

Create `webapp/tests/baseline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSwimBaseline, parseRowingBaseline, parseRunBaseline } from '../src/lib/baseline';

describe('parseSwimBaseline', () => {
  it('computes CSS for valid times', () => {
    expect(parseSwimBaseline(360, 170)).toEqual({ ok: true, value: 95 });
  });
  it('rejects 400 ≤ 200 (would give ≤0 CSS)', () => {
    expect(parseSwimBaseline(170, 360).ok).toBe(false);
  });
});

describe('parseRowingBaseline', () => {
  it('splits 2k time by 4', () => {
    expect(parseRowingBaseline(480)).toEqual({ ok: true, value: 120 });
  });
  it('rejects implausible', () => {
    expect(parseRowingBaseline(30).ok).toBe(false);
  });
});

describe('parseRunBaseline', () => {
  it('derives a plausible threshold', () => {
    const r = parseRunBaseline(6.2, 3000);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value).toBeGreaterThan(240); expect(r.value).toBeLessThan(900); }
  });
  it('rejects non-positive', () => {
    expect(parseRunBaseline(0, 3000).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webapp && npm test -- baseline`
Expected: FAIL — `../src/lib/baseline` does not exist.

- [ ] **Step 3: Implement the port**

Create `webapp/src/lib/baseline.ts` (mirrors OSPREY-app `coaching/baseline.ts` parse fns + `coaching/anchor.ts` `deriveThresholdSecPerMile`; reuses the webapp's existing `riegelPredict` port):

```typescript
// Baseline anchor parse/validate — ported from OSPREY-app/src/services/coaching/
// baseline.ts (parse fns) + anchor.ts (deriveThresholdSecPerMile). Uses the webapp's
// existing riegelPredict port. Keep the validation bounds in sync with the mobile file.
import { computeCSSPer100 } from './training-zones';
import { riegelPredict } from './predictions';

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

const ONE_HOUR_S = 3600;

export function deriveThresholdSecPerMile(distanceMiles: number, timeS: number): number {
  let miles = distanceMiles;
  for (let i = 0; i < 40; i++) {
    const t = riegelPredict(distanceMiles, timeS, miles);
    if (Math.abs(t - ONE_HOUR_S) < 5) break;
    miles *= ONE_HOUR_S / t;
  }
  return Math.round(ONE_HOUR_S / miles);
}

export function parseSwimBaseline(time400Sec: number, time200Sec: number): ParseResult {
  if (!Number.isFinite(time400Sec) || !Number.isFinite(time200Sec) || time200Sec <= 0) {
    return { ok: false, error: 'Enter both swim times in seconds.' };
  }
  if (time400Sec <= time200Sec) {
    return { ok: false, error: 'Your 400m time should be greater than your 200m time.' };
  }
  const css = computeCSSPer100(time400Sec, time200Sec);
  if (css < 40 || css > 200) return { ok: false, error: "That doesn't look like a valid swim — check your times." };
  return { ok: true, value: css };
}

export function parseRowingBaseline(time2kSec: number): ParseResult {
  if (!Number.isFinite(time2kSec) || time2kSec <= 0) return { ok: false, error: 'Enter your 2k time in seconds.' };
  const split = time2kSec / 4;
  if (split < 80 || split > 180) return { ok: false, error: "That doesn't look like a valid 2k time." };
  return { ok: true, value: split };
}

export function parseRunBaseline(distanceMiles: number, timeS: number): ParseResult {
  if (!Number.isFinite(distanceMiles) || !Number.isFinite(timeS) || distanceMiles <= 0 || timeS <= 0) {
    return { ok: false, error: 'Enter a distance and a time.' };
  }
  const threshold = deriveThresholdSecPerMile(distanceMiles, timeS);
  if (threshold < 240 || threshold > 900) return { ok: false, error: "That doesn't look right — check the distance and time." };
  return { ok: true, value: threshold };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webapp && npm test -- baseline`
Expected: PASS. (If `riegelPredict`'s signature differs, read `webapp/src/lib/predictions.ts` and match the call — it is `riegelPredict(knownDist, knownTime, targetDist)` per the mobile original.)

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/baseline.ts webapp/tests/baseline.test.ts
git commit -m "feat(webapp): port baseline anchor parse + deriveThreshold (2b-ii-web)"
```

---

### Task 3: Parity test — the drift guard

**Files:**
- Create: `webapp/tests/zone-parity.test.ts`

**Interfaces:**
- Consumes: the webapp ports (Task 1) + the OSPREY-app calculator originals (imported by relative path).

This is the mechanical drift guard (spec §7/§9). It is scoped to the three zone calculators, which are alias-free (`import { Range } from './types'`) and so load standalone under vitest. The OSPREY-app `baseline`/`anchor` originals use `@/` aliases and are NOT imported here; their parity is covered by the pinned-value unit tests in Task 2.

- [ ] **Step 1: Write the parity test (it should PASS immediately — that is the point)**

Create `webapp/tests/zone-parity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/training-zones';
// The OSPREY-app originals (pure; import only their local ./types).
import { swimPaceZones as mSwim } from '../../OSPREY-app/src/services/calculators/swimming';
import { runningPaceZones as mRun } from '../../OSPREY-app/src/services/calculators/running';
import { rowingTrainingZones as mRow } from '../../OSPREY-app/src/services/calculators/rowing';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync webapp/src/lib/training-zones.ts to the OSPREY-app original.
describe('zone calculator parity (webapp port === OSPREY-app original)', () => {
  it('swimPaceZones matches across CSS values', () => {
    for (const css of [70, 88, 95, 130]) expect(web.swimPaceZones(css)).toEqual(mSwim(css));
  });
  it('runningPaceZones matches across thresholds', () => {
    for (const t of [360, 443, 570, 700]) expect(web.runningPaceZones(t)).toEqual(mRun(t));
  });
  it('rowingTrainingZones matches across splits', () => {
    for (const s of [95, 108, 120, 150]) expect(web.rowingTrainingZones(s)).toEqual(mRow(s));
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd webapp && npm test -- zone-parity`
Expected: PASS (3 describes). If vitest cannot resolve the `../../OSPREY-app/...` imports, the calculators are still pure — confirm the relative path (from `webapp/tests/` up two levels to the repo root, then into `OSPREY-app/`).

- [ ] **Step 3: Confirm the webapp typecheck accepts the cross-import**

Run: `cd webapp && npx tsc --noEmit`
Expected: clean. The imported OSPREY-app calculators are strict-clean and export-complete, so `tsc` following them out of `include` should not error. If `tsc` objects to files outside the project root, add `"../OSPREY-app/src/services/calculators"` is NOT desired — instead narrow: keep the import and confirm; only if it truly fails, convert the three imports to `await import(...)` dynamic imports inside the test bodies (runtime-only parity), and note it.

- [ ] **Step 4: Commit**

```bash
git add webapp/tests/zone-parity.test.ts
git commit -m "test(webapp): zone-calculator parity guard vs OSPREY-app originals (2b-ii-web)"
```

---

### Task 4: `threshold-anchor.ts` — zod schema + merge helpers

**Files:**
- Create: `webapp/src/lib/threshold-anchor.ts`
- Test: `webapp/tests/threshold-anchor.test.ts`

**Interfaces:**
- Produces: `ThresholdAnchorSchema` (zod), `ThresholdAnchorMap` type, `parseThresholdAnchor(raw): ThresholdAnchorMap` (safe), `setAnchorEntry(map, key, value)`, `clearAnchorEntry(map, key)`, `AnchorKey = 'run'|'swim'|'row'`. Task 5 consumes all.

- [ ] **Step 1: Write the failing test**

Create `webapp/tests/threshold-anchor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseThresholdAnchor, setAnchorEntry, clearAnchorEntry } from '../src/lib/threshold-anchor';

describe('parseThresholdAnchor', () => {
  it('accepts a valid map', () => {
    const m = { swim: { cssSecPer100: 95, source: 'self_report' } };
    expect(parseThresholdAnchor(m)).toEqual(m);
  });
  it('returns {} for malformed input (does not throw or pass NaN through)', () => {
    expect(parseThresholdAnchor({ swim: { cssSecPer100: 'abc' } })).toEqual({});
    expect(parseThresholdAnchor(null)).toEqual({});
    expect(parseThresholdAnchor('garbage')).toEqual({});
  });
});

describe('setAnchorEntry / clearAnchorEntry preserve other sports', () => {
  it('sets one sport without touching others', () => {
    const cur = { run: { thresholdSecPerMile: 443, source: 'self_report' as const } };
    const next = setAnchorEntry(cur, 'swim', { cssSecPer100: 95, source: 'self_report' });
    expect(next).toEqual({
      run: { thresholdSecPerMile: 443, source: 'self_report' },
      swim: { cssSecPer100: 95, source: 'self_report' },
    });
  });
  it('clears one sport, keeps the rest', () => {
    const cur = {
      run: { thresholdSecPerMile: 443, source: 'self_report' as const },
      swim: { cssSecPer100: 95, source: 'self_report' as const },
    };
    expect(clearAnchorEntry(cur, 'swim')).toEqual({ run: { thresholdSecPerMile: 443, source: 'self_report' } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webapp && npm test -- threshold-anchor`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement it**

Create `webapp/src/lib/threshold-anchor.ts`:

```typescript
import { z } from 'zod';

const SourceEnum = z.enum(['self_report', 'derived', 'estimate']);

export const ThresholdAnchorSchema = z
  .object({
    run: z.object({ thresholdSecPerMile: z.number(), source: SourceEnum }),
    swim: z.object({ cssSecPer100: z.number(), source: SourceEnum }),
    row: z.object({ splitSecPer500: z.number(), source: SourceEnum }),
  })
  .partial();

export type ThresholdAnchorMap = z.infer<typeof ThresholdAnchorSchema>;
export type AnchorKey = 'run' | 'swim' | 'row';

// Robust read: a malformed/partial JSONB column becomes {} rather than throwing
// or passing a bad number downstream. Hardens the read the mobile app does with
// an unchecked cast.
export function parseThresholdAnchor(raw: unknown): ThresholdAnchorMap {
  const res = ThresholdAnchorSchema.safeParse(raw);
  return res.success ? res.data : {};
}

// Non-generic + internal cast: a dynamic (union) key with a union value can't be
// expressed as type-safe at the computed-property level, but the caller passes the
// entry shape matching `key`, so the runtime is correct.
export function setAnchorEntry(
  map: ThresholdAnchorMap,
  key: AnchorKey,
  value: NonNullable<ThresholdAnchorMap[AnchorKey]>,
): ThresholdAnchorMap {
  return { ...map, [key]: value } as ThresholdAnchorMap;
}

export function clearAnchorEntry(map: ThresholdAnchorMap, key: AnchorKey): ThresholdAnchorMap {
  const next = { ...map };
  delete next[key];
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webapp && npm test -- threshold-anchor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/threshold-anchor.ts webapp/tests/threshold-anchor.test.ts
git commit -m "feat(webapp): threshold_anchor zod schema + merge helpers (2b-ii-web)"
```

---

### Task 5: Data hooks + Training Zones card

**Files:**
- Modify: `webapp/src/features/settings/queries.ts` (add two hooks)
- Create: `webapp/src/features/settings/TrainingZonesCard.tsx`
- Modify: `webapp/src/routes/_authed/settings.tsx` (render the card)

**Interfaces:**
- Consumes: `parseThresholdAnchor`/`setAnchorEntry`/`clearAnchorEntry`/`ThresholdAnchorMap`/`AnchorKey` (Task 4), `parseSwim/Rowing/RunBaseline` (Task 2), `swimPaceZones`/`runningPaceZones`/`rowingTrainingZones`/`formatMinSec` (Task 1).

The hooks are thin Supabase wrappers and the card is React — no unit test harness; verified by `tsc` + the browser preview. The pure logic they use is fully tested (Tasks 1–4).

- [ ] **Step 1: Add the data hooks**

In `webapp/src/features/settings/queries.ts`, append (mirroring the existing `useUnits`/`useUpdateUnits`):

```typescript
import { parseThresholdAnchor, type ThresholdAnchorMap } from '../../lib/threshold-anchor';

export function useThresholdAnchor(userId: string) {
  return useQuery({
    queryKey: ['threshold-anchor', userId],
    queryFn: async (): Promise<ThresholdAnchorMap> => {
      const { data, error } = await supabase.from('user_goals').select('threshold_anchor').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return parseThresholdAnchor(data?.threshold_anchor);
    },
  });
}

export function useUpdateThresholdAnchor(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nextMap: ThresholdAnchorMap) => {
      // .select() returns the matched rows — empty means no user_goals row existed,
      // so surface an error instead of a silent no-op success.
      const { data, error } = await supabase
        .from('user_goals')
        .update({ threshold_anchor: nextMap })
        .eq('user_id', userId)
        .select('user_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Could not save — no goals record found for your account.');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['threshold-anchor', userId] }),
  });
}
```

- [ ] **Step 2: Create the card component**

Create `webapp/src/features/settings/TrainingZonesCard.tsx`. Per-sport sections; live band preview from the parsed input; Save merges + writes; Clear removes. Uses the existing `card` / `settings-row` / `btn` / `input` classes.

```tsx
import { useState } from 'react';
import { useThresholdAnchor, useUpdateThresholdAnchor } from './queries';
import { setAnchorEntry, clearAnchorEntry, type AnchorKey, type ThresholdAnchorMap } from '../../lib/threshold-anchor';
import { parseSwimBaseline, parseRowingBaseline, parseRunBaseline } from '../../lib/baseline';
import { swimPaceZones, runningPaceZones, rowingTrainingZones, formatMinSec, type Range } from '../../lib/training-zones';
import { ErrorPanel } from '../../components/ErrorPanel';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const mmss = (m: string, s: string) => num(m) * 60 + num(s);
const band = (r: Range, unit: string) =>
  r.min == null ? `≤ ${formatMinSec(r.max as number)} ${unit}` : r.max == null ? `≥ ${formatMinSec(r.min)} ${unit}` : `${formatMinSec(r.min)}–${formatMinSec(r.max)} ${unit}`;

type Row = { key: AnchorKey; title: string };
const ROWS: Row[] = [
  { key: 'run', title: 'Run' },
  { key: 'swim', title: 'Swim' },
  { key: 'row', title: 'Rowing' },
];

export function TrainingZonesCard({ userId }: { userId: string }) {
  const anchor = useThresholdAnchor(userId);
  const update = useUpdateThresholdAnchor(userId);
  if (anchor.isLoading) return <div className="card">Loading zones…</div>;
  if (anchor.error) return <ErrorPanel error={anchor.error} />;
  const map = anchor.data ?? {};

  return (
    <div className="card">
      <h3>Training Zones</h3>
      <p className="muted">Set your anchor per sport. These drive the paces in your generated plan.</p>
      {ROWS.map((row) => (
        <SportZone key={row.key} row={row} map={map} onSave={(next) => update.mutate(next)} saving={update.isPending} />
      ))}
      {update.error ? <ErrorPanel error={update.error} /> : null}
    </div>
  );
}

function SportZone({ row, map, onSave, saving }: { row: Row; map: ThresholdAnchorMap; onSave: (m: ThresholdAnchorMap) => void; saving: boolean }) {
  const entry = map[row.key];
  const [a, setA] = useState(''); const [b, setB] = useState('');
  const [c, setC] = useState(''); const [d, setD] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Parse current inputs → the anchor value (or null) for a live preview.
  let preview: number | null = null;
  if (row.key === 'swim') { const r = parseSwimBaseline(mmss(a, b), mmss(c, d)); if (r.ok) preview = r.value; }
  else if (row.key === 'row') { const r = parseRowingBaseline(mmss(a, b)); if (r.ok) preview = r.value; }
  else { const r = parseRunBaseline(num(a), mmss(c, d)); if (r.ok) preview = r.value; }

  const stored = row.key === 'swim' ? entry && 'cssSecPer100' in entry ? entry.cssSecPer100 : null
    : row.key === 'row' ? entry && 'splitSecPer500' in entry ? entry.splitSecPer500 : null
    : entry && 'thresholdSecPerMile' in entry ? entry.thresholdSecPerMile : null;
  const shown = preview ?? stored;

  function save() {
    setError(null);
    let value: number; let payload: NonNullable<ThresholdAnchorMap[AnchorKey]>;
    if (row.key === 'swim') { const r = parseSwimBaseline(mmss(a, b), mmss(c, d)); if (!r.ok) return setError(r.error); value = r.value; payload = { cssSecPer100: value, source: 'self_report' }; }
    else if (row.key === 'row') { const r = parseRowingBaseline(mmss(a, b)); if (!r.ok) return setError(r.error); value = r.value; payload = { splitSecPer500: value, source: 'self_report' }; }
    else { const r = parseRunBaseline(num(a), mmss(c, d)); if (!r.ok) return setError(r.error); value = r.value; payload = { thresholdSecPerMile: value, source: 'self_report' }; }
    onSave(setAnchorEntry(map, row.key, payload));
  }

  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <strong>{row.title}</strong>
      {row.key === 'swim' && <><TimeInput label="400m" m={a} s={b} setM={setA} setS={setB} /><TimeInput label="200m" m={c} s={d} setM={setC} setS={setD} /></>}
      {row.key === 'row' && <TimeInput label="2k" m={a} s={b} setM={setA} setS={setB} />}
      {row.key === 'run' && <><input placeholder="distance (mi)" value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" /><TimeInput label="time" m={c} s={d} setM={setC} setS={setD} /></>}

      {shown != null && <ZonePreview sportKey={row.key} value={shown} estimated={preview == null && stored == null} />}
      {stored == null && preview == null && <p className="muted">Not set — Ozzie estimates these from your training. Enter your numbers to set them precisely.</p>}

      {error ? <span className="err">{error}</span> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="button" disabled={saving || preview == null} onClick={save}>Save</button>
        {entry && <button className="btn" type="button" disabled={saving} onClick={() => onSave(clearAnchorEntry(map, row.key))}>Clear</button>}
      </div>
    </div>
  );
}

function ZonePreview({ sportKey, value }: { sportKey: AnchorKey; value: number; estimated: boolean }) {
  if (sportKey === 'swim') { const z = swimPaceZones(value); return <div className="muted">CSS {value}s/100m · easy {band(z.z2Aerobic, 's/100m')} · threshold {band(z.z3Threshold, 's/100m')}</div>; }
  if (sportKey === 'row') { const z = rowingTrainingZones(value); return <div className="muted">2k split {value}s/500m · UT2 {band(z.ut2.splitSecPer500, 's/500m')} · AT {band(z.at.splitSecPer500, 's/500m')}</div>; }
  const z = runningPaceZones(value); return <div className="muted">Threshold {formatMinSec(value)}/mi · easy {band(z.easy, '/mi')} · 5K {band(z.fiveKPace, '/mi')}</div>;
}

function TimeInput({ label, m, s, setM, setS }: { label: string; m: string; s: string; setM: (v: string) => void; setS: (v: string) => void }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <span className="muted" style={{ width: 48 }}>{label}</span>
      <input style={{ width: 60 }} placeholder="min" value={m} onChange={(e) => setM(e.target.value)} inputMode="numeric" />
      <span>:</span>
      <input style={{ width: 60 }} placeholder="sec" value={s} onChange={(e) => setS(e.target.value)} inputMode="numeric" />
    </span>
  );
}
```

> Style/class reconciliation: use the webapp's existing classes (`card`, `settings-row`, `btn`, `input`, `muted`, `err`). If `muted`/`err` aren't defined in `styles/`, use the nearest existing text/error classes (check `styles/app.css`) — the exact classes aren't load-bearing. `ErrorPanel` is at `../../components/ErrorPanel` (confirm its prop name is `error`).

- [ ] **Step 3: Render it on the settings route**

In `webapp/src/routes/_authed/settings.tsx`, import and render the card in the settings layout (it needs the authed `userId`, obtained the same way the existing cards get it — via `useUserProfile()` / the route's user):

```tsx
import { TrainingZonesCard } from '../../features/settings/TrainingZonesCard';
```
Render `<TrainingZonesCard userId={userId} />` alongside the existing cards (match how `LocationCard`/units get `userId` in this file).

- [ ] **Step 4: Typecheck**

Run: `cd webapp && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Full suite**

Run: `cd webapp && npm test`
Expected: PASS — the new lib tests + parity + the webapp's existing suite, all green.

- [ ] **Step 6: Browser check**

Start the webapp dev server and open the settings route; confirm the Training Zones card renders, entering swim 400/200 shows a live CSS + band preview, Save persists (reload shows the stored anchor + bands), Clear removes it.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/features/settings/queries.ts webapp/src/features/settings/TrainingZonesCard.tsx webapp/src/routes/_authed/settings.tsx
git commit -m "feat(webapp): Training Zones card — view/edit anchor with live band preview (2b-ii-web)"
```

---

## Post-implementation
Webapp-only — no migration, no edge-fn. Ships with the webapp's own deploy. A zone saved here flows into the next mobile-generated plan via `build-envelope`'s existing `threshold_anchor` read (2b-ii) — the two surfaces meet at the column.

## Self-Review

**Spec coverage** (against `2026-07-14-coaching-engine-phase2b-web-design.md`):
- §3 card, per-sport, set/unset + live preview, merge-save, clear → Task 5. ✅
- §4 ported baseline + calculators → Tasks 1–2. ✅
- §5 hooks (read+zod, merge-write + no-row guard) → Tasks 4–5 (Step 1). ✅
- §6 storage shape/keys → Task 4 schema. ✅
- §7 tests incl. the parity drift-guard → Tasks 1–4 + Task 3. ✅
- §9 hardened risks: parity test (Task 3), `.select()` no-row guard (Task 5 Step 1). ✅

**Placeholder scan:** none — pure modules have complete verbatim code; the card is complete. The two `>` notes (parity tsc fallback; CSS-class reconciliation) are explicit reconciliation instructions.

**Type consistency:** `ThresholdAnchorMap`/`AnchorKey`/`setAnchorEntry`/`clearAnchorEntry`/`parseThresholdAnchor` defined in Task 4, consumed with matching signatures in Task 5. `ParseResult` + parse fns (Task 2) and the zone fns + `Range`/`formatMinSec` (Task 1) match their Task-5 uses. Storage key `row` consistent. The parity test (Task 3) imports the exact zone-fn names from both sides.
