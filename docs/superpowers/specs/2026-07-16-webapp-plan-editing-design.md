# Webapp Plan Editing — editable calendar sessions (full CRUD) — Design

**Date:** 2026-07-16
**Status:** Approved (design) — ready for implementation plan
**Origin:** Next slice of the "make the webapp a real product" program (all-sports coverage merged `d00adad`). The master plan calls plan-editing the webapp's #1 reason to exist ("deep dashboards, trends, and plan-editing a phone screen can't do well"). The calendar detail pane is read-only today; this makes a planned session editable, movable, deletable, and addable from the browser.

**Interaction model (user's choice):** the **simple side-panel editor** — click a session, its detail pane becomes an editable form; empty days offer **+ Add session**. Drag-and-drop is an explicit deferred follow-up.

---

## Global Constraints

- **Webapp-only. No migration, no edge-function change.** `training_sessions` already grants `SELECT/INSERT/UPDATE/DELETE` to `authenticated` with a self-scoped RLS policy (`20260628000002`/`4`); `workout_logs` and `plan_adjustments` (the two nullable FK refs to `training_sessions(id)`) also grant `UPDATE` to `authenticated`. Every write this slice needs is already permitted — verified against the migrations.
- **Edits are live and shared.** Writes go to the real `training_sessions` rows, so a web edit shows on the mobile app too (same account, same plan). This is intended.
- **Manual edits, not re-coaching.** The user changes the fields they touch. Deeper coach-generated content (`fuel`, `lift_prescription`, `interval_prescription`, `ozzie_notes`) is NOT re-derived per edit — a full plan regeneration (mobile/plan-builder) refreshes it. To avoid showing *stale* content, a **type change clears** the now-mismatched auto fields (see §3).
- **Regeneration supersedes.** A later week regeneration deletes + reinserts that week's sessions (`ozzie-generate-plan/index.ts:692-720`), replacing hand-edits — already true for mobile swaps; not solved here.
- **Existing behaviour byte-identical.** Editing is additive; the read paths (`useMonthSessions` etc.) and the existing 108 webapp tests stay green.
- **Commands:** `cd webapp && npm test` (vitest, `TZ=America/New_York`); `npm run typecheck`; `npm run build`.
- **TDD** for the pure helpers (§4). The form + wiring are typecheck + build + browser-preview.

---

## 1. Scope — the four operations

Editing a session in `training_sessions`. The editable/managed columns:

| Column | Editable how |
|---|---|
| `session_type` (enum: run/lift/cross/rest/race/swim/bike/rowing/hyrox) | dropdown |
| `intensity` (enum: easy/moderate/threshold/interval/race/rest) | dropdown |
| `planned_minutes` (int, nullable) | number field |
| `planned_distance_km` (numeric, nullable) | number field, **in km** (matches the calendar's current `8k` display; distance-unit conversion is a deferred follow-up) |
| `description` (text, nullable) | textarea |
| `session_date` | move (§3) |

Not user-editable: `ozzie_notes`, `fuel`, `lift_prescription`, `interval_prescription` (coach-managed; auto-cleared on a type change per §3). `week_id`/`user_id`/`id` are structural.

## 2. Components

- **`webapp/src/lib/session-edit.ts`** (new, pure) — `sameWeekDates(dateISO)` (the 7 Monday-first ISO dates of the week containing `dateISO`); `weekIdForDate(dateISO, monthSessions)` (the `week_id` of any sibling session in that Monday–Sunday week, or `null`); `sessionUpdatePayload(current, edits)` (the `UPDATE` body, applying the type-change field-clearing of §3).
- **`webapp/src/features/calendar/queries.ts`** (extend) — three mutation hooks: `useUpdateSession`, `useDeleteSession`, `useCreateSession` (§3), each invalidating the calendar's `['sessions', userId, fromISO]` (and `['completions', …]` where relevant) queries and reusing the empty-result guard idiom from `useUpdateThresholdAnchor` (`settings/queries.ts:66-79`).
- **`webapp/src/features/calendar/SessionEditor.tsx`** (new) — the editable form: the field inputs, a **Move to** `<select>` over `sameWeekDates`, **Save** / **Delete** (delete confirms first), and an **Add** mode (blank form seeded to a chosen empty day). Distance in km; reuses existing `app.css` classes (`.detail-card`, `.settings-row`, `.btn`, `.field`, `.err-line`) — no new CSS.
- **`webapp/src/routes/_authed/calendar.tsx`** (modify) — the session detail pane (`:164-201`) gains an **Edit** affordance that swaps the read-only view for `<SessionEditor>`; empty calendar cells gain a **+ Add session** control opening the editor in Add mode for that date. Session tiles, race pane, predictor, and phase chip are untouched.

## 3. Data writes (the four operations)

- **Change** — `useUpdateSession({ id, current, edits })` → `UPDATE training_sessions SET … WHERE id = :id` with `sessionUpdatePayload`. When `edits.session_type` differs from `current.session_type`, the payload ALSO sets: `ozzie_notes = null`, `lift_prescription = null` unless the new type is `lift`, and `interval_prescription = null` unless the new type ∈ {run, swim, bike, rowing} — so a run-turned-lift never renders stale running notes/intervals. A non-type edit leaves all coach fields untouched.
- **Move** — a special case of Change: `UPDATE … SET session_date = :newDate`. The **Move to** options are the 7 days of the session's own Monday–Sunday week (`sameWeekDates`), so `week_id` stays valid — **cross-week moves are a deferred follow-up** (v1 keeps a session inside its training week).
- **Delete** — `useDeleteSession(id)`: `UPDATE workout_logs SET session_id = null WHERE session_id = :id`; `UPDATE plan_adjustments SET session_id = null WHERE session_id = :id`; then `DELETE FROM training_sessions WHERE id = :id`. This detach-then-delete order mirrors `index.ts:703-720` and prevents an FK violation (neither ref cascades) — so a session you've already logged against deletes cleanly and your `workout_logs` history survives (its `session_id` just becomes null = "unplanned", the schema's documented meaning).
- **Add** — `useCreateSession(fields)`: `INSERT` with `week_id = weekIdForDate(date, monthSessions)`, `user_id`, `session_date`, `session_type`, `intensity`, `planned_minutes`, `planned_distance_km`, `description`. If the target day's Monday–Sunday week has **no** sessions to borrow a `week_id` from, Add is blocked with an inline message ("No training week here yet — add sessions to a week your plan covers"). No `ozzie_notes`/`fuel`/prescription (coach-generated; a regeneration or a later re-coach follow-up fills them).

## 4. Testing

- **Pure helpers (TDD):** `sameWeekDates` (Monday-first, 7 dates, DST-safe under `TZ=America/New_York`); `weekIdForDate` (returns a sibling's `week_id`; `null` when the week is empty); `sessionUpdatePayload` (type-change clears `ozzie_notes` + the mismatched prescription; non-type edit clears nothing; the exact conditional matrix per type).
- **Mutations:** typecheck-verified (Supabase-hitting, like the other calendar/settings hooks); the delete detach-then-delete order is asserted by the reviewer + the preview, not a mocked-DB test.
- **Form + wiring:** `npm run typecheck` + `npm run build` clean; a browser-preview smoke of edit / move / delete / add on `/calendar` (logged-in click-through needs the live session — the controller drives it).
- The existing **108 webapp tests stay green**.

## Non-goals (deferred follow-ups)

Drag-and-drop rescheduling; cross-week moves; AI re-coaching of an edited session (re-deriving `fuel`/prescriptions/`ozzie_notes`); distance-unit conversion in the editor (km for v1, matching the current calendar display); adding a session outside the plan's generated weeks; editing `ozzie_notes` directly; any migration or edge change.

---

## File-by-file change map

**Webapp (`webapp/`):**
- `src/lib/session-edit.ts` — **new.** `sameWeekDates`, `weekIdForDate`, `sessionUpdatePayload`.
- `src/features/calendar/queries.ts` — `useUpdateSession`, `useDeleteSession`, `useCreateSession`.
- `src/features/calendar/SessionEditor.tsx` — **new.** The edit/add form (fields + Move-to + Save/Delete).
- `src/routes/_authed/calendar.tsx` — edit affordance in the detail pane; **+ Add session** on empty cells.
- `tests/session-edit.test.ts` — **new.** The three pure helpers.

---

## Testing & acceptance criteria

1. A session's type/intensity/minutes/distance/description can be edited from the detail pane and persists to `training_sessions`; the calendar refreshes without reload.
2. Changing a session's **type** clears `ozzie_notes` and the mismatched prescription (verified by `sessionUpdatePayload` tests); a non-type edit leaves them intact.
3. **Move** relocates a session to another day of its own week (`week_id` unchanged); the Move-to options are exactly that week's 7 days.
4. **Delete** removes a session and, when it has a logged workout, nulls that `workout_logs.session_id` (history preserved, no FK error); a linked `plan_adjustments` row is likewise detached.
5. **Add** inserts a new session on an empty day within a covered week (correct `week_id` borrowed from a sibling); Add is blocked with a message on a day whose week has no sessions.
6. Edits are visible to the mobile app (same rows). **No migration, no edge change**; the existing 108 webapp tests stay green; typecheck + build clean.
