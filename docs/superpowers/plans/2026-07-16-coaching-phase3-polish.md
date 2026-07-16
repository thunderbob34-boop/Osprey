# Coaching-Engine Phase 3 — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the athlete their training zones on the plan-preview, flagging tier-estimated (low-confidence) anchors.

**Architecture:** Extract the zone dispatch out of `computeEnvelope` into a pure `resolveZones` that also returns a `measured | estimated` confidence (the envelope stays byte-identical — it ignores the confidence). A read-only `useDisplayZones` hook resolves the athlete's zones + confidence from their stored anchor; a `ZonesCard` renders them under the weekly summary on the plan-preview.

**Tech Stack:** TypeScript, React Native / Expo, Jest.

## Global Constraints

*(Copied verbatim from the spec.)*

- **App-only.** No edge-function change, no LLM-prompt change, **no migration**.
- **The `CoachingEnvelope` stays byte-identical.** No new field on the envelope; confidence is derived + consumed client-side only.
- **Zone output byte-identical.** Extracting `resolveZones` must not change any sport's zones — the existing `envelope.test.ts` zone assertions are the regression gate.
- **App tests:** `cd OSPREY-app && TZ=Asia/Kolkata npm test` (Jest, `TZ` mandatory).
- **TDD** for the pure logic (Task 1). The hook + card are typecheck + preview (device smoke test is the pre-ship item, same headless-Expo caveat as the collection screens).

Branch: `spec/coaching-phase3-polish` (spec committed `2c37911`). File links use the `Osprey/` prefix (repo is a subdir of the working directory).

---

## File Structure

- `OSPREY-app/src/services/coaching/envelope.ts` — extract `resolveZones` + `ZonesConfidence`; `computeEnvelope` calls it (uses only `.zones`).
- `OSPREY-app/src/hooks/useDisplayZones.ts` — **new.** Read-only anchor gather → `resolveZones` + `hrZones` → `{ zones, hrZones, confidence } | null`.
- `OSPREY-app/src/components/ZonesCard.tsx` — **new.** Compact per-sport card + estimated variant.
- `OSPREY-app/app/plan-preview.tsx` — render `ZonesCard` under the summary card in both modes.

Task order: 1 → 2 → 3. T2 consumes T1's `resolveZones`; T3 consumes T2's hook.

---

### Task 1: Extract `resolveZones` (+ confidence) from `computeEnvelope`

**Files:**
- Modify: `OSPREY-app/src/services/coaching/envelope.ts` (extract the zone dispatch at lines 80–124 into `resolveZones`; `computeEnvelope` calls it)
- Test: `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` (new `resolveZones` describe block; the existing zone assertions are the byte-identical gate)

**Interfaces:**
- Consumes: existing `EnvelopeInput`, `ZoneSet`, `blueprintSport`, `resolveRunningAnchor`, `estimateSwimCssByTier`, `estimateRowingSplitByTier`, `runningPaceZones`, `swimPaceZones`, `rowingTrainingZones`, `cyclingPowerZones` (all already imported in envelope.ts).
- Produces: `export type ZonesConfidence = 'measured' | 'estimated'`; `export function resolveZones(input: EnvelopeInput): { zones: ZoneSet | null; zonesConfidence: ZonesConfidence }`. Consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Add to `OSPREY-app/src/services/coaching/__tests__/envelope.test.ts` (extend the top import to `import { computeEnvelope, resolveZones, EnvelopeInput } from '@/services/coaching/envelope';`), then append:

```ts
describe('resolveZones confidence', () => {
  const base = {
    sport: 'run', phase: 'Base' as const, weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
    bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'intermediate', bodyWeightKg: 70, rowingSplitSecPer500: null,
  } as const;

  it('run: estimated with no anchor + no data, measured when data-derived, measured when self-reported', () => {
    expect(resolveZones({ ...base }).zonesConfidence).toBe('estimated');                          // tier fallback
    expect(resolveZones({ ...base, bestRunMiles: 3.1, bestRunTimeS: 1200 }).zonesConfidence).toBe('measured'); // derived
    expect(resolveZones({ ...base, selfReportAnchor: { thresholdSecPerMile: 440, cssSecPer100: null, splitSecPer500: null, ftpWatts: null } }).zonesConfidence).toBe('measured');
  });
  it('swim: measured only with a self-reported CSS', () => {
    expect(resolveZones({ ...base, sport: 'swim' }).zonesConfidence).toBe('estimated');
    expect(resolveZones({ ...base, sport: 'swim', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: 90, splitSecPer500: null, ftpWatts: null } }).zonesConfidence).toBe('measured');
  });
  it('rowing: measured with logged split data, estimated on the tier fallback', () => {
    expect(resolveZones({ ...base, sport: 'rowing' }).zonesConfidence).toBe('estimated');
    expect(resolveZones({ ...base, sport: 'rowing', rowingSplitSecPer500: 118 }).zonesConfidence).toBe('measured');
  });
  it('cycling: measured with FTP (power zones), null zones without FTP', () => {
    const withFtp = resolveZones({ ...base, sport: 'cycling', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: null, ftpWatts: 240 } });
    expect(withFtp.zones?.kind).toBe('cycling');
    expect(withFtp.zonesConfidence).toBe('measured');
    expect(resolveZones({ ...base, sport: 'cycling' }).zones).toBeNull(); // → display falls back to HR
  });
  it('triathlon: estimated if any shown discipline is estimated', () => {
    const allSelf = resolveZones({ ...base, sport: 'triathlon', selfReportAnchor: { thresholdSecPerMile: 440, cssSecPer100: 90, splitSecPer500: null, ftpWatts: 240 } });
    expect(allSelf.zonesConfidence).toBe('measured');
    const noSwim = resolveZones({ ...base, sport: 'triathlon', selfReportAnchor: { thresholdSecPerMile: 440, cssSecPer100: null, splitSecPer500: null, ftpWatts: 240 } });
    expect(noSwim.zonesConfidence).toBe('estimated'); // swim fell to tier
  });
  it('computeEnvelope zones equal resolveZones zones (extraction is faithful)', () => {
    const input: EnvelopeInput = { ...base, sport: 'rowing', rowingSplitSecPer500: 118 };
    expect(computeEnvelope(input).zones).toEqual(resolveZones(input).zones);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/envelope.test.ts`
Expected: FAIL — `resolveZones` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `OSPREY-app/src/services/coaching/envelope.ts`:

(a) Add the exported type + function (place it just above `computeEnvelope`). It is the zone-dispatch block from `computeEnvelope` (lines 80–124) moved verbatim, plus a confidence tracked per branch:

```ts
export type ZonesConfidence = 'measured' | 'estimated';

// Zone dispatch + a client-only confidence signal. `estimated` = the sport's pace/power
// anchor is a pure tier fallback (no self-report AND no logged data); `measured` otherwise.
// computeEnvelope consumes only `.zones` (byte-identical); the display path uses both.
export function resolveZones(input: EnvelopeInput): { zones: ZoneSet | null; zonesConfidence: ZonesConfidence } {
  const runConfidence = (): ZonesConfidence =>
    input.selfReportAnchor?.thresholdSecPerMile != null
      ? 'measured'
      : resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).source === 'derived'
        ? 'measured'
        : 'estimated';

  let zones: ZoneSet | null = null;
  let zonesConfidence: ZonesConfidence = 'estimated';

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
    const swimConf: ZonesConfidence = input.selfReportAnchor?.cssSecPer100 != null ? 'measured' : 'estimated';
    zonesConfidence = runConfidence() === 'estimated' || swimConf === 'estimated' ? 'estimated' : 'measured';
  } else {
    const bp = blueprintSport(input.sport);
    if (bp === 'run') {
      const t =
        input.selfReportAnchor?.thresholdSecPerMile ??
        resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).thresholdSecPerMile;
      zones = { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) };
      zonesConfidence = runConfidence();
    } else if (bp === 'swim') {
      const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
      zones = { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) };
      zonesConfidence = input.selfReportAnchor?.cssSecPer100 != null ? 'measured' : 'estimated';
    } else if (bp === 'rowing') {
      const hasSplit = input.selfReportAnchor?.splitSecPer500 != null || input.rowingSplitSecPer500 != null;
      const split =
        input.selfReportAnchor?.splitSecPer500 ?? input.rowingSplitSecPer500 ?? estimateRowingSplitByTier(input.fitnessLevel);
      zones = { kind: 'rowing', splitSecPer500: split, bands: rowingTrainingZones(split) };
      zonesConfidence = hasSplit ? 'measured' : 'estimated';
    } else if (bp === 'cycling') {
      const ftp = input.selfReportAnchor?.ftpWatts;
      if (ftp != null) {
        zones = { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) };
        zonesConfidence = 'measured';
      }
      // else zones stays null → the display falls back to hrZones (confidence from hrZones.source)
    }
  }
  return { zones, zonesConfidence };
}
```

(b) In `computeEnvelope`, replace the entire zone-dispatch block (the `let zones: ZoneSet | null = null;` through the closing `}` of the `else` at line 124) with:

```ts
  const { zones } = resolveZones(input);
```

Leave everything else (`hr`, `hrZones`, `strength`, `hyrox`, the return) unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npx jest src/services/coaching/__tests__/envelope.test.ts`
Expected: PASS — the new `resolveZones` describe **and** every pre-existing `computeEnvelope` zone assertion (the byte-identical gate).

- [ ] **Step 5: Full app suite (regression gate)**

Run: `cd OSPREY-app && TZ=Asia/Kolkata npm test`
Expected: PASS — the envelope is unchanged; only a pure function was extracted.

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/services/coaching/envelope.ts OSPREY-app/src/services/coaching/__tests__/envelope.test.ts
git commit -m "refactor(coaching): extract resolveZones + zones confidence from computeEnvelope (envelope byte-identical) (phase3-polish)"
```

---

### Task 2: `useDisplayZones` hook

**Files:**
- Create: `OSPREY-app/src/hooks/useDisplayZones.ts`
- Verify: `cd OSPREY-app && npx tsc --noEmit` (a DB-reading hook; the tested logic is Task 1's `resolveZones`).

**Interfaces:**
- Consumes: `resolveZones` / `ZonesConfidence` / `HrZoneInfo` from `@/services/coaching/envelope` (the first two added in Task 1); `resolveMaxHR` / `ultraHRZones` from `@/services/coaching/hr`; `ZoneSet` from `@/services/coaching/zones`; `toSelfReportAnchor` / `ThresholdAnchorMap` from `@/services/coaching/baseline`; `selectBestRunEffort` / `selectBestRowingSplit` from `@/services/coaching/anchor`; `supabase`; `useAuthStore`.
- Produces: `export function useDisplayZones(): { zones: ZoneSet | null; hrZones: HrZoneInfo; confidence: ZonesConfidence } | null`. Consumed by Task 3.

- [ ] **Step 1: Create the hook**

Mirror `build-envelope.ts`'s `invokeGeneratePlan` gather (the reads at build-envelope.ts:74–117), minus the plan-generation machinery. Create `OSPREY-app/src/hooks/useDisplayZones.ts`:

```ts
import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { resolveZones, type ZonesConfidence, type HrZoneInfo } from '@/services/coaching/envelope';
import type { ZoneSet } from '@/services/coaching/zones';
import { resolveMaxHR, ultraHRZones } from '@/services/coaching/hr';
import { toSelfReportAnchor, type ThresholdAnchorMap } from '@/services/coaching/baseline';
import { selectBestRunEffort, selectBestRowingSplit } from '@/services/coaching/anchor';

const MILES_PER_KM = 0.621371;
const RECENT_WINDOW_MS = 56 * 24 * 60 * 60 * 1000;

export interface DisplayZones {
  zones: ZoneSet | null;
  hrZones: HrZoneInfo;
  confidence: ZonesConfidence;
}

export function useDisplayZones(): DisplayZones | null {
  const userId = useAuthStore((s) => s.user?.id);
  const [result, setResult] = useState<DisplayZones | null>(null);

  useEffect(() => {
    if (!userId) { setResult(null); return; }
    let cancelled = false;
    (async () => {
      const [goalsRes, weightRes, runsRes, rowsRes, maxHrRes] = await Promise.all([
        supabase.from('user_goals').select('primary_goal, fitness_level, threshold_anchor').eq('user_id', userId).maybeSingle(),
        supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
        supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'rowing').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
        supabase.from('workout_logs').select('max_heart_rate').eq('user_id', userId).is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).not('max_heart_rate', 'is', null).order('max_heart_rate', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      const g = goalsRes.data;
      const sport = g?.primary_goal ?? 'run';
      if (sport === 'lift') { setResult(null); return; } // strength has no pace zones — no card

      const bestEffort = selectBestRunEffort(
        (runsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
          .map((r) => ({ distanceMiles: (r.total_distance_km as number) * MILES_PER_KM, timeS: r.total_duration_s as number })),
      );
      const rowingSplit = selectBestRowingSplit(
        (rowsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
          .map((r) => ({ distanceKm: r.total_distance_km as number, timeS: r.total_duration_s as number })),
      );

      const input = {
        sport, phase: 'Base' as const, weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
        fitnessLevel: g?.fitness_level ?? 'beginner',
        bodyWeightKg: (weightRes.data?.weight_kg as number | null) ?? 70,
        bestRunMiles: bestEffort?.distanceMiles ?? null,
        bestRunTimeS: bestEffort?.timeS ?? null,
        rowingSplitSecPer500: rowingSplit,
        selfReportAnchor: toSelfReportAnchor(g?.threshold_anchor as ThresholdAnchorMap | null),
        maxHR: (maxHrRes.data?.max_heart_rate as number | null) ?? null,
      };

      const { zones, zonesConfidence } = resolveZones(input);
      const hr = resolveMaxHR(input.maxHR);
      const hrZones: HrZoneInfo = { maxHR: hr.maxHR, source: hr.source, bands: ultraHRZones(hr.maxHR) };
      // When there are pace zones, use their confidence; otherwise the card shows HR, so use the HR source.
      const confidence: ZonesConfidence = zones ? zonesConfidence : hr.source === 'estimated' ? 'estimated' : 'measured';
      setResult({ zones, hrZones, confidence });
    })().catch(() => { if (!cancelled) setResult(null); });
    return () => { cancelled = true; };
  }, [userId]);

  return result;
}
```

*(Note: `resolveZones` takes an `EnvelopeInput`; the object above supplies every field `resolveZones` reads. `phase`/`weekNumber`/etc. are unused by `resolveZones` but satisfy the type — keep them.)* Confirm `HrZoneInfo` is exported from `envelope.ts` (it is) and `ZoneSet` from `zones.ts`.

- [ ] **Step 2: Typecheck**

Run: `cd OSPREY-app && npx tsc --noEmit`
Expected: 0 errors. (If `resolveZones`'s input type complains about extra/missing fields, align the object to `EnvelopeInput`'s optional `selfReportAnchor?`/`maxHR?`.)

- [ ] **Step 3: Commit**

```bash
git add OSPREY-app/src/hooks/useDisplayZones.ts
git commit -m "feat(app): useDisplayZones hook (resolve zones + confidence from the stored anchor) (phase3-polish)"
```

---

### Task 3: `ZonesCard` + wire into the plan-preview

**Files:**
- Create: `OSPREY-app/src/components/ZonesCard.tsx`
- Modify: `OSPREY-app/app/plan-preview.tsx` (render `<ZonesCard />` under the summary card, before the `SCHEDULE` label, in both modes)
- Verify: `cd OSPREY-app && npx tsc --noEmit` + preview. Device smoke test is the pre-ship item.

**Interfaces:**
- Consumes: `useDisplayZones` (Task 2); `useUnitPreference` (`@/hooks/useUnitPreference`); `Colors` (`@/constants/colors`).
- Produces: `export function ZonesCard(): JSX.Element | null`.

**Band access (all bands are ABSOLUTE values, confirmed against the calculators):**
- run / ultra / hyrox → `zones.kind === 'run'`: easy `zones.bands.easy` (sec/mi Range), threshold `zones.thresholdSecPerMile` (sec/mi scalar).
- swim → `zones.kind === 'swim'`: easy `zones.bands.z2Aerobic`, threshold `zones.bands.z3Threshold` (sec/100m Ranges).
- rowing → `zones.kind === 'rowing'`: easy `zones.bands.ut2.splitSecPer500`, threshold `zones.bands.at.splitSecPer500` (sec/500m Ranges).
- cycling → `zones.kind === 'cycling'`: easy `zones.bands.z2Endurance`, threshold `zones.bands.z4Threshold` (watt Ranges).
- triathlon → `zones.kind === 'triathlon'`: show run + swim (+ bike if present) each with its threshold, compact.
- no pace zones (`zones === null`, e.g. weight_loss/general/cycling-no-FTP) → HR: easy `hrZones.bands.z2Endurance`, threshold `hrZones.bands.z4Threshold` (bpm Ranges).
- (lift never reaches here — the hook returns `null`.)

- [ ] **Step 1: Build `ZonesCard`**

Create `OSPREY-app/src/components/ZonesCard.tsx`. It calls `useDisplayZones()`; returns `null` if that's `null`. Otherwise it renders a card matching the plan-preview's `summaryCard`/`raceCard` visual language (`Colors.surfaceTeal` bg, `Colors.borderTeal`, a teal `YOUR ZONES` micro-label with `letterSpacing: 1`), containing two rows — an aerobic/easy row (green dot) and a threshold row (amber dot) — each `label` left, `value` right. Build the two `{ label, value }` rows by switching on `zones?.kind` (or HR fallback) per the Band access table above. Format:
  - pace (sec/mi): a helper `paceMi(sec, units)` → `M:SS/mi`, or convert to `/km` when `units === 'metric'` (`sec / 0.621371` then format). A `Range` renders as `min–max`; the run threshold scalar renders as a single `~M:SS`.
  - swim (sec/100m): `M:SS/100m` (or `/100yd` imperial).
  - rowing (sec/500m): `M:SS/500m`.
  - cycling (watts) / HR (bpm): integer ranges — `min–max w` / `min–max bpm`.
  When `confidence === 'estimated'`, render an `Estimated` tag next to the label and one subtle line below the rows: `Estimated from your experience level — log a few efforts and these sharpen automatically.` No banner, no button.

Reuse the plan-preview style vocabulary (a self-contained `StyleSheet` in the component is fine; match `summaryLabel`/`summaryCard` colors). Keep font sizes ≥ 11.

- [ ] **Step 2: Wire into `plan-preview.tsx`**

Import `ZonesCard` and render `<ZonesCard />` immediately after the closing `</View>` of the `summaryCard` block (which ends just before `<Text style={styles.scheduleLabel}>SCHEDULE</Text>`), so it appears in **both** modes (the summary + schedule render for post-gen and view-only alike). No other change.

- [ ] **Step 3: Typecheck + preview**

Run: `cd OSPREY-app && npx tsc --noEmit` — Expected: 0 errors.
Then start the preview and confirm the zones card renders under the summary for a pace sport (run/swim/etc.), shows HR bands for a no-pace goal, is absent for a `lift` athlete, and shows the `Estimated` tag + nudge for a tier-only anchor. (Headless CI cannot render RN screens — a device/simulator smoke test is the pre-ship item, same caveat as ultra/powerlifting/hyrox.)

- [ ] **Step 4: Commit**

```bash
git add OSPREY-app/src/components/ZonesCard.tsx OSPREY-app/app/plan-preview.tsx
git commit -m "feat(app): zones card on the plan-preview + low-confidence-anchor nudge (phase3-polish)"
```

---

## After all tasks

- **Final whole-branch review** (superpowers:requesting-code-review, most capable model) over `git merge-base main HEAD`..HEAD. Focus: the envelope is byte-identical after the `resolveZones` extraction (Task 1's regression gate), the confidence rules match the spec across sports, and the hook/card handle every sport branch (incl. lift → no card, no-FTP cycling → HR).
- **finishing-a-development-branch:** run `cd OSPREY-app && TZ=Asia/Kolkata npm test` on the merged result before merging `--no-ff` to `main`.
- **Deploy:** app-only. No migration, no edge redeploy. (Independent of the coaching-engine's pending atomic redeploy.)

## Spec coverage map

| Spec item | Task |
|---|---|
| Extract `resolveZones` (envelope byte-identical) | 1 |
| `zonesConfidence` rules per sport | 1 |
| `useDisplayZones` hook (both modes, lift → null) | 2 |
| `ZonesCard` under the summary, per-sport bands, unit-aware | 3 |
| Estimated tag + subtle nudge, no banner/CTA | 3 |
| No migration / no edge / no prompt / `CoachingEnvelope` byte-identical | 1 (+ whole plan) |
