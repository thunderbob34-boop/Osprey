import { useEffect, useRef, useState } from 'react';
import { useCreateSession, useDeleteSession, useUpdateSession } from './queries';
import { sameWeekDates, weekIdForDate, type SessionEdits } from '../../lib/session-edit';
import { SESSION_TYPE_LABEL, INTENSITY_LABEL, formatDateShort } from '../../lib/format';
import { friendlyMessage } from '../../lib/errorMessage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { TrainingSession } from '../../lib/schemas';

interface Props {
  userId: string;
  monthSessions: TrainingSession[];
  onDone: (action: 'saved' | 'deleted' | 'added') => void;
  onCancel?: () => void;
  session?: TrainingSession; // edit mode
  addDate?: string; // add mode — exactly one of session/addDate is set
}

type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseNonNegative(raw: string, label: string): FieldResult<number | null> {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${label} must be a non-negative number.` };
  return { ok: true, value: n };
}

export function SessionEditor({ userId, monthSessions, onDone, onCancel, session, addDate }: Props) {
  const [sessionType, setSessionType] = useState<TrainingSession['session_type']>(session?.session_type ?? 'run');
  const [intensity, setIntensity] = useState<TrainingSession['intensity']>(session?.intensity ?? 'easy');
  const [minutes, setMinutes] = useState(session?.planned_minutes != null ? String(session.planned_minutes) : '');
  const [distanceKm, setDistanceKm] = useState(session?.planned_distance_km != null ? String(session.planned_distance_km) : '');
  const [description, setDescription] = useState(session?.description ?? '');
  const [moveTo, setMoveTo] = useState(session?.session_date ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingTypeChange, setConfirmingTypeChange] = useState(false);

  const update = useUpdateSession(userId);
  const del = useDeleteSession(userId);
  const create = useCreateSession(userId);

  // Move keyboard/screen-reader focus into the form as soon as it opens — otherwise
  // it stays on the triggering "Edit"/"+ Add" button, off-screen from the fields.
  // (Two refs: the dead-end "no training week" card has no Type select to focus.)
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const deadEndCancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    typeSelectRef.current?.focus();
    deadEndCancelRef.current?.focus();
  }, []);

  // Add mode only — the week this new session would join, if the plan covers this date.
  const weekId = !session && addDate ? weekIdForDate(addDate, monthSessions) : null;

  if (!session && weekId === null) {
    return (
      <div className="detail-card">
        <p className="err-line">No training week here yet — add sessions to a week your plan covers.</p>
        {onCancel && (
          <div className="log-form-actions" style={{ marginTop: 12 }}>
            <button ref={deadEndCancelRef} className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
          </div>
        )}
      </div>
    );
  }

  function buildFields(): FieldResult<Omit<SessionEdits, 'session_date'>> {
    const minutesResult = parseNonNegative(minutes, 'Minutes');
    if (!minutesResult.ok) return minutesResult;
    const distanceResult = parseNonNegative(distanceKm, 'Distance');
    if (!distanceResult.ok) return distanceResult;
    return {
      ok: true,
      value: {
        session_type: sessionType,
        intensity,
        planned_minutes: minutesResult.value != null ? Math.round(minutesResult.value) : null,
        planned_distance_km: distanceResult.value,
        description,
      },
    };
  }

  async function performSave(built: Omit<SessionEdits, 'session_date'>) {
    if (!session) return;
    try {
      await update.mutateAsync({ id: session.id, current: session, edits: { ...built, session_date: moveTo } });
      onDone('saved');
    } catch {
      // surfaced via update.error below
    } finally {
      setConfirmingTypeChange(false);
    }
  }

  // A type change wipes any Ozzie-generated coaching content for the old type
  // (notes, fuel, and prescriptions) — confirm before discarding it. ozzie_notes is
  // the only one of those fields the webapp reads, but it's a reliable proxy: Ozzie
  // writes a note alongside any prescription/fuel it generates for a session.
  async function handleSave() {
    if (!session) return;
    const built = buildFields();
    if (!built.ok) { setValidationError(built.error); return; }
    setValidationError(null);
    if (sessionType !== session.session_type && session.ozzie_notes) {
      setConfirmingTypeChange(true);
      return;
    }
    await performSave(built.value);
  }

  // Fields are frozen behind the confirm-type-change modal, so re-running the
  // same (already-passing) validation here is just to get a typed value back.
  async function confirmTypeChangeAndSave() {
    const built = buildFields();
    if (built.ok) await performSave(built.value);
    else setConfirmingTypeChange(false);
  }

  async function handleDelete() {
    if (!session) return;
    try {
      await del.mutateAsync(session.id);
      onDone('deleted');
    } catch {
      // surfaced via del.error below
    } finally {
      setConfirmingDelete(false);
    }
  }

  async function handleAdd() {
    if (weekId === null || !addDate) return;
    const built = buildFields();
    if (!built.ok) { setValidationError(built.error); return; }
    setValidationError(null);
    try {
      await create.mutateAsync({ weekId, session_date: addDate, ...built.value });
      onDone('added');
    } catch {
      // surfaced via create.error below
    }
  }

  const error = session ? (update.error ?? del.error) : create.error;
  const errorMessage = validationError ?? (error ? friendlyMessage(error) : null);
  const pending = session ? (update.isPending || del.isPending) : create.isPending;

  return (
    <div className="detail-card">
      <div className="settings-row">
        <label className="k" htmlFor="se-type">Type</label>
        <select ref={typeSelectRef} id="se-type" value={sessionType} onChange={(e) => setSessionType(e.target.value as TrainingSession['session_type'])}>
          {Object.keys(SESSION_TYPE_LABEL).map((k) => <option key={k} value={k}>{SESSION_TYPE_LABEL[k]}</option>)}
        </select>
      </div>

      <div className="settings-row">
        <label className="k" htmlFor="se-intensity">Intensity</label>
        <select id="se-intensity" value={intensity} onChange={(e) => setIntensity(e.target.value as TrainingSession['intensity'])}>
          {Object.keys(INTENSITY_LABEL).map((k) => <option key={k} value={k}>{INTENSITY_LABEL[k]}</option>)}
        </select>
      </div>

      <div className="settings-row">
        <label className="k" htmlFor="se-minutes">Minutes</label>
        <input id="se-minutes" type="number" min="0" step="1" style={{ width: 90 }} value={minutes} onChange={(e) => { setMinutes(e.target.value); setValidationError(null); }} />
      </div>

      <div className="settings-row">
        <label className="k" htmlFor="se-distance">Distance (km)</label>
        <input id="se-distance" type="number" min="0" step="0.1" style={{ width: 90 }} value={distanceKm} onChange={(e) => { setDistanceKm(e.target.value); setValidationError(null); }} />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="se-description">Description</label>
        <textarea id="se-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {session && (
        <div className="settings-row">
          <label className="k" htmlFor="se-move-to">Move to</label>
          <select id="se-move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {sameWeekDates(session.session_date).map((d) => (
              // Append a local-midnight time so formatDateShort's `new Date(str)` parses in local
              // time, not UTC — a bare "YYYY-MM-DD" would roll back a day for negative-offset zones
              // (the exact bug class day.ts's addDays/parseLocal already guards against elsewhere).
              <option key={d} value={d}>{formatDateShort(`${d}T00:00:00`)}</option>
            ))}
          </select>
        </div>
      )}

      {errorMessage && <p className="err-line" role="alert" style={{ marginTop: 12 }}>{errorMessage}</p>}

      <div className="log-form-actions" style={{ gap: 10, marginTop: 16 }}>
        {session && (
          <button className="btn ghost" type="button" style={{ marginRight: 'auto' }} onClick={() => setConfirmingDelete(true)} disabled={pending}>
            {del.isPending ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <button className="btn ghost" type="button" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button className="btn" type="button" onClick={() => void (session ? handleSave() : handleAdd())} disabled={pending}>
          {session ? (update.isPending ? 'Saving…' : 'Save') : (create.isPending ? 'Adding…' : 'Add session')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingTypeChange}
        title="Change session type?"
        message="Changing the session type clears Ozzie's coaching notes for this session."
        confirmLabel="Change type"
        pending={update.isPending}
        onConfirm={() => void confirmTypeChangeAndSave()}
        onCancel={() => setConfirmingTypeChange(false)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this session?"
        message="This can't be undone."
        pending={del.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
