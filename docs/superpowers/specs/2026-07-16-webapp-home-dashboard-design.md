# Webapp Home Dashboard — the analyst landing — Design

**Date:** 2026-07-16
**Status:** Approved (design) — ready for implementation plan
**Origin:** Next slice of the "make the webapp a real product" program (all-sports coverage + plan editing shipped, main `3144fb8`). Today `webapp/src/routes/_authed/index.tsx` just `throw redirect({ to: '/calendar' })`; this replaces it with a real "at a glance" home. **Layout: today-first stacked** (user's choice among three mockups).

The dashboard **assembles existing data** — it computes nothing new. It reuses the calendar/nutrition/settings hooks and adds two small read hooks for data the phone already produces (`v_daily_summary`, `ozzie_insights`).

---

## Global Constraints

- **Webapp-only — no migration, no edge change.** `v_daily_summary` (a view) grants `SELECT` to `authenticated` with `security_invoker` RLS (`20260628000002`); `ozzie_insights` grants `SELECT` with a self-scoped RLS policy. Everything else is already-read tables. Verified against the migrations.
- **Show-if-present.** Recovery, form (TSB), and the daily brief come from the phone's health sync / on-device generation, so they are opportunistic — each renders only when its value is non-null. The plan / this-week / race / fuel data is always present. A brand-new user with no sync still gets a useful home.
- **Reuse, don't rebuild.** Use the existing hooks (`useMonthSessions`/`useCompletions` scoped to this week, `useNextRaceEvent`, `useBestRun` + `buildRacePredictor`, `computeRacePhase`, `useUserGoal`, `useDayLog`, `useNutritionTargets`, `useUnits`) and the existing `app.css` classes. Reuse `sameWeekDates` from `webapp/src/lib/session-edit.ts`.
- **Existing 116 webapp tests stay green.** Commands: `cd webapp && npm test` (vitest, `TZ=America/New_York`); `npm run typecheck`; `npm run build`.
- **TDD** for the pure model (§2). The hooks + page are typecheck + build + preview.

---

## 1. Data sources

| Card | Source | New or reused |
|---|---|---|
| Today hero — session | this week's `training_sessions` (see below), picked for today | reused `useMonthSessions(userId, mondayISO, sundayISO)` |
| Today hero — brief | `ozzie_insights` (`insight_type='daily_brief'`, `created_at` ≥ today) `.response_text` | **new** `useTodayBrief` |
| Stat band | `v_daily_summary` (`recovery_score`, `recovery_recommendation`, `tsb`, `week_distance_km`, `workouts_last_30d`) | **new** `useDailySummary` |
| This-week strip | same week sessions + `workout_logs` completions | reused `useMonthSessions`/`useCompletions` (scoped Mon–Sun) |
| Next race + phase | `useNextRaceEvent` + `useBestRun`→`buildRacePredictor` + `computeRacePhase(useUserGoal)` | reused |
| Today's fuel | `useDayLog(userId, todayISO)` + `useNutritionTargets` | reused |

One `useMonthSessions(userId, mondayISO, sundayISO)` call (this week's Mon–Sun via `sameWeekDates(todayISO)`) serves BOTH the today-hero session and the week strip — no duplicate fetch. `todayISO` = `toDateInputValue(new Date())` (local; from `webapp/src/lib/day.ts`).

**New hooks (in `webapp/src/features/home/queries.ts`):**
- `useDailySummary(userId)` → reads `v_daily_summary` for the user (`.eq('user_id', userId).maybeSingle()`), Zod-parsed into `{ recoveryScore: number|null; recoveryRecommendation: string|null; tsb: number|null; weekDistanceKm: number|null; workoutsLast30d: number|null }` (all nullable — the view LEFT-JOINs recovery/load).
- `useTodayBrief(userId)` → `ozzie_insights` `.eq('user_id', userId).eq('insight_type', 'daily_brief').gte('created_at', localDayRange(todayISO).start).order('created_at', { ascending: false }).limit(1).maybeSingle()` → `response_text: string | null`. (`localDayRange` from `day.ts`.)

## 2. Pure model (`webapp/src/features/home/model.ts`, TDD)

Extract the two derivations so the page is dumb assembly:

- `pickTodaySession(weekSessions: TrainingSession[], todayISO: string): TrainingSession | null` — the session whose `session_date === todayISO` (first if multiple), else null.
- `buildWeekStrip(weekSessions: TrainingSession[], completedSessionIds: Set<string>, todayISO: string): WeekDay[]` where `interface WeekDay { dateISO: string; session: TrainingSession | null; done: boolean; isToday: boolean }` — one entry per `sameWeekDates(todayISO)` date, `session` = that day's session (first) or null, `done` = the session's id ∈ `completedSessionIds`, `isToday` = `dateISO === todayISO`.

## 3. The page + cards

Replace `webapp/src/routes/_authed/index.tsx` (`createFileRoute('/_authed/')({ component: DashboardPage })`, `userId` from `Route.useRouteContext()`). The page renders, top to bottom, inside the existing `.page` shell with a `PageHeader` (eyebrow "Dashboard", title the local weekday + date):

1. **`<TodayHero>`** — `pickTodaySession(...)` → an `.ozzie-note`/`.detail-card`-styled hero: session type/intensity/`planned_minutes`/`planned_distance_km` (km) + its `ozzie_notes`; below it, `useTodayBrief` `response_text` in an `.ozzie-note` block when present. No session today → a "Rest day — nothing scheduled" card.
2. **`<StatBand>`** — a `.stat-band` of up to four tiles from `useDailySummary`: Recovery (`recovery_score`, sub = `recovery_recommendation`), Form (`tsb`, signed), This week (`week_distance_km` km), Last 30 days (`workouts_last_30d`). Recovery and Form (TSB) are the opportunistic/nullable tiles — the view `LEFT JOIN`s them, so each renders only when non-null. This-week distance and the 30-day count always render: the view computes them as `COALESCE(SUM(...), 0)` and `COUNT(*)`, which are never null, so a brand-new user correctly sees "0 km" / "0" rather than a missing tile. The all-tiles-null band-omission is a defensive path only, not the common case.
3. **`<WeekStrip>`** — `buildWeekStrip(...)` → a 7-column strip (reuse `.week-strip`/`.badge` idioms; a ✓ for `done`, a marker for `isToday`), with an "Open calendar ›" `<Link to="/calendar">`.
4. **`<NextRaceCard>`** — `useNextRaceEvent` + `buildRacePredictor(useBestRun)` + `computeRacePhase(useUserGoal)`: countdown (`.race-countdown`), name/date/goal, the Riegel prediction, and the phase chip. Omitted when there's no upcoming race AND no dated plan.
5. **`<FuelCard>`** — `useDayLog(todayISO)` + `useNutritionTargets`: calories + macro bars vs targets (reuse the `.fuel-band`/`.macro` idioms), a `<Link to="/nutrition">`.

Cards are `<Link>`s / contain links into their full screens (calendar, nutrition) — the home is a launchpad.

## 4. Error / empty states

- Each card owns its loading/error locally (the existing `ErrorPanel`/muted-loading idioms); one card erroring never blanks the page.
- Opportunistic nulls collapse (per §3) rather than showing zeros.
- Absolute worst case (no plan, no race, no fuel targets, no sync): the page still shows the header + a "Rest day / nothing scheduled yet" hero, never a blank screen.

## 5. Testing

- **Pure model (TDD):** `pickTodaySession` (today present / absent / multiple) and `buildWeekStrip` (7 entries in `sameWeekDates` order; `done` via the completed set; `isToday` flag; empty days null) — `webapp/tests/home-model.test.ts`.
- **Hooks + page:** typecheck-verified (Supabase-hitting, like the other read hooks); a browser-preview smoke of `/` (boot-clean, cards render, show-if-present collapses cleanly — the controller drives the logged-in view).
- The existing **116 webapp tests stay green**.

## Non-goals (deferred follow-ups)

The analyst-first **fitness-ramp trend** (a `load_scores` history query + a chart component); any editing on the dashboard (edits happen on the calendar — the home links there); TTS/audio playback of the brief; marking the brief `read_at`; a "log a workout" quick-action; any migration, view change, or edge change.

---

## File-by-file change map

**Webapp (`webapp/`):**
- `src/features/home/model.ts` — **new.** `pickTodaySession`, `buildWeekStrip`, `WeekDay`.
- `src/features/home/queries.ts` — **new.** `useDailySummary`, `useTodayBrief`.
- `src/routes/_authed/index.tsx` — **replace** the redirect with `DashboardPage` composing the cards.
- (Card sub-components — `TodayHero`/`StatBand`/`WeekStrip`/`NextRaceCard`/`FuelCard` — colocated under `src/features/home/` or within `index.tsx`; the plan decides granularity.)
- `tests/home-model.test.ts` — **new.** The two pure helpers.

---

## Testing & acceptance criteria

1. Visiting `/` renders the dashboard (no redirect); the header shows today's date.
2. The today hero shows today's session (or a rest-day card) and appends the daily brief only when one exists for today.
3. The stat band shows the recovery and form (TSB) tiles only when the corresponding `v_daily_summary` value is non-null (opportunistic, from the phone's health sync/on-device generation); the this-week-distance and 30-day-count tiles always render, since the view `COALESCE`s/`COUNT`s them to 0 rather than null. The whole-band omission is a defensive path for the (effectively unreachable) all-null case, not the expected behavior for a new user.
4. The this-week strip shows the 7 Mon–Sun days with the correct session per day, ✓ for completed, and today marked; "Open calendar" navigates to `/calendar`.
5. Next-race and fuel cards match what the calendar/nutrition screens show (same reused hooks); fuel/race cards omit gracefully when their data is absent.
6. **No migration, no edge change;** existing 116 webapp tests stay green; typecheck + build clean.
