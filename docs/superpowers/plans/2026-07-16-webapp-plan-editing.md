# Webapp Plan Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a planned training session editable, movable, deletable, and addable from the webapp calendar's detail pane (the simple side-panel editor).

**Architecture:** Webapp-only. Three new pure helpers (`session-edit.ts`), three new React-Query mutation hooks on `training_sessions`, and a `SessionEditor` form that replaces the read-only detail pane; the calendar wires an Edit toggle and a "+ Add session" affordance. Writes go straight to the real rows (shared with mobile); no migration or edge change (grants + RLS already present).

**Tech Stack:** React 18, TanStack Query, `@supabase/supabase-js`, Zod, Vitest (`TZ=America/New_York`).

## Global Constraints

- **Webapp-only — no migration, no edge-function change.** `training_sessions`, `workout_logs`, and `plan_adjustments` already grant full CRUD to `authenticated` (verified: `20260628000002`/`4`); RLS is self-scoped.
- **Edits are live `UPDATE`/`INSERT`/`DELETE` on `training_sessions`** — shared with the mobile app (same rows).
- **Manual edits, not re-coaching.** A **type change** clears the now-stale coach fields (`ozzie_notes`, and the mismatched `lift_prescription`/`interval_prescription`); a non-type edit clears nothing. Deeper re-coaching is out of scope.
- **Delete detaches first.** Null `workout_logs.session_id` and `plan_adjustments.session_id` referencing the session (both nullable, no cascade), then delete — mirroring `supabase/functions/ozzie-generate-plan/index.ts:703-720`.
- **Move stays within the session's own Monday–Sunday week** (`week_id` unchanged); cross-week moves are deferred.
- **Distance is in km** in the editor (no unit conversion); deferred follow-up.
- **Existing 108 webapp tests stay green.** Commands: `cd Osprey/webapp && npm test` · `npm run typecheck` · `npm run build`.

---

## File Structure

| File | Responsibility |
|---|---|
| `webapp/src/lib/session-edit.ts` (new) | Pure helpers: `sameWeekDates`, `weekIdForDate`, `sessionUpdatePayload` + the `SessionEdits`/`NewSession` types. |
| `webapp/src/features/calendar/queries.ts` (modify) | `useUpdateSession`, `useDeleteSession`, `useCreateSession`. |
| `webapp/src/features/calendar/SessionEditor.tsx` (new) | The edit/add form rendered in the detail pane. |
| `webapp/src/routes/_authed/calendar.tsx` (modify) | Edit toggle in the detail pane; "+ Add session" on empty cells. |
| `webapp/tests/session-edit.test.ts` (new) | The three pure helpers. |

---

## Task 1: `session-edit.ts` — pure helpers (TDD)

**Files:**
- Create: `Osprey/webapp/src/lib/session-edit.ts`
- Test: `Osprey/webapp/tests/session-edit.test.ts`

**Interfaces:**
- Consumes: `addDays` from `Osprey/webapp/src/lib/day.ts` (`addDays(dateStr: string, delta: number): string`); `TrainingSession` from `Osprey/webapp/src/lib/schemas.ts`.
- Produces: `sameWeekDates(dateISO: string): string[]`; `weekIdForDate(dateISO: string, monthSessions: TrainingSession[]): string | null`; `interface SessionEdits { session_type: string; intensity: string; planned_minutes: number | null; planned_distance_km: number | null; description: string | null; session_date?: string }`; `sessionUpdatePayload(current: TrainingSession, edits: SessionEdits): Record<string, unknown>`.

- [ ] **Step 1: Write the failing test** — `Osprey/webapp/tests/session-edit.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { sameWeekDates, weekIdForDate, sessionUpdatePayload } from '../src/lib/session-edit';
import type { TrainingSession } from '../src/lib/schemas';

const S = (over: Partial<TrainingSession>): TrainingSession => ({
  id: 'i', week_id: 'w1', user_id: 'u', session_date: '2026-07-14', session_type: 'run',
  intensity: 'interval', planned_minutes: 60, planned_distance_km: 10, description: 'x',
  ozzie_notes: null, created_at: '', updated_at: '', ...over,
});

describe('sameWeekDates', () => {
  it('returns Mon–Sun of the containing week (Tue 2026-07-14)', () => {
    expect(sameWeekDates('2026-07-14')).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19',
    ]);
  });
  it('treats Sunday as the last day of its week (2026-07-19)', () => {
    expect(sameWeekDates('2026-07-19')[0]).toBe('2026-07-13');
    expect(sameWeekDates('2026-07-19')[6]).toBe('2026-07-19');
  });
});

describe('weekIdForDate', () => {
  const month = [S({ session_date: '2026-07-13', week_id: 'wA' }), S({ session_date: '2026-07-27', week_id: 'wB' })];
  it('borrows the week_id of a sibling in the same week', () => {
    expect(weekIdForDate('2026-07-16', month)).toBe('wA'); // Thu, same week as Mon 13
  });
  it('returns null when that week has no sessions', () => {
    expect(weekIdForDate('2026-08-10', month)).toBeNull();
  });
});

describe('sessionUpdatePayload', () => {
  const base = { intensity: 'easy', planned_minutes: 30, planned_distance_km: 5, description: 'd' };
  it('a non-type edit clears no coach fields', () => {
    const p = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'run', ...base });
    expect(p).toEqual({ session_type: 'run', intensity: 'easy', planned_minutes: 30, planned_distance_km: 5, description: 'd' });
  });
  it('run→lift clears ozzie_notes + interval_prescription, not lift_prescription', () => {
    const p = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'lift', ...base });
    expect(p.ozzie_notes).toBeNull();
    expect(p.interval_prescription).toBeNull();
    expect('lift_prescription' in p).toBe(false);
  });
  it('lift→run clears ozzie_notes + lift_prescription, not interval_prescription', () => {
    const p = sessionUpdatePayload(S({ session_type: 'lift' }), { session_type: 'run', ...base });
    expect(p.ozzie_notes).toBeNull();
    expect(p.lift_prescription).toBeNull();
    expect('interval_prescription' in p).toBe(false);
  });
  it('includes session_date only when provided (a move)', () => {
    const noMove = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'run', ...base });
    expect('session_date' in noMove).toBe(false);
    const move = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'run', ...base, session_date: '2026-07-16' });
    expect(move.session_date).toBe('2026-07-16');
  });
});
```

- [ ] **Step 2: Run it, verify failure** — `cd Osprey/webapp && npx vitest run tests/session-edit.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `session-edit.ts`**

```ts
import { addDays } from './day';
import type { TrainingSession } from './schemas';

// The 7 Monday-first ISO dates (YYYY-MM-DD) of the week containing dateISO.
// Mirrors the Monday-first math in routes/_authed/calendar.tsx monthRange; parses
// at LOCAL midnight so it is DST-safe under TZ=America/New_York.
export function sameWeekDates(dateISO: string): string[] {
  const d = new Date(`${dateISO}T00:00:00`);
  const lead = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = addDays(dateISO, -lead);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// The week_id of any session in the same Monday–Sunday week as dateISO, else null.
export function weekIdForDate(dateISO: string, monthSessions: TrainingSession[]): string | null {
  const week = new Set(sameWeekDates(dateISO));
  const sib = monthSessions.find((s) => week.has(s.session_date));
  return sib ? sib.week_id : null;
}

export interface SessionEdits {
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string | null;
  session_date?: string; // set to the Move-to day for a move; omit for a pure field edit
}

const INTERVAL_TYPES = new Set(['run', 'swim', 'bike', 'rowing']);

// The UPDATE body for an edit. A TYPE change also clears the now-mismatched
// coach-generated fields (ozzie_notes + the wrong prescription) so nothing stale
// renders; a non-type edit touches none of them.
export function sessionUpdatePayload(current: TrainingSession, edits: SessionEdits): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    session_type: edits.session_type,
    intensity: edits.intensity,
    planned_minutes: edits.planned_minutes,
    planned_distance_km: edits.planned_distance_km,
    description: edits.description,
  };
  if (edits.session_date !== undefined) payload.session_date = edits.session_date; // a move
  if (edits.session_type !== current.session_type) {
    payload.ozzie_notes = null;
    if (edits.session_type !== 'lift') payload.lift_prescription = null;
    if (!INTERVAL_TYPES.has(edits.session_type)) payload.interval_prescription = null;
  }
  return payload;
}
```

- [ ] **Step 4: Run it, verify pass** — `cd Osprey/webapp && npx vitest run tests/session-edit.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/session-edit.ts tests/session-edit.test.ts && git commit -m "feat(webapp): session-edit pure helpers (plan-editing T1)"`

---

## Task 2: mutation hooks (`useUpdateSession`, `useDeleteSession`, `useCreateSession`)

**Files:**
- Modify: `Osprey/webapp/src/features/calendar/queries.ts`

**Interfaces:**
- Consumes: `sessionUpdatePayload`, `SessionEdits` (Task 1); `TrainingSession` (schemas). Existing query keys in this file: `['sessions', userId, fromISO]` (`useMonthSessions`), `['completions', userId, fromISO]` (`useCompletions`).
- Produces: `useUpdateSession(userId)` → mutate `{ id: string; current: TrainingSession; edits: SessionEdits }`; `useDeleteSession(userId)` → mutate `id: string`; `useCreateSession(userId)` → mutate `NewSession` (`{ weekId: string; session_date: string; session_type: string; intensity: string; planned_minutes: number | null; planned_distance_km: number | null; description: string | null }`).

- [ ] **Step 1: Append the hooks** to `Osprey/webapp/src/features/calendar/queries.ts` (this file already imports `useQuery`, `supabase`, `z`, `TrainingSessionSchema`; add `useMutation, useQueryClient` from `@tanstack/react-query` and the two type imports). These mirror `useUpdateThresholdAnchor` (`src/features/settings/queries.ts:61-79`): `.select()` then throw if no rows, and RETURN (not `void`) the invalidation so the mutation stays pending until the refetch settles.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionUpdatePayload, type SessionEdits } from '../../lib/session-edit';
import type { TrainingSession } from '../../lib/schemas';

function invalidateCalendar(qc: ReturnType<typeof useQueryClient>, userId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['sessions', userId] }),
    qc.invalidateQueries({ queryKey: ['completions', userId] }),
  ]);
}

export function useUpdateSession(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, current, edits }: { id: string; current: TrainingSession; edits: SessionEdits }) => {
      const { data, error } = await supabase
        .from('training_sessions').update(sessionUpdatePayload(current, edits)).eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Could not save — that session no longer exists.');
    },
    onSuccess: () => invalidateCalendar(qc, userId),
  });
}

export function useDeleteSession(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Detach the two nullable FK refs first (no ON DELETE CASCADE) or the delete 400s.
      const { error: e1 } = await supabase.from('workout_logs').update({ session_id: null }).eq('session_id', id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('plan_adjustments').update({ session_id: null }).eq('session_id', id);
      if (e2) throw e2;
      const { data, error: e3 } = await supabase.from('training_sessions').delete().eq('id', id).select('id');
      if (e3) throw e3;
      if (!data || data.length === 0) throw new Error('Could not delete — that session no longer exists.');
    },
    onSuccess: () => invalidateCalendar(qc, userId),
  });
}

export interface NewSession {
  weekId: string;
  session_date: string;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string | null;
}

export function useCreateSession(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: NewSession) => {
      const { data, error } = await supabase.from('training_sessions').insert({
        week_id: s.weekId, user_id: userId, session_date: s.session_date,
        session_type: s.session_type, intensity: s.intensity,
        planned_minutes: s.planned_minutes, planned_distance_km: s.planned_distance_km, description: s.description,
      }).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Could not add the session.');
    },
    onSuccess: () => invalidateCalendar(qc, userId),
  });
}
```

- [ ] **Step 2: Typecheck** — `cd Osprey/webapp && npm run typecheck` → clean.
- [ ] **Step 3: Full suite** — `cd Osprey/webapp && npm test` → 108 tests still green (no behavior change to existing reads).
- [ ] **Step 4: Commit** — `git commit -m "feat(webapp): training-session mutation hooks (plan-editing T2)"`

---

## Task 3: `SessionEditor.tsx` — the edit/add form

**Files:**
- Create: `Osprey/webapp/src/features/calendar/SessionEditor.tsx`

**Interfaces:**
- Consumes: `useUpdateSession`, `useDeleteSession`, `useCreateSession`, `NewSession` (Task 2); `sameWeekDates`, `weekIdForDate`, `SessionEdits` (Task 1); `SESSION_TYPE_LABEL`, `INTENSITY_LABEL` (`src/lib/format.ts`); `TrainingSession` (schemas); the `SessionTypeEnum`/`IntensityEnum` value lists from `src/lib/schemas.ts`.
- Produces: `<SessionEditor userId session={session} monthSessions={sessions} onDone={fn} />` for **edit** mode, and `<SessionEditor userId addDate="YYYY-MM-DD" monthSessions={sessions} onDone={fn} />` for **add** mode.

**Behaviour:**
- Props: `{ userId: string; monthSessions: TrainingSession[]; onDone: () => void; session?: TrainingSession; addDate?: string }`. Exactly one of `session` (edit) / `addDate` (add) is set.
- Seed `useState` from `session` (edit) or empty defaults (add: `session_type='run'`, `intensity='easy'`, minutes/distance `null`, description `''`).
- **Fields** (reuse `.field`/`.detail-card`/`.btn`/`.err-line` from `app.css`, matching the existing detail pane): a `session_type` `<select>` (options = `Object.keys(SESSION_TYPE_LABEL)` labelled by it), an `intensity` `<select>` (`INTENSITY_LABEL`), `planned_minutes` (`<input type=number>`, empty→null), `planned_distance_km` (`<input type=number>`, empty→null, label **"Distance (km)"**), `description` (`<textarea>`).
- **Edit mode:** a **Move to** `<select>` over `sameWeekDates(session.session_date)` (labelled via `formatDateShort` from `format.ts`), defaulting to the current date. **Save** → `useUpdateSession.mutate({ id: session.id, current: session, edits: { session_type, intensity, planned_minutes, planned_distance_km, description, session_date: moveToValue } })` — the Move-to value rides through as `edits.session_date`, so Task 1's `sessionUpdatePayload` applies the move in the same UPDATE (passing the unchanged current date is a harmless no-op). **Delete** → `window.confirm('Delete this session?')` then `useDeleteSession.mutate(session.id)`. On success → `onDone()`.
- **Add mode:** compute `const weekId = weekIdForDate(addDate, monthSessions)`. If `weekId === null`, render only an inline message (`.err-line`): *"No training week here yet — add sessions to a week your plan covers."* Otherwise **Add** → `useCreateSession.mutate({ weekId, session_date: addDate, ...state })`; on success → `onDone()`.
- Show `update/delete/create.error` via `.err-line`; disable the buttons while `isPending`.

- [ ] **Step 1: Build `SessionEditor.tsx`** per the behaviour above, following the existing detail-pane markup in `routes/_authed/calendar.tsx:164-201` for structure and classes.
- [ ] **Step 2: Typecheck + build** — `cd Osprey/webapp && npm run typecheck && npm run build` → clean.
- [ ] **Step 3: Commit** — `git commit -m "feat(webapp): SessionEditor edit/add form (plan-editing T3)"`

---

## Task 4: wire the editor into `calendar.tsx`

**Files:**
- Modify: `Osprey/webapp/src/routes/_authed/calendar.tsx`

**Interfaces:**
- Consumes: `<SessionEditor>` (Task 3). Existing state: `selected` (the session/race selection), `sessions.data` (month sessions), `setSelected`.

**Behaviour:**
- Add `const [editing, setEditing] = useState(false)` and `const [addDate, setAddDate] = useState<string | null>(null)`.
- **Edit toggle:** in the `selected?.kind === 'session'` detail card (`:164-201`), add an **Edit** button (`.btn ghost small`) that sets `editing = true`. When `editing`, render `<SessionEditor userId={userId} session={selected.data} monthSessions={sessions.data ?? []} onDone={() => { setEditing(false); }} />` in place of the read-only body; a Cancel inside the editor (or the toggle) returns to read-only. Clear `editing` whenever `selected` changes.
- **Add affordance:** in the day-cell render (`cells.map`, `:88-127`), on an in-month cell add a small **+** control (`.btn ghost` sized like `.cal-chip`) that calls `setAddDate(dISO); setSelected(null)`. When `addDate` is set, render `<SessionEditor userId={userId} addDate={addDate} monthSessions={sessions.data ?? []} onDone={() => setAddDate(null)} />` in the aside (above or instead of the "select a session" hint).
- **Untouched:** session tiles, the race pane, the Race Predictor gate, the phase chip, `useMonthSessions`/`useCompletions` reads.

- [ ] **Step 1: Wire the Edit toggle + SessionEditor** into the session detail card.
- [ ] **Step 2: Wire the "+ Add session" affordance** on empty/in-month cells → SessionEditor add mode.
- [ ] **Step 3: Typecheck + build** — `cd Osprey/webapp && npm run typecheck && npm run build` → clean.
- [ ] **Step 4: Preview smoke** — `preview_start` the webapp, open `/calendar`; confirm no console errors and the Edit / + Add controls render. (Logged-in click-through of a real save needs the user's session — controller drives it.)
- [ ] **Step 5: Full suite + commit** — `cd Osprey/webapp && npm test` (108 green) → `git commit -m "feat(webapp): wire plan editing into the calendar (plan-editing T4)"`

---

## Final verification

- [ ] `cd Osprey/webapp && npm test` — all green (108 existing + the new `session-edit` tests).
- [ ] `npm run typecheck` and `npm run build` — clean.
- [ ] Grep confirms no migration/edge file changed: the diff touches only `webapp/`.

## Notes / deferred

- Drag-and-drop rescheduling; cross-week moves; AI re-coaching of an edited session; distance-unit conversion in the editor (km for v1); adding a session outside the plan's generated weeks (blocked); editing `ozzie_notes` directly.
