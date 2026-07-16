# Webapp All-Sports Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the OSPREY webapp coherent for all 9 sports — a sport-aware calendar and a full-parity, editable strength/hybrid zones card — instead of assuming every athlete is a runner.

**Architecture:** The webapp is a Vite/React/TanStack-Query/supabase-js SPA. It gains four pure `src/lib/` modules that **copy** the mobile coaching math (the shipped build must be self-contained), each pinned by a **parity test** that imports the `OSPREY-app` original where that original is pure (`import '../../OSPREY-app/src/services/calculators/…'`, exactly like the existing `webapp/tests/zone-parity.test.ts`) and value-pins the phase-percent consts that live behind the mobile `@/` alias. It reads `user_goals.primary_goal` + `goal_params` for the first time, and edits write back to `goal_params` with a merge-preserving update.

**Tech Stack:** React 18, TanStack Router/Query, `@supabase/supabase-js`, Zod, Vitest (`TZ=America/New_York`).

## Global Constraints

- **Endurance behaviour stays byte-identical.** All strength/hybrid logic is additive and gated on `primary_goal`. The existing **91 webapp tests stay green, unchanged.**
- **Full parity.** Ported functions must equal the `OSPREY-app` originals. Pure calculators (`intensityZoneForPercent1RM`, `INTENSITY_ZONES`, `ENERGY_SYSTEM_ZONES`, `CROSSFIT_BENCHMARKS`, `franTier`, `predictCompromisedRunSplit`, `hyroxStationWeights`) are parity-tested by importing the mobile original. The phase-percent consts (`STRENGTH_PHASE_PERCENT`, `CROSSFIT_PHASE_PERCENT`, `BENCHMARK_BY_PHASE`) live in mobile files that import `@/…` (unresolvable in webapp vitest), so they are copied by value and pinned with a hardcoded test that cites the source `file:line`.
- **Merge-preserving writes.** Editing one field of `goal_params` reads the current JSONB, sets that one field, writes back — never clobbering sibling keys the mobile app owns (`competing`, `franSec`, `goalThirdKg`, `targetTimeMinutes`, other sports' params).
- **No migration, no edge-function change.** Every column read/written already exists.
- **Ported modules carry a header:** `// Ported verbatim from OSPREY-app/<path>. Keep in sync; parity: webapp/tests/<file>.` (mirrors `webapp/src/lib/training-zones.ts:1-3`).
- **Commands:** tests `cd webapp && npm test`; single file `cd webapp && npx vitest run tests/<file>`; typecheck `cd webapp && npm run typecheck`; build `cd webapp && npm run build`. Working dir is `/Users/gusjohnson/App Development`; the repo is the `Osprey/` subdir, so all paths below are under `Osprey/`.

---

## File Structure

| File | Responsibility |
|---|---|
| `webapp/src/lib/goals.ts` (new) | `PrimaryGoal` union + `PrimaryGoalSchema` (mirror mobile). |
| `webapp/src/lib/race-phase.ts` (new) | Port of `computeRacePhase` + `RaceGoal`/`RacePhaseInfo`/`RacePhaseName`. |
| `webapp/src/lib/strength-loads.ts` (new) | Port of `INTENSITY_ZONES` + `intensityZoneForPercent1RM`; webapp `strengthWorkingLoads` + `STRENGTH_PHASE_PERCENT`. |
| `webapp/src/lib/crossfit-zones.ts` (new) | Port of energy systems, benchmarks, `franTier`; `CROSSFIT_PHASE_PERCENT` + `BENCHMARK_BY_PHASE` + `crossfitStrengthLoads`. |
| `webapp/src/lib/hyrox-loads.ts` (new) | Port of `predictCompromisedRunSplit` + `hyroxStationWeights` + division type. |
| `webapp/src/lib/goal-params.ts` (new) | Per-sport Zod schemas + `mergeGoalParams` merge helper + validation. |
| `webapp/src/features/settings/queries.ts` (modify) | `useUserGoal` read; `useUpdateGoalParams` merge-write. |
| `webapp/src/features/settings/StrengthZones.tsx` (new) | The strength/hybrid card section (lift/crossfit/hyrox). |
| `webapp/src/features/settings/TrainingZonesCard.tsx` (modify) | Render `<StrengthZones>` under the endurance rows. |
| `webapp/src/routes/_authed/calendar.tsx` (modify) | Gate the Race Predictor; render the phase chip. |
| `webapp/tests/*` (new) | Parity + unit tests per module. |

---

## Task 1: `PrimaryGoal` type + `useUserGoal` read

**Files:**
- Create: `Osprey/webapp/src/lib/goals.ts`
- Modify: `Osprey/webapp/src/features/settings/queries.ts`
- Test: `Osprey/webapp/tests/goals.test.ts`

**Interfaces:**
- Produces: `PRIMARY_GOALS` (readonly tuple), `type PrimaryGoal`, `PrimaryGoalSchema` (Zod enum); `useUserGoal(userId: string)` → React-Query hook resolving `UserGoal { primaryGoal: PrimaryGoal | null; goalParams: unknown; targetRace: string | null; targetDate: string | null; totalWeeksPlanned: number | null; thresholdAnchor: ThresholdAnchorMap }`.

- [ ] **Step 1: Write the failing test** — `Osprey/webapp/tests/goals.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { PrimaryGoalSchema, PRIMARY_GOALS } from '../src/lib/goals';

describe('PrimaryGoal', () => {
  it('mirrors the OSPREY-app union exactly (11 goals)', () => {
    expect([...PRIMARY_GOALS].sort()).toEqual(
      ['crossfit', 'cycling', 'general_fitness', 'hybrid', 'hyrox', 'lift', 'rowing', 'run', 'swim', 'ultra', 'weight_loss'],
    );
  });
  it('parses a known goal and rejects junk', () => {
    expect(PrimaryGoalSchema.parse('crossfit')).toBe('crossfit');
    expect(PrimaryGoalSchema.safeParse('parkour').success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `cd Osprey/webapp && npx vitest run tests/goals.test.ts`
Expected: FAIL — cannot resolve `../src/lib/goals`.

- [ ] **Step 3: Implement `goals.ts`** — mirror `Osprey/OSPREY-app/src/types/onboarding.ts:4-15` verbatim.

```ts
import { z } from 'zod';

// Mirrors OSPREY-app/src/types/onboarding.ts PrimaryGoal. Keep in sync.
export const PRIMARY_GOALS = [
  'run', 'lift', 'hybrid', 'weight_loss', 'general_fitness',
  'swim', 'rowing', 'hyrox', 'cycling', 'ultra', 'crossfit',
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];
export const PrimaryGoalSchema = z.enum(PRIMARY_GOALS);
```

- [ ] **Step 4: Run it, verify pass**

Run: `cd Osprey/webapp && npx vitest run tests/goals.test.ts` → PASS.

- [ ] **Step 5: Add `useUserGoal` to `queries.ts`** — append to `Osprey/webapp/src/features/settings/queries.ts` (mirror `useThresholdAnchor` at lines 50-59).

```ts
import { PrimaryGoalSchema, type PrimaryGoal } from '../../lib/goals';

export interface UserGoal {
  primaryGoal: PrimaryGoal | null;
  goalParams: unknown;
  targetRace: string | null;
  targetDate: string | null;
  totalWeeksPlanned: number | null;
  thresholdAnchor: ThresholdAnchorMap;
}

export function useUserGoal(userId: string) {
  return useQuery({
    queryKey: ['user-goal', userId],
    queryFn: async (): Promise<UserGoal> => {
      const { data, error } = await supabase
        .from('user_goals')
        .select('primary_goal, goal_params, target_race, target_date, total_weeks_planned, threshold_anchor')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      const primary = PrimaryGoalSchema.safeParse(data?.primary_goal);
      return {
        primaryGoal: primary.success ? primary.data : null,
        goalParams: data?.goal_params ?? null,
        targetRace: data?.target_race ?? null,
        targetDate: data?.target_date ?? null,
        totalWeeksPlanned: data?.total_weeks_planned ?? null,
        thresholdAnchor: parseThresholdAnchor(data?.threshold_anchor),
      };
    },
  });
}
```

- [ ] **Step 6: Typecheck + commit**

```bash
cd Osprey/webapp && npm run typecheck
git add src/lib/goals.ts src/features/settings/queries.ts tests/goals.test.ts
git commit -m "feat(webapp): PrimaryGoal type + useUserGoal read (all-sports T1)"
```

---

## Task 2: `race-phase.ts` — phase from plan dates (port + parity)

**Files:**
- Create: `Osprey/webapp/src/lib/race-phase.ts`
- Test: `Osprey/webapp/tests/race-phase.test.ts`

**Interfaces:**
- Produces: `type RacePhaseName = 'Base'|'Build'|'Peak'|'Taper'`; `interface RaceGoal { targetRace: string|null; targetDate: string|null; totalWeeksPlanned: number|null }`; `interface RacePhaseInfo { weeksRemaining: number; currentWeekNumber: number; totalWeeks: number; phase: RacePhaseName }`; `computeRacePhase(goal: RaceGoal, now?: Date): RacePhaseInfo | null`; `phaseOrBase(goal: RaceGoal, now?: Date): RacePhaseName` (returns `computeRacePhase(...)?.phase ?? 'Base'`).

- [ ] **Step 1: Write the failing test** — port the boundary cases from `Osprey/OSPREY-app/src/services/plan.ts:41-73`.

```ts
import { describe, it, expect } from 'vitest';
import { computeRacePhase, phaseOrBase } from '../src/lib/race-phase';

const NOW = new Date('2026-03-01T12:00:00-05:00'); // fixed clock

describe('computeRacePhase', () => {
  it('returns null when undated or no total weeks', () => {
    expect(computeRacePhase({ targetRace: 'Marathon', targetDate: null, totalWeeksPlanned: 16 }, NOW)).toBeNull();
    expect(computeRacePhase({ targetRace: 'Marathon', targetDate: '2026-06-01', totalWeeksPlanned: null }, NOW)).toBeNull();
  });
  it('splits a 16-week plan Base/Build/Peak/Taper', () => {
    // week 1 of 16 (race ~16 weeks out) → Base
    expect(computeRacePhase({ targetRace: 'M', targetDate: '2026-06-21', totalWeeksPlanned: 16 }, NOW)!.phase).toBe('Base');
    // final 3 weeks → Taper
    expect(computeRacePhase({ targetRace: 'M', targetDate: '2026-03-15', totalWeeksPlanned: 16 }, NOW)!.phase).toBe('Taper');
  });
  it('phaseOrBase falls back to Base when undated', () => {
    expect(phaseOrBase({ targetRace: null, targetDate: null, totalWeeksPlanned: null }, NOW)).toBe('Base');
  });
});
```

- [ ] **Step 2: Run it, verify failure** — `cd Osprey/webapp && npx vitest run tests/race-phase.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `race-phase.ts`** — verbatim port of `computeRacePhase` (`plan.ts:32-74`). Parse the target date at LOCAL midnight (`new Date(\`${targetDate}T00:00:00\`)`, matching `plan.ts` `parseLocalDate` intent and `calendar.tsx:33`).

```ts
// Ported from OSPREY-app/src/services/plan.ts (computeRacePhase). Keep in sync; parity: tests/race-phase.test.ts.
export type RacePhaseName = 'Base' | 'Build' | 'Peak' | 'Taper';

export interface RaceGoal {
  targetRace: string | null;
  targetDate: string | null;
  totalWeeksPlanned: number | null;
}

export interface RacePhaseInfo {
  weeksRemaining: number;
  currentWeekNumber: number;
  totalWeeks: number;
  phase: RacePhaseName;
}

export function computeRacePhase(goal: RaceGoal, now: Date = new Date()): RacePhaseInfo | null {
  if (!goal.targetDate || !goal.totalWeeksPlanned) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const raceDate = new Date(`${goal.targetDate}T00:00:00`);
  if (isNaN(raceDate.getTime())) return null;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / msPerWeek));
  const totalWeeks = goal.totalWeeksPlanned;
  const currentWeekNumber = Math.min(totalWeeks, Math.max(1, totalWeeks - weeksRemaining + 1));
  const progress = currentWeekNumber / totalWeeks;
  const taperWeeks = totalWeeks <= 6 ? 1 : totalWeeks <= 10 ? 2 : 3;
  let phase: RacePhaseName;
  if (weeksRemaining <= taperWeeks) phase = 'Taper';
  else if (progress <= 0.4) phase = 'Base';
  else if (progress <= 0.75) phase = 'Build';
  else phase = 'Peak';
  return { weeksRemaining, currentWeekNumber, totalWeeks, phase };
}

export function phaseOrBase(goal: RaceGoal, now?: Date): RacePhaseName {
  return computeRacePhase(goal, now)?.phase ?? 'Base';
}
```

- [ ] **Step 4: Run it, verify pass** — `cd Osprey/webapp && npx vitest run tests/race-phase.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
cd Osprey/webapp && git add src/lib/race-phase.ts tests/race-phase.test.ts
git commit -m "feat(webapp): port computeRacePhase (all-sports T2)"
```

---

## Task 3: `strength-loads.ts` — powerlifting working loads (port + parity)

**Files:**
- Create: `Osprey/webapp/src/lib/strength-loads.ts`
- Test: `Osprey/webapp/tests/strength-loads.test.ts`

**Interfaces:**
- Consumes: `RacePhaseName` from `race-phase.ts`.
- Produces: `interface IntensityZone { name: string; percent1RMRange: [number, number]; repRange: [number, number]; rpeRange: [number, number]; rirRange: [number, number] }`; `INTENSITY_ZONES`; `intensityZoneForPercent1RM(pct): IntensityZone | null`; `STRENGTH_PHASE_PERCENT: Record<RacePhaseName, number>`; `strengthWorkingLoads(oneRepMaxKg: { squat: number|null; bench: number|null; deadlift: number|null }, phase: RacePhaseName)` → `{ workingPercent1RM: number; zoneName: string; loads: { squat: number; bench: number; deadlift: number } }` (load = `orm && orm>0 ? Math.round(orm*pct/100) : 0`).

- [ ] **Step 1: Write the failing parity + behaviour test** — `Osprey/webapp/tests/strength-loads.test.ts`. Import the mobile original directly (it is pure — imports only `./types`).

```ts
import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/strength-loads';
import { intensityZoneForPercent1RM as mZone, INTENSITY_ZONES as mZones } from '../../OSPREY-app/src/services/calculators/powerlifting';

describe('strength-loads parity + loads', () => {
  it('intensityZoneForPercent1RM matches OSPREY-app across the range', () => {
    for (const p of [40, 60, 70, 80, 88, 90, 95, 100]) expect(web.intensityZoneForPercent1RM(p)).toEqual(mZone(p));
    expect(web.INTENSITY_ZONES).toEqual(mZones);
  });
  it('phase percents match OSPREY-app coaching/strength.ts:17 (Base80/Build88/Peak95/Taper90)', () => {
    expect(web.STRENGTH_PHASE_PERCENT).toEqual({ Base: 80, Build: 88, Peak: 95, Taper: 90 });
  });
  it('working loads = round(1RM * pct/100); 0 for a missing lift', () => {
    const r = web.strengthWorkingLoads({ squat: 180, bench: 120, deadlift: null }, 'Peak');
    expect(r.workingPercent1RM).toBe(95);
    expect(r.zoneName).toBe('Peak / Test');
    expect(r.loads).toEqual({ squat: 171, bench: 114, deadlift: 0 });
  });
});
```

- [ ] **Step 2: Run it, verify failure** — `cd Osprey/webapp && npx vitest run tests/strength-loads.test.ts` → FAIL.

- [ ] **Step 3: Implement `strength-loads.ts`** — copy `INTENSITY_ZONES` + `intensityZoneForPercent1RM` verbatim from `Osprey/OSPREY-app/src/services/calculators/powerlifting.ts:22-42`; copy `STRENGTH_PHASE_PERCENT` values from `coaching/strength.ts:17`.

```ts
// INTENSITY_ZONES + intensityZoneForPercent1RM ported from OSPREY-app/src/services/calculators/powerlifting.ts.
// STRENGTH_PHASE_PERCENT copied by value from OSPREY-app/src/services/coaching/strength.ts:17 (private const;
// that file imports @/… so it can't be imported here). Keep in sync; parity: tests/strength-loads.test.ts.
import type { RacePhaseName } from './race-phase';

export interface IntensityZone {
  name: string;
  percent1RMRange: [number, number];
  repRange: [number, number];
  rpeRange: [number, number];
  rirRange: [number, number];
}

export const INTENSITY_ZONES: IntensityZone[] = [
  { name: 'Speed / Dynamic', percent1RMRange: [40, 60], repRange: [1, 3], rpeRange: [0, 0], rirRange: [0, 0] },
  { name: 'Hypertrophy', percent1RMRange: [65, 75], repRange: [6, 12], rpeRange: [6, 8], rirRange: [2, 4] },
  { name: 'Strength-Volume', percent1RMRange: [75, 85], repRange: [3, 6], rpeRange: [7, 8], rirRange: [2, 3] },
  { name: 'Max Strength', percent1RMRange: [85, 92], repRange: [1, 3], rpeRange: [8, 9], rirRange: [1, 2] },
  { name: 'Peak / Test', percent1RMRange: [93, 100], repRange: [1, 1], rpeRange: [9, 10], rirRange: [0, 1] },
];

export function intensityZoneForPercent1RM(percent1RM: number): IntensityZone | null {
  return INTENSITY_ZONES.find((z) => percent1RM >= z.percent1RMRange[0] && percent1RM <= z.percent1RMRange[1]) ?? null;
}

export const STRENGTH_PHASE_PERCENT: Record<RacePhaseName, number> = { Base: 80, Build: 88, Peak: 95, Taper: 90 };

export function strengthWorkingLoads(
  oneRepMaxKg: { squat: number | null; bench: number | null; deadlift: number | null },
  phase: RacePhaseName,
): { workingPercent1RM: number; zoneName: string; loads: { squat: number; bench: number; deadlift: number } } {
  const pct = STRENGTH_PHASE_PERCENT[phase];
  const load = (orm: number | null) => (orm && orm > 0 ? Math.round((orm * pct) / 100) : 0);
  return {
    workingPercent1RM: pct,
    zoneName: intensityZoneForPercent1RM(pct)?.name ?? 'Strength-Volume',
    loads: { squat: load(oneRepMaxKg.squat), bench: load(oneRepMaxKg.bench), deadlift: load(oneRepMaxKg.deadlift) },
  };
}
```

- [ ] **Step 4: Run it, verify pass** — `cd Osprey/webapp && npx vitest run tests/strength-loads.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
cd Osprey/webapp && git add src/lib/strength-loads.ts tests/strength-loads.test.ts
git commit -m "feat(webapp): port strength working-loads (all-sports T3)"
```

---

## Task 4: `crossfit-zones.ts` — crossfit loads, energy systems, benchmark (port + parity)

**Files:**
- Create: `Osprey/webapp/src/lib/crossfit-zones.ts`
- Test: `Osprey/webapp/tests/crossfit-zones.test.ts`

**Interfaces:**
- Consumes: `RacePhaseName` from `race-phase.ts`; `intensityZoneForPercent1RM` from `strength-loads.ts`.
- Produces: `type BenchmarkTier`; `interface EnergySystemZone`; `ENERGY_SYSTEM_ZONES`; `CROSSFIT_BENCHMARKS`; `franTier(sec): BenchmarkTier`; `CROSSFIT_PHASE_PERCENT: Record<RacePhaseName, number>`; `BENCHMARK_BY_PHASE: Record<RacePhaseName, string>`; `crossfitStrengthLoads(oneRepMaxKg: { backSquat: number|null; deadlift: number|null; press: number|null }, phase)` → `{ workingPercent1RM: number; zoneName: string; loads: { backSquat: number; deadlift: number; press: number } }`.

- [ ] **Step 1: Write the failing parity + behaviour test** — import the mobile pure calculator (`calculators/crossfit.ts`, imports nothing external).

```ts
import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/crossfit-zones';
import { ENERGY_SYSTEM_ZONES as mES, CROSSFIT_BENCHMARKS as mB, franTier as mFran } from '../../OSPREY-app/src/services/calculators/crossfit';

describe('crossfit-zones parity + loads', () => {
  it('energy systems, benchmarks, franTier match OSPREY-app', () => {
    expect(web.ENERGY_SYSTEM_ZONES).toEqual(mES);
    expect(web.CROSSFIT_BENCHMARKS).toEqual(mB);
    for (const s of [90, 120, 180, 300, 500]) expect(web.franTier(s)).toBe(mFran(s));
  });
  it('phase percents + benchmark-by-phase match coaching/crossfit.ts:8-10', () => {
    expect(web.CROSSFIT_PHASE_PERCENT).toEqual({ Base: 78, Build: 84, Peak: 88, Taper: 80 });
    expect(web.BENCHMARK_BY_PHASE).toEqual({ Base: 'Fran', Build: 'Fran', Peak: 'Murph', Taper: 'Fran' });
  });
  it('crossfit strength loads = round(1RM*pct/100), 0 for missing', () => {
    const r = web.crossfitStrengthLoads({ backSquat: 140, deadlift: 180, press: null }, 'Build');
    expect(r.workingPercent1RM).toBe(84);
    expect(r.loads).toEqual({ backSquat: 118, deadlift: 151, press: 0 });
  });
});
```

- [ ] **Step 2: Run it, verify failure.**

- [ ] **Step 3: Implement `crossfit-zones.ts`** — copy `EnergySystemZone`, `ENERGY_SYSTEM_ZONES`, `BenchmarkTier`, `CrossfitBenchmark`, `CROSSFIT_BENCHMARKS`, `franTier` verbatim from `Osprey/OSPREY-app/src/services/calculators/crossfit.ts:1-58`; copy `CROSSFIT_PHASE_PERCENT` + `BENCHMARK_BY_PHASE` from `coaching/crossfit.ts:8-10`; `crossfitStrengthLoads` mirrors `buildCrossfitPrescription`'s load logic (`coaching/crossfit.ts:24-31`).

```ts
// Energy systems + benchmarks + franTier ported from OSPREY-app/src/services/calculators/crossfit.ts.
// CROSSFIT_PHASE_PERCENT + BENCHMARK_BY_PHASE copied by value from coaching/crossfit.ts:8-10 (private consts).
// Keep in sync; parity: tests/crossfit-zones.test.ts.
import type { RacePhaseName } from './race-phase';
import { intensityZoneForPercent1RM } from './strength-loads';

export interface EnergySystemZone {
  system: string;
  minDurationSec: number;
  maxDurationSec: number | null;
  workToRest: string;
  purpose: string;
}

export const ENERGY_SYSTEM_ZONES: EnergySystemZone[] = [
  { system: 'Phosphagen / alactic', minDurationSec: 0, maxDurationSec: 15, workToRest: '1:5-1:10', purpose: 'Power, speed' },
  { system: 'Glycolytic / anaerobic', minDurationSec: 15, maxDurationSec: 120, workToRest: '1:1-1:3', purpose: 'Lactate tolerance' },
  { system: 'Aerobic threshold', minDurationSec: 120, maxDurationSec: 600, workToRest: 'Short rest', purpose: 'Sustainable power' },
  { system: 'Aerobic base (Z2)', minDurationSec: 600, maxDurationSec: null, workToRest: 'Continuous', purpose: 'Engine & recovery' },
];

export type BenchmarkTier = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface CrossfitBenchmark {
  name: string;
  movements: string;
  timeDomain: 'short' | 'medium' | 'long';
  scoreType: 'time' | 'rounds';
  normativeByTier: Record<BenchmarkTier, number>;
}

export const CROSSFIT_BENCHMARKS: CrossfitBenchmark[] = [
  { name: 'Fran', movements: '21-15-9 thrusters (43/30 kg) + pull-ups', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 120, advanced: 180, intermediate: 300, beginner: 480 } },
  { name: 'Grace', movements: '30 clean & jerks (60/40 kg) for time', timeDomain: 'short', scoreType: 'time', normativeByTier: { elite: 90, advanced: 150, intermediate: 240, beginner: 420 } },
  { name: 'Helen', movements: '3 RFT: 400m run, 21 KB swings (24/16 kg), 12 pull-ups', timeDomain: 'medium', scoreType: 'time', normativeByTier: { elite: 480, advanced: 600, intermediate: 780, beginner: 1020 } },
  { name: 'Cindy', movements: '20 min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats', timeDomain: 'long', scoreType: 'rounds', normativeByTier: { elite: 30, advanced: 24, intermediate: 18, beginner: 12 } },
  { name: 'Murph', movements: '1mi run, 100 pull-ups, 200 push-ups, 300 squats, 1mi run', timeDomain: 'long', scoreType: 'time', normativeByTier: { elite: 2400, advanced: 2880, intermediate: 3600, beginner: 4800 } },
];

export function franTier(franSec: number): BenchmarkTier {
  const fran = CROSSFIT_BENCHMARKS[0].normativeByTier;
  if (franSec <= fran.elite) return 'elite';
  if (franSec <= fran.advanced) return 'advanced';
  if (franSec <= fran.intermediate) return 'intermediate';
  return 'beginner';
}

export const CROSSFIT_PHASE_PERCENT: Record<RacePhaseName, number> = { Base: 78, Build: 84, Peak: 88, Taper: 80 };
export const BENCHMARK_BY_PHASE: Record<RacePhaseName, string> = { Base: 'Fran', Build: 'Fran', Peak: 'Murph', Taper: 'Fran' };

export function crossfitStrengthLoads(
  oneRepMaxKg: { backSquat: number | null; deadlift: number | null; press: number | null },
  phase: RacePhaseName,
): { workingPercent1RM: number; zoneName: string; loads: { backSquat: number; deadlift: number; press: number } } {
  const pct = CROSSFIT_PHASE_PERCENT[phase];
  const load = (orm: number | null) => (orm && orm > 0 ? Math.round((orm * pct) / 100) : 0);
  return {
    workingPercent1RM: pct,
    zoneName: intensityZoneForPercent1RM(pct)?.name ?? 'Strength-Volume',
    loads: { backSquat: load(oneRepMaxKg.backSquat), deadlift: load(oneRepMaxKg.deadlift), press: load(oneRepMaxKg.press) },
  };
}
```

- [ ] **Step 4: Run it, verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(webapp): port crossfit zones + loads (all-sports T4)"`.

---

## Task 5: `hyrox-loads.ts` — compromised split + station weights (port + parity)

**Files:**
- Create: `Osprey/webapp/src/lib/hyrox-loads.ts`
- Test: `Osprey/webapp/tests/hyrox-loads.test.ts`

**Interfaces:**
- Produces: `type HyroxDivision = 'open_men'|'open_women'|'pro_men'|'pro_women'`; `HYROX_DIVISIONS` (tuple for the picker); `interface Range { min: number; max: number }`; `interface HyroxStationWeights { sledPushKg; sledPullKg; farmersCarryPerHandKg; sandbagLungesKg; wallBallKg }`; `predictCompromisedRunSplit(thresholdSecPerKm): Range`; `hyroxStationWeights(division): HyroxStationWeights`; `MILES_PER_KM = 0.621371`; `compromisedSplitFromThresholdMile(thresholdSecPerMile): Range` (converts sec/mi → sec/km via `Math.round(t*MILES_PER_KM)` then `predictCompromisedRunSplit`, mirroring `coaching/hyrox.ts:25-31`).

- [ ] **Step 1: Write the failing parity test** — import mobile `calculators/hyrox.ts` (pure — imports only `./types`).

```ts
import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/hyrox-loads';
import { predictCompromisedRunSplit as mSplit, hyroxStationWeights as mW } from '../../OSPREY-app/src/services/calculators/hyrox';

describe('hyrox-loads parity', () => {
  it('compromised split matches OSPREY-app', () => {
    for (const t of [200, 240, 300]) expect(web.predictCompromisedRunSplit(t)).toEqual(mSplit(t));
  });
  it('station weights match OSPREY-app for all divisions', () => {
    for (const d of web.HYROX_DIVISIONS) expect(web.hyroxStationWeights(d)).toEqual(mW(d));
  });
  it('threshold sec/mile → compromised sec/km', () => {
    expect(web.compromisedSplitFromThresholdMile(450)).toEqual(mSplit(Math.round(450 * 0.621371)));
  });
});
```

- [ ] **Step 2: Run it, verify failure.**

- [ ] **Step 3: Implement `hyrox-loads.ts`** — copy `HyroxDivision`, `HyroxStationWeights`, `HYROX_STATION_WEIGHTS`, `hyroxStationWeights`, `predictCompromisedRunSplit` verbatim from `Osprey/OSPREY-app/src/services/calculators/hyrox.ts:23-47`; add the sec/mi→sec/km wrapper from `coaching/hyrox.ts:25-31`.

```ts
// Ported from OSPREY-app/src/services/calculators/hyrox.ts + coaching/hyrox.ts (compromised-split wrapper).
// Keep in sync; parity: tests/hyrox-loads.test.ts.
export interface Range { min: number; max: number }
export type HyroxDivision = 'open_men' | 'open_women' | 'pro_men' | 'pro_women';
export const HYROX_DIVISIONS: readonly HyroxDivision[] = ['open_men', 'open_women', 'pro_men', 'pro_women'];
export const MILES_PER_KM = 0.621371;

export interface HyroxStationWeights {
  sledPushKg: number;
  sledPullKg: number;
  farmersCarryPerHandKg: number;
  sandbagLungesKg: number;
  wallBallKg: number;
}

const HYROX_STATION_WEIGHTS: Record<HyroxDivision, HyroxStationWeights> = {
  open_men: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
  open_women: { sledPushKg: 102, sledPullKg: 78, farmersCarryPerHandKg: 16, sandbagLungesKg: 10, wallBallKg: 4 },
  pro_men: { sledPushKg: 202, sledPullKg: 153, farmersCarryPerHandKg: 32, sandbagLungesKg: 30, wallBallKg: 9 },
  pro_women: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
};

export function hyroxStationWeights(division: HyroxDivision): HyroxStationWeights {
  return HYROX_STATION_WEIGHTS[division];
}

export function predictCompromisedRunSplit(thresholdSecPerKm: number): Range {
  return { min: thresholdSecPerKm + 15, max: thresholdSecPerKm + 30 };
}

export function compromisedSplitFromThresholdMile(thresholdSecPerMile: number): Range {
  return predictCompromisedRunSplit(Math.round(thresholdSecPerMile * MILES_PER_KM));
}
```

- [ ] **Step 4: Run it, verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(webapp): port hyrox loads (all-sports T5)"`.

---

## Task 6: `goal-params.ts` — per-sport schemas + merge-preserving helper

**Files:**
- Create: `Osprey/webapp/src/lib/goal-params.ts`
- Test: `Osprey/webapp/tests/goal-params.test.ts`

**Interfaces:**
- Consumes: `HyroxDivision`, `HYROX_DIVISIONS` from `hyrox-loads.ts`.
- Produces: readers `parseLiftParams/parseCrossfitParams/parseHyroxParams(raw)` (JSONB → safe, mirroring the mobile `to*Params`); `mergeGoalParams(raw: unknown, patch: Record<string, unknown>): Record<string, unknown>` (deep-merges `oneRepMaxKg` one level; shallow-merges the rest; preserves all sibling keys); validators `validKg(n): boolean` (0<n≤600), `validFranSec(n): boolean` (0<n≤3600).

- [ ] **Step 1: Write the failing test** — the critical case is merge-preserves-siblings.

```ts
import { describe, it, expect } from 'vitest';
import { parseCrossfitParams, mergeGoalParams, validKg, validFranSec } from '../src/lib/goal-params';

describe('goal-params', () => {
  it('parseCrossfitParams keeps valid, drops out-of-range', () => {
    const p = parseCrossfitParams({ oneRepMaxKg: { backSquat: 140, deadlift: 999, press: null }, competing: true, franSec: 252 });
    expect(p).toEqual({ oneRepMaxKg: { backSquat: 140, deadlift: null, press: null }, competing: true, franSec: 252 });
  });
  it('mergeGoalParams preserves sibling keys the mobile app owns', () => {
    const current = { oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 70 }, competing: true, franSec: 252 };
    const merged = mergeGoalParams(current, { oneRepMaxKg: { backSquat: 145 } });
    expect(merged).toEqual({ oneRepMaxKg: { backSquat: 145, deadlift: 180, press: 70 }, competing: true, franSec: 252 });
  });
  it('validators enforce bounds', () => {
    expect(validKg(140)).toBe(true); expect(validKg(0)).toBe(false); expect(validKg(601)).toBe(false);
    expect(validFranSec(252)).toBe(true); expect(validFranSec(3601)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify failure.**

- [ ] **Step 3: Implement `goal-params.ts`** — mirror the mobile bounds (`crossfit-params.ts:11-23`, `strength-params.ts:18`, `hyrox-params.ts:11-21`). `mergeGoalParams` deep-merges the nested `oneRepMaxKg` object so a single-lift edit preserves the other lifts, and preserves every other key.

```ts
import { HYROX_DIVISIONS } from './hyrox-loads';

export const validKg = (n: number): boolean => Number.isFinite(n) && n > 0 && n <= 600;
export const validFranSec = (n: number): boolean => Number.isFinite(n) && n > 0 && n <= 3600;

const norm = (o: Record<string, number | null | undefined>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' && validKg(v) ? Math.round(v) : null]));

export function parseLiftParams(raw: unknown) {
  const p = (raw ?? {}) as { oneRepMaxKg?: Record<string, number | null> };
  return { oneRepMaxKg: { squat: null, bench: null, deadlift: null, ...norm(p.oneRepMaxKg ?? {}) } };
}
export function parseCrossfitParams(raw: unknown) {
  const p = (raw ?? {}) as { oneRepMaxKg?: Record<string, number | null>; competing?: boolean; franSec?: number | null };
  const fran = typeof p.franSec === 'number' && validFranSec(p.franSec) ? Math.round(p.franSec) : null;
  return { oneRepMaxKg: { backSquat: null, deadlift: null, press: null, ...norm(p.oneRepMaxKg ?? {}) }, competing: p.competing === true, franSec: fran };
}
export function parseHyroxParams(raw: unknown) {
  const p = (raw ?? {}) as { division?: string; targetTimeMinutes?: number | null };
  const division = (HYROX_DIVISIONS as readonly string[]).includes(p.division ?? '') ? p.division! : null;
  const t = typeof p.targetTimeMinutes === 'number' && p.targetTimeMinutes > 0 && p.targetTimeMinutes <= 300 ? Math.round(p.targetTimeMinutes) : null;
  return { division, targetTimeMinutes: t };
}

// Merge one edited field into the stored JSONB, preserving every sibling key (and every
// sibling lift inside oneRepMaxKg) the mobile app owns.
export function mergeGoalParams(raw: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const current = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current, ...patch };
  if (patch.oneRepMaxKg && typeof patch.oneRepMaxKg === 'object') {
    next.oneRepMaxKg = { ...(current.oneRepMaxKg as object ?? {}), ...(patch.oneRepMaxKg as object) };
  }
  return next;
}
```

- [ ] **Step 4: Run it, verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(webapp): goal_params schemas + merge-preserving helper (all-sports T6)"`.

---

## Task 7: `useUpdateGoalParams` merge-write

**Files:**
- Modify: `Osprey/webapp/src/features/settings/queries.ts`
- Test: `Osprey/webapp/tests/goal-params.test.ts` (extend — pure merge already covered; this task adds the hook, verified by typecheck + the T8 preview).

**Interfaces:**
- Consumes: `mergeGoalParams` from `goal-params.ts`; `useUserGoal` from T1.
- Produces: `useUpdateGoalParams(userId)` — a mutation taking `patch: Record<string, unknown>`, reading the current `goal_params`, merging via `mergeGoalParams`, `UPDATE user_goals ... .select('user_id')`, throwing the missing-row error, and returning the `['user-goal', userId]` invalidation (not `void`) — mirroring `useUpdateThresholdAnchor` at `queries.ts:61-79`.

- [ ] **Step 1: Add the mutation** (mechanical; mirrors the existing threshold-anchor mutation). Append to `queries.ts`:

```ts
import { mergeGoalParams } from '../../lib/goal-params';

export function useUpdateGoalParams(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { data: cur, error: readErr } = await supabase
        .from('user_goals').select('goal_params').eq('user_id', userId).maybeSingle();
      if (readErr) throw readErr;
      const next = mergeGoalParams(cur?.goal_params, patch);
      const { data, error } = await supabase
        .from('user_goals').update({ goal_params: next }).eq('user_id', userId).select('user_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Could not save — no goals record found for your account.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-goal', userId] }),
  });
}
```

- [ ] **Step 2: Typecheck** — `cd Osprey/webapp && npm run typecheck` → clean.
- [ ] **Step 3: Commit** — `git commit -m "feat(webapp): useUpdateGoalParams merge-write (all-sports T7)"`.

---

## Task 8: `StrengthZones` card section

**Files:**
- Create: `Osprey/webapp/src/features/settings/StrengthZones.tsx`
- Modify: `Osprey/webapp/src/features/settings/TrainingZonesCard.tsx`

**Interfaces:**
- Consumes: `useUserGoal`, `useUpdateGoalParams` (queries.ts); `useUnits` (queries.ts:6); `formatWeightKg`, `parseWeightInput` (`src/lib/units.ts`); `phaseOrBase` (race-phase.ts); `strengthWorkingLoads` (strength-loads.ts); `crossfitStrengthLoads`, `ENERGY_SYSTEM_ZONES`, `BENCHMARK_BY_PHASE`, `franTier` (crossfit-zones.ts); `hyroxStationWeights`, `compromisedSplitFromThresholdMile`, `HYROX_DIVISIONS` (hyrox-loads.ts); `parseLiftParams/parseCrossfitParams/parseHyroxParams` (goal-params.ts).
- Produces: `<StrengthZones userId={userId} />` — renders nothing unless `primaryGoal ∈ {lift, crossfit, hyrox}`.

**Behaviour (spec §4):**
- Resolve phase: `const phase = phaseOrBase({ targetRace, targetDate, totalWeeksPlanned })`; when `computeRacePhase` is null show the label `Base — general prep`.
- **lift:** three editable 1RM fields (squat/bench/deadlift) via `parseWeightInput`/`formatWeightKg`; on save call `useUpdateGoalParams.mutate({ oneRepMaxKg: { squat } })` (one lift at a time, so the merge preserves the others); show `strengthWorkingLoads(oneRepMaxKg, phase)` — per-lift working kg + `workingPercent1RM` + `zoneName`; plus a 70/80/90% ladder (`Math.round(orm*p/100)`).
- **crossfit:** editable backSquat/deadlift/press + Fran (mm:ss → `franSec`; store via `{ franSec }`) + competing toggle (`{ competing }`); show `crossfitStrengthLoads`, the `ENERGY_SYSTEM_ZONES` table, and `BENCHMARK_BY_PHASE[phase]` + `franTier(franSec)` when `franSec != null`.
- **hyrox:** a division `<select>` over `HYROX_DIVISIONS` (`{ division }`); show `compromisedSplitFromThresholdMile(thresholdAnchor.run.thresholdSecPerMile)` when the run anchor is set (else prompt to set the Run anchor above) and `hyroxStationWeights(division)`.
- Empty state when no params yet: the `TrainingZonesCard.tsx:78` copy pattern.
- Reuse existing classes (`.settings-row`, `.btn`, `.err-line`, `card` sub-structure) — no new CSS needed beyond what `app.css` provides.

- [ ] **Step 1: Build `StrengthZones.tsx`** implementing the behaviour above. Gate at the top: `if (!goal.data || !['lift','crossfit','hyrox'].includes(goal.data.primaryGoal ?? '')) return null;`. Use `parse*Params(goal.data.goalParams)` to seed inputs.
- [ ] **Step 2: Wire into `TrainingZonesCard.tsx`** — after the `ROWS.map(...)` block (line 34) add `<StrengthZones userId={userId} />`. The endurance `ROWS` and their rendering stay untouched.
- [ ] **Step 3: Typecheck + build** — `cd Osprey/webapp && npm run typecheck && npm run build` → both clean.
- [ ] **Step 4: Preview smoke** (per the preview workflow) — `preview_start` the webapp, load `/settings`; confirm no console errors and the card renders. (Full logged-in data needs the user's session — note in the report; the endurance rows rendering unchanged is the regression signal.)
- [ ] **Step 5: Commit** — `git commit -m "feat(webapp): editable strength/hybrid zones card section (all-sports T8)"`.

---

## Task 9: Calendar sport-awareness — gate predictor + phase chip

**Files:**
- Modify: `Osprey/webapp/src/routes/_authed/calendar.tsx`

**Interfaces:**
- Consumes: `useUserGoal` (T1); `computeRacePhase` (race-phase.ts).

- [ ] **Step 1: Read the goal in `CalendarPage`** — add `const userGoal = useUserGoal(userId);` beside the other hooks (line ~53). Derive: `const isRunGoal = ['run','ultra','triathlon'].includes(userGoal.data?.primaryGoal ?? '');` and `const phaseInfo = userGoal.data ? computeRacePhase({ targetRace: userGoal.data.targetRace, targetDate: userGoal.data.targetDate, totalWeeksPlanned: userGoal.data.totalWeeksPlanned }) : null;`.

  Note: `triathlon` is not in the current `PrimaryGoal` union; the `.includes` list is a display gate, so keep the string literal — it is harmless if the value never occurs and future-proofs the gate.

- [ ] **Step 2: Gate the Race Predictor** — wrap the predictor block (`calendar.tsx:144-162`, both the `predictor ?` card and the `bestRun.isSuccess` empty-state) in `{isRunGoal && ( … )}`. A powerlifter/crossfitter no longer sees the run predictor or its "Log a completed run…" prompt.

- [ ] **Step 3: Add the phase chip** — above the predictor in the aside, render when `phaseInfo` is non-null:

```tsx
{phaseInfo && (
  <div className="detail-card">
    <div className="tag">Training phase</div>
    <h3>{phaseInfo.phase}</h3>
    <p>Week {phaseInfo.currentWeekNumber} of {phaseInfo.totalWeeks} · {phaseInfo.weeksRemaining} to go</p>
  </div>
)}
```

- [ ] **Step 4: Typecheck + build + preview** — `cd Osprey/webapp && npm run typecheck && npm run build`; preview `/calendar`, confirm no console errors, tiles/detail pane unchanged.
- [ ] **Step 5: Full suite + commit**

```bash
cd Osprey/webapp && npm test   # expect all green (91 existing + new parity/unit tests)
git add src/routes/_authed/calendar.tsx
git commit -m "feat(webapp): sport-aware calendar — gate run predictor + phase chip (all-sports T9)"
```

---

## Final verification (before finishing the branch)

- [ ] `cd Osprey/webapp && npm test` — all green (91 existing untouched + the new parity/unit tests).
- [ ] `cd Osprey/webapp && npm run typecheck` — clean.
- [ ] `cd Osprey/webapp && npm run build` — clean.
- [ ] Manual spot-check the parity tests actually import the mobile originals (grep for `../../OSPREY-app/src/services/calculators` in `tests/`).

## Notes / deferred

- The optional "export the phase-percent consts from OSPREY-app" idea is **dropped**: those consts live in `coaching/*.ts` which import `@/…`, so the webapp vitest cannot import them regardless of visibility — the value-pin + `file:line` citation is the correct mechanism.
- `triathlon` is referenced only as a display-gate string; it is not yet a `PrimaryGoal`. No functional dependency.
- Device/live-data smoke of the strength card (logged-in, real `goal_params`) is a manual post-merge step — the auth wall blocks automated logged-in verification.
