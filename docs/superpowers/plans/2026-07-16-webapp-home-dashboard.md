# Webapp Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the webapp's `/`→`/calendar` redirect with a real "at a glance" home: today hero, analyst stat band, this-week strip, next race, today's fuel.

**Architecture:** Webapp-only. Two pure model helpers + two small read hooks + a `DashboardPage` that composes them with the existing calendar/nutrition hooks. It assembles data — computes nothing new. No migration, no edge change.

**Tech Stack:** React 18, TanStack Router/Query, `@supabase/supabase-js`, Zod, Vitest (`TZ=America/New_York`).

## Global Constraints

- **Webapp-only — no migration, no edge change.** `v_daily_summary` (a view) and `ozzie_insights` already grant `SELECT` to `authenticated` (verified); RLS is self-scoped/`security_invoker`.
- **Show-if-present.** Recovery, form (TSB), and the daily brief are phone-synced → each renders only when non-null; the stat band is omitted entirely if all its values are null. Plan/race/fuel data is always present.
- **Reuse, don't rebuild.** Use `sameWeekDates` (`webapp/src/lib/session-edit.ts`), `day.ts`/`format.ts` helpers, and the existing hooks (`useMonthSessions`/`useCompletions` scoped to this week, `useNextRaceEvent`, `useBestRun`+`buildRacePredictor`, `computeRacePhase`, `useUserGoal`, `useDayLog`+`sumDay`+`useNutritionTargets`, `useUnits`). Reuse `app.css` classes — **no new CSS**.
- **One card erroring never blanks the page** — each card owns its loading/error locally.
- **Existing 116 webapp tests stay green.** Commands: `cd Osprey/webapp && npm test` · `npm run typecheck` · `npm run build`.

---

## File Structure

| File | Responsibility |
|---|---|
| `webapp/src/features/home/model.ts` (new) | Pure: `pickTodaySession`, `buildWeekStrip` + `WeekDay`. |
| `webapp/src/features/home/queries.ts` (new) | `useDailySummary` (v_daily_summary), `useTodayBrief` (ozzie_insights). |
| `webapp/src/routes/_authed/index.tsx` (replace) | `DashboardPage` composing the cards. |
| `webapp/tests/home-model.test.ts` (new) | The two pure helpers. |

---

## Task 1: `home/model.ts` — pure helpers (TDD)

**Files:**
- Create: `Osprey/webapp/src/features/home/model.ts`
- Test: `Osprey/webapp/tests/home-model.test.ts`

**Interfaces:**
- Consumes: `sameWeekDates` from `Osprey/webapp/src/lib/session-edit.ts`; `TrainingSession` from `Osprey/webapp/src/lib/schemas.ts`.
- Produces: `pickTodaySession(weekSessions: TrainingSession[], todayISO: string): TrainingSession | null`; `interface WeekDay { dateISO: string; session: TrainingSession | null; done: boolean; isToday: boolean }`; `buildWeekStrip(weekSessions: TrainingSession[], completedSessionIds: Set<string>, todayISO: string): WeekDay[]`.

- [ ] **Step 1: Write the failing test** — `Osprey/webapp/tests/home-model.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { pickTodaySession, buildWeekStrip } from '../src/features/home/model';
import type { TrainingSession } from '../src/lib/schemas';

const S = (over: Partial<TrainingSession>): TrainingSession => ({
  id: 'i', week_id: 'w', user_id: 'u', session_date: '2026-07-14', session_type: 'run',
  intensity: 'easy', planned_minutes: 40, planned_distance_km: 8, description: null,
  ozzie_notes: null, created_at: '', updated_at: '', ...over,
});

describe('pickTodaySession', () => {
  it('returns the session dated today, else null', () => {
    const week = [S({ id: 'a', session_date: '2026-07-13' }), S({ id: 'b', session_date: '2026-07-14' })];
    expect(pickTodaySession(week, '2026-07-14')?.id).toBe('b');
    expect(pickTodaySession(week, '2026-07-16')).toBeNull();
  });
});

describe('buildWeekStrip', () => {
  it('returns 7 Mon-Sun days with the right session, done flag, and today marker', () => {
    const week = [S({ id: 'mon', session_date: '2026-07-13' }), S({ id: 'tue', session_date: '2026-07-14' })];
    const done = new Set(['mon']);
    const strip = buildWeekStrip(week, done, '2026-07-14');
    expect(strip.map((d) => d.dateISO)).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19',
    ]);
    expect(strip[0]).toMatchObject({ session: expect.objectContaining({ id: 'mon' }), done: true, isToday: false });
    expect(strip[1]).toMatchObject({ done: false, isToday: true });
    expect(strip[2]).toMatchObject({ session: null, done: false, isToday: false }); // empty day
  });
});
```

- [ ] **Step 2: Run it, verify failure** — `cd Osprey/webapp && npx vitest run tests/home-model.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `home/model.ts`**

```ts
import { sameWeekDates } from '../../lib/session-edit';
import type { TrainingSession } from '../../lib/schemas';

export function pickTodaySession(weekSessions: TrainingSession[], todayISO: string): TrainingSession | null {
  return weekSessions.find((s) => s.session_date === todayISO) ?? null;
}

export interface WeekDay {
  dateISO: string;
  session: TrainingSession | null;
  done: boolean;
  isToday: boolean;
}

export function buildWeekStrip(
  weekSessions: TrainingSession[],
  completedSessionIds: Set<string>,
  todayISO: string,
): WeekDay[] {
  return sameWeekDates(todayISO).map((dateISO) => {
    const session = weekSessions.find((s) => s.session_date === dateISO) ?? null;
    return { dateISO, session, done: session ? completedSessionIds.has(session.id) : false, isToday: dateISO === todayISO };
  });
}
```

- [ ] **Step 4: Run it, verify pass** — `cd Osprey/webapp && npx vitest run tests/home-model.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/features/home/model.ts tests/home-model.test.ts && git commit -m "feat(webapp): home dashboard model helpers (home-dashboard T1)"`

---

## Task 2: `home/queries.ts` — the two new read hooks

**Files:**
- Create: `Osprey/webapp/src/features/home/queries.ts`

**Interfaces:**
- Consumes: `toDateInputValue`, `localDayRange` from `Osprey/webapp/src/lib/day.ts`.
- Produces: `useDailySummary(userId)` → React-Query hook resolving `DailySummary | null` where `interface DailySummary { recoveryScore: number|null; recoveryRecommendation: string|null; tsb: number|null; weekDistanceKm: number|null; workoutsLast30d: number|null }`; `useTodayBrief(userId)` → hook resolving `string | null` (today's daily-brief text).

- [ ] **Step 1: Implement `home/queries.ts`** — the two hooks. Every `v_daily_summary` field is nullable (the view LEFT-JOINs recovery/load).

```ts
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { toDateInputValue, localDayRange } from '../../lib/day';

const DailySummaryRow = z.object({
  recovery_score: z.coerce.number().nullable(),
  recovery_recommendation: z.string().nullable(),
  tsb: z.coerce.number().nullable(),
  week_distance_km: z.coerce.number().nullable(),
  workouts_last_30d: z.coerce.number().nullable(),
});

export interface DailySummary {
  recoveryScore: number | null;
  recoveryRecommendation: string | null;
  tsb: number | null;
  weekDistanceKm: number | null;
  workoutsLast30d: number | null;
}

export function useDailySummary(userId: string) {
  return useQuery({
    queryKey: ['daily-summary', userId],
    queryFn: async (): Promise<DailySummary | null> => {
      const { data, error } = await supabase
        .from('v_daily_summary')
        .select('recovery_score, recovery_recommendation, tsb, week_distance_km, workouts_last_30d')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const p = DailySummaryRow.parse(data);
      return {
        recoveryScore: p.recovery_score,
        recoveryRecommendation: p.recovery_recommendation,
        tsb: p.tsb,
        weekDistanceKm: p.week_distance_km,
        workoutsLast30d: p.workouts_last_30d,
      };
    },
  });
}

export function useTodayBrief(userId: string) {
  return useQuery({
    queryKey: ['today-brief', userId],
    queryFn: async (): Promise<string | null> => {
      const { start } = localDayRange(toDateInputValue(new Date()));
      const { data, error } = await supabase
        .from('ozzie_insights')
        .select('response_text')
        .eq('user_id', userId)
        .eq('insight_type', 'daily_brief')
        .gte('created_at', start)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.response_text as string | undefined) ?? null;
    },
  });
}
```

- [ ] **Step 2: Typecheck** — `cd Osprey/webapp && npm run typecheck` → clean.
- [ ] **Step 3: Full suite** — `cd Osprey/webapp && npm test` → 116 still green (additive; no existing read changed).
- [ ] **Step 4: Commit** — `git commit -m "feat(webapp): useDailySummary + useTodayBrief read hooks (home-dashboard T2)"`

---

## Task 3: `DashboardPage` + Today hero, Stat band, Week strip

**Files:**
- Modify (replace): `Osprey/webapp/src/routes/_authed/index.tsx`

**Interfaces:**
- Consumes: `pickTodaySession`, `buildWeekStrip` (T1); `useDailySummary`, `useTodayBrief` (T2); `useMonthSessions`, `useCompletions` (`Osprey/webapp/src/features/calendar/queries.ts` — signatures `(userId, fromISO, toISO)`; `useCompletions` resolves `Set<string>`); `sameWeekDates` (`lib/session-edit.ts`); `PageHeader` (`components/PageHeader.tsx`, props `{ eyebrow, title }`); `SESSION_TYPE_LABEL`, `INTENSITY_LABEL`, `formatMinutes`, `formatDistanceKm`, `formatDateShort` (`lib/format.ts`); `useUnits` (`features/settings/queries.ts`); `Link` from `@tanstack/react-router`.

**Structure & behaviour:**
- Route: `export const Route = createFileRoute('/_authed/')({ component: DashboardPage })`; `const { userId } = Route.useRouteContext()`.
- Compute once: `const todayISO = toDateInputValue(new Date())` (from `lib/day.ts`); `const week = sameWeekDates(todayISO)`; `const mondayISO = week[0], sundayISO = week[6]`.
- Fetch this week ONCE (serves hero + strip): `const sessions = useMonthSessions(userId, mondayISO, sundayISO); const completions = useCompletions(userId, mondayISO, sundayISO);`. `const weekSessions = sessions.data ?? []; const completedIds = completions.data ?? new Set<string>();`
- Header: `<PageHeader eyebrow="Dashboard" title={new Date(\`${todayISO}T00:00:00\`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} />`.
- Render `<TodayHero>`, `<StatBand>`, `<WeekStrip>` (this task), then (Task 4) `<NextRaceCard>` + `<FuelCard>`.

**`<TodayHero>`** — `const todaySession = pickTodaySession(weekSessions, todayISO); const brief = useTodayBrief(userId);`. If `todaySession`: a `.detail-card` showing `SESSION_TYPE_LABEL[session_type]` + `INTENSITY_LABEL[intensity]` badge + `formatMinutes(planned_minutes)` + `formatDistanceKm(planned_distance_km, 'metric')` + `description`, and its `ozzie_notes` in an `.ozzie-note` block. If `brief.data` present, append it in a second `.ozzie-note` block (tag "Ozzie"). If no `todaySession`: a `.detail-card` "Rest day — nothing scheduled." Follow the read-only detail-pane markup in `routes/_authed/calendar.tsx:164-201`.

**`<StatBand>`** — `const ds = useDailySummary(userId);`. Build the tile list, pushing only non-null values:

```tsx
const s = ds.data;
if (!s) return null;
const tiles: { num: string; lab: string; sub?: string | null }[] = [];
if (s.recoveryScore != null) tiles.push({ num: String(s.recoveryScore), lab: 'Recovery', sub: s.recoveryRecommendation });
if (s.tsb != null) tiles.push({ num: (s.tsb > 0 ? '+' : '') + s.tsb, lab: 'Form (TSB)' });
if (s.weekDistanceKm != null) tiles.push({ num: `${Math.round(s.weekDistanceKm)} km`, lab: 'This week' });
if (s.workoutsLast30d != null) tiles.push({ num: String(s.workoutsLast30d), lab: 'Last 30 days' });
if (tiles.length === 0) return null;
// render tiles in a `.stat-band` (each: `.stat` > `.num` + `.lab` + optional `.lab` sub) — see app.css `.stat-band`.
```

**`<WeekStrip>`** — `const strip = buildWeekStrip(weekSessions, completedIds, todayISO);`. Render a **7-column horizontal strip** matching the approved mockup: a container with inline `style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}` (inline styles are fine — the codebase uses them widely, e.g. `calendar.tsx`; "no new CSS" means no new `app.css` rules, not "no inline styles"). Per `WeekDay`: a weekday label (`new Date(\`${dateISO}T00:00:00\`).toLocaleDateString('en-US', { weekday: 'short' })`), the session's `SESSION_TYPE_LABEL[session_type]` (or "Rest"/blank), a ✓ when `done`, and a highlight (e.g. a muted-amber cell background) when `isToday`. Reuse existing text/`.badge` classes for the chips. Above it, a header line with `<Link to="/calendar">Open calendar ›</Link>`.

- [ ] **Step 1: Replace `index.tsx`** with `DashboardPage` + the three sub-components above (colocated in the file or under `features/home/`), following the cited existing markup/classes.
- [ ] **Step 2: Typecheck + build** — `cd Osprey/webapp && npm run typecheck && npm run build` → clean.
- [ ] **Step 3: Full suite** — `npm test` → 116 green (the model tests + existing).
- [ ] **Step 4: Commit** — `git commit -m "feat(webapp): dashboard page + today hero/stat band/week strip (home-dashboard T3)"`

---

## Task 4: Next-race card + Fuel card

**Files:**
- Modify: `Osprey/webapp/src/routes/_authed/index.tsx` (add the two cards to `DashboardPage`).

**Interfaces:**
- Consumes: `useNextRaceEvent`, `useBestRun` (`features/calendar/queries.ts`); `buildRacePredictor`, `formatRaceTimeSec` (`lib/predictions.ts` — `buildRacePredictor(bestRunMiles, bestRunTimeS): RacePredictor | null` where `RacePredictor { baseMiles; basePaceSecPerMile; predictions: { label; distanceMiles; predictedTimeS }[] }`); `computeRacePhase` (`lib/race-phase.ts`) + `useUserGoal` (`features/settings/queries.ts`); `useDayLog`, `sumDay`, `useNutritionTargets` (`features/nutrition/queries.ts` — `useDayLog(userId, dateStr): DayLogEntry[]`, `sumDay(entries): { calories; proteinG; carbsG; fatG }`, `useNutritionTargets(userId): NutritionTargets | null` with `{ calories, protein_g, carbs_g, fat_g }`); `ErrorPanel` (`components/ErrorPanel.tsx`).

**`<NextRaceCard>`** — mirror the calendar's aside (`routes/_authed/calendar.tsx:131-162`): `const nextRace = useNextRaceEvent(userId); const bestRun = useBestRun(userId); const predictor = bestRun.data ? buildRacePredictor(bestRun.data.miles, bestRun.data.timeS) : null; const phase = computeRacePhase({ targetRace: goal.targetRace, targetDate: goal.targetDate, totalWeeksPlanned: goal.totalWeeksPlanned })` (from `useUserGoal`). Render a `.race-countdown` (T-minus days to `nextRace.data.event_date`, name, date, goal via `formatRaceTimeSec(goal_time_s)`) + a compact predictor line (e.g., the `predictions.find(p => p.label === 'Marathon')` time, or the full `.predictor-table`) + the phase (`phase.phase` · week N/total). **Omit the whole card** when `nextRace.data` is null AND `phase` is null.

**`<FuelCard>`** — `const day = useDayLog(userId, todayISO); const targets = useNutritionTargets(userId); const eaten = sumDay(day.data ?? []);`. Render a `.fuel-band`/`.detail-card`: calories `eaten.calories` / `targets.data?.calories` and macro bars (protein/carbs/fat: `eaten.proteinG`/`targets.data?.protein_g`, etc.) using the `.macro`/`.track`/`.fill` idioms (percent = `Math.min(100, Math.round(eaten.X / target.X * 100))`, guarding divide-by-zero/null). A `<Link to="/nutrition">`. **Omit** when `targets.data` is null (no targets set).

**Each card owns loading/error:** show the `ErrorPanel` (or a muted "Couldn't load" line) on that card's `.error`; a single card's error must not blank the page.

- [ ] **Step 1: Add `<NextRaceCard>` + `<FuelCard>`** to `DashboardPage`, following the cited calendar markup + the `.fuel-band`/`.macro` idioms.
- [ ] **Step 2: Typecheck + build** — `cd Osprey/webapp && npm run typecheck && npm run build` → clean.
- [ ] **Step 3: Preview smoke** — `preview_start` the webapp, open `/`; confirm no console errors and the cards render; verify the stat band collapses cleanly when its data is absent. (Logged-in data needs the user's session — controller drives it.)
- [ ] **Step 4: Full suite + commit** — `npm test` (116 green) → `git commit -m "feat(webapp): dashboard next-race + fuel cards (home-dashboard T4)"`

---

## Final verification

- [ ] `cd Osprey/webapp && npm test` — all green (116 existing + the new home-model tests).
- [ ] `npm run typecheck` and `npm run build` — clean.
- [ ] The diff touches only `webapp/` — no migration/edge file.

## Notes / deferred

The analyst-first fitness-ramp trend (a `load_scores` history query + chart); TTS/audio of the brief; marking the brief `read_at`; a "log a workout" quick-action; distance-unit conversion in the stat band (km, matching the calendar).
