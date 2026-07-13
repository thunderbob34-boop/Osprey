# Osprey Web App

An authenticated web companion to the Osprey mobile app — plan your week, log strength sets, and review training history from a browser. Pure client SPA (React + TanStack Router/Query) on top of the existing Supabase project; no backend changes beyond the two grant fixes noted below. Design language matches the marketing site's brutalist-amber system (see `../website/`).

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
```

Requires `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the Osprey Supabase project (fetch via the Supabase dashboard or MCP; never commit these).

## Routes

- `/calendar` — season view: month grid of planned sessions (intensity-colored, ✓ when a linked workout is logged as completed), upcoming race countdown, a Riegel-formula race-time predictor from your best recent run, and a side pane with session/race detail including Ozzie's coaching notes.
- `/log` → `/log/:workoutId` — start a lift workout (optionally linked to a plan session), then log sets in a keyboard-first grid: type-ahead exercise search, tab/blur-to-save, Enter duplicates the last set.
- `/history` → `/history/:workoutId` — filterable, paginated table of everything logged, with a stat band (sessions, distance, avg effort) and a per-workout detail view (full sets for lifts).
- `/settings` — account info and an imperial/metric toggle.

## Commands

```bash
npm run typecheck   # tsc -b --noEmit
npm test            # vitest
npm run build        # tsc -b && vite build
```

## Notable fixes made while building Phase 1

- `exercise_sets` had no `UPDATE`/`DELETE` grant for `authenticated` at the Postgres level (RLS already permitted it — this was a missing base grant, not an RLS gap). Fixed in migration `20260712000033_exercise_sets_write_grants.sql`, matching the precedent in `20260708000030_ozzie_insights_delete_grant.sql`.
- The sets-grid's exercise-selection commit used a stale React closure when reps/weight were filled in before the exercise was picked, silently no-opping the save. Fixed by computing the merged row synchronously instead of reading back from async state.

## Roadmap

Phase 1 (this) covers Foundation + Workout Desk per `docs/superpowers/specs/2026-07-12-osprey-webapp-phase1-design.md` and `docs/superpowers/plans/2026-07-12-osprey-webapp-phase1.md`, plus an added race-events/prediction layer on Calendar (not in the original Phase 1 scope — race event discovery/search and auto-scheduling tune-up races into plan generation are explicitly out of scope here; that's coaching-logic work belonging in `docs/coaching/`). Phases 2–4 (nutrition/recipes, Ozzie chat, public dashboard) are outlined in the design spec but not started.
