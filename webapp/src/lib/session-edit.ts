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
    payload.fuel = null;
    if (edits.session_type !== 'lift') payload.lift_prescription = null;
    if (!INTERVAL_TYPES.has(edits.session_type)) payload.interval_prescription = null;
  }
  return payload;
}
