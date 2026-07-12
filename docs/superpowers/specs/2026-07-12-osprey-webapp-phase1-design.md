# Osprey Web App — Phase 1 (Foundation + Workout Desk) Design Spec

**Date:** 2026-07-12
**Status:** Approved direction, pending user review of this document
**Relation to other work:** This is the authenticated product web app ("Strava's website" to the iOS app's "Strava app"). It is separate from the marketing site (`website/`, Astro, already merged). The iOS app is `OSPREY-app/` (Expo 52 + Supabase).

## 1. Product intent & audience

A functional web companion to the OSPREY iOS app: same account, same data, bigger screen. **Phase 1 is a personal tool for the owner** ("me first, public later") — it optimizes for daily usefulness against real data, not signup funnels. Public hardening is Phase 4.

Phase 1 centers on the **Workout Desk**: reviewing the training plan on a real calendar and logging strength sessions with spreadsheet-grade ergonomics — the two places a phone hurts most.

## 2. Architecture

- **Codebase:** new `webapp/` directory at repo root. Vite + React 18 + TypeScript (strict). TanStack Router (file-based) + TanStack Query (matches the iOS app's data layer). `@supabase/supabase-js` v2 for auth + data. Zod schemas ported from `OSPREY-app/src/types` (copied initially; a shared package is deliberately deferred until duplication hurts — YAGNI).
- **Pure client:** Phase 1 makes **zero backend changes**. All reads/writes hit existing RLS-protected tables. Both surfaces stay consistent because they share rows; the web app cannot break the phone.
- **No SSR.** Authed dashboard; SPA is correct. Dev server runs against the live Supabase project via env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same anon key the app uses; safety comes from RLS, not key secrecy).
- **Hosting:** Phase 1 = localhost only. Public deploy target is `app.osprey.app` (Cloudflare Pages likely; GH Pages SPA routing is a hack). Deferred to the phase that goes public.

### Phases (each its own spec → plan → build)
1. **Foundation + Workout Desk** — this spec.
2. **Nutrition Desk** — food logging (`food_items`, `food_log_entries`), targets vs actuals, **recipes** (net-new table + RLS; the first backend addition, designed for iOS adoption too).
3. **Ozzie** — full-screen chat via existing edge functions (`ozzie-nutrition-coach`, `ozzie-daily-brief`), `coach_memory` / `ozzie_insights` surfaced.
4. **Dashboard + public hardening** — Strava-style home, charts, onboarding/empty states, deploy.

## 3. Auth (gate zero)

- Supabase email/password sign-in form + "Sign in with Apple" (Supabase OAuth) button.
- **First task of the plan verifies the owner's real account can log in on web.** If the account is Apple-only: either link a password (Supabase admin/email flow) or configure Apple web OAuth (Apple service ID — external config, flagged as such).
- Session persisted via supabase-js default (localStorage); `onAuthStateChange` drives a route guard — unauthenticated users see only `/login`.
- No signup flow in Phase 1 (me-first). No password reset UI (use the app or Supabase dashboard if needed).

## 4. Design language

Extends the marketing site's **warmed Kinetic Brutalism** into the product: `--ink #09090B` background, `--panel #101014`, 2px `--line #3F3F46` exposed grid, zero radius, copper amber `--amber #c8793a` accent, Space Grotesk 500/700, `--text/--text-soft/--mut` grays, tabular numerals for all data. AA contrast rules and `:focus-visible` conventions carry over from the website spec verbatim (`docs/superpowers/specs/2026-07-11-osprey-website-design-design.md` §4, §8).

App-shell chrome: fixed **left nav rail** (logo mark, Calendar / Log / History / Settings, sign-out at bottom), content area fills the rest. Data-dense, keyboard-first; motion mechanical (100–150ms), `prefers-reduced-motion` honored.

## 5. Phase 1 surfaces

### 5.1 `/login`
Email/password fields + Apple button, brutalist card on ink. Errors inline. On success → `/calendar`.

### 5.2 `/calendar` — training plan
- Month grid (default) and week strip toggle. Sessions from `training_sessions` (joined via `training_weeks` → `training_plans` for the active plan) plotted by `session_date`; color-coded by `intensity`, labeled by `session_type` + `planned_minutes`/`planned_distance_km`.
- Clicking a session opens a **side detail pane** (not a modal): description, `ozzie_notes` (read-only), linked `workout_logs` if completed.
- Completed sessions show a completion mark (a `workout_logs` row with matching `session_id` and status `completed`).
- Read-only in Phase 1 (no plan editing — plans come from `ozzie-generate-plan`).

### 5.3 `/log` — strength session entry
- "New workout" creates a `workout_logs` row: `session_type = 'lift'` (exact DB enums: session_type = `run|lift|cross|rest|race|swim|bike|rowing|hyrox`; status = `planned|completed|skipped|partial`; intensity = `easy|moderate|threshold|interval|race|rest`), `started_at` (defaults now, editable), `status = 'completed'` on save; optional link to a planned `training_sessions` row (picker of today's/this week's plan sessions).
- **Sets grid:** rows = `exercise_sets`. Columns: exercise (typeahead against `exercises.name`, ~global reference table), set #, reps, weight (displayed in user units, stored `weight_kg`), RPE. Keyboard-first: Tab/Enter advance, ⏎ on last cell adds next set, duplicate-last-set shortcut, arrow-key row navigation.
- Weight conversion: `users.units` ('imperial' default) → display lbs, store kg (mirror `OSPREY-app/src/services/units.ts` conversions exactly).
- Per-workout fields: perceived_effort (1–10), notes, duration.
- Saves are incremental (each set row upserts on commit) so a half-entered session survives a tab close. Soft-delete convention respected (`deleted_at IS NULL` filters everywhere).
- Editing an existing strength workout reuses the same grid.

### 5.4 `/history`
- Filterable, sortable table of `workout_logs` (all `session_type`s — phone-logged runs appear too): date, type, duration, distance, effort, TSS. Filters: type, date range. Pagination (50/page).
- Row → detail view: strength workouts show the sets grid (editable); other types read-only summary (maps/GPS explicitly out of scope).

### 5.5 `/settings`
- Display: signed-in email, units toggle (reads/writes `users.units`), sign out. Nothing else in Phase 1.

## 6. Data layer

- One `src/lib/supabase.ts` client. Feature query modules (`src/features/{calendar,log,history}/queries.ts`) wrap supabase-js calls in TanStack Query hooks with typed zod parsing at the boundary.
- Query keys namespaced (`['sessions', planId, monthISO]`, `['workout', id]`…); mutations invalidate precisely, no global refetch.
- All tables involved: read `training_plans/weeks/sessions`, `exercises`, `users.units`; read/write `workout_logs`, `exercise_sets`; read/write `users.units`. No other tables in Phase 1.
- Error handling: query errors render an inline panel-level error state (not toasts) with retry; mutation failures keep the grid cell dirty + visible error line; auth expiry redirects to `/login`.

## 7. Testing

- Vitest for pure logic: unit conversions, sets-grid reducer (row add/duplicate/commit), zod schema parsing of representative DB rows, query-key builders.
- The sets-grid state machine is written as a pure reducer specifically so it's unit-testable without DOM.
- Component/E2E testing deferred; manual browser verification (per repo convention: live-verify before claiming done).

## 8. Out of scope for Phase 1 (explicit)

Nutrition/recipes; Ozzie chat and coach lines; dashboard/home; GPS maps and route rendering; social (friends/challenges/kudos); plan editing; signup/onboarding/password reset; mobile-responsive polish beyond not-broken; deployment/domain; any schema or edge-function change; offline support.

## 9. Risks & mitigations

- **Apple-only account can't log in on web** → plan's first task proves login with the real account before any UI is built; fallback is linking a password to the same user.
- **Enum drift** (session_type/status values) → plan generates or hand-copies exact enum values from migrations; zod enums must match DB enums.
- **RLS surprises** (policies written with only the app's flows in mind) → early smoke task: from the web client, read + write a `workout_logs` row and read `training_sessions` with the real account.
- **Grid complexity creep** → the grid ships keyboard-first but plain (no virtualization, no drag-reorder) — a session has dozens of sets, not thousands.
