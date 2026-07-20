import { useReducer, useEffect, useRef, useState } from 'react';
import { gridReducer, emptyGrid, setNumbers, type SetRow } from './reducer';
import { formatWeightKg, parseWeightInput, kgToLb, type UnitSystem } from '../../lib/units';
import type { Exercise } from '../../lib/schemas';
import { useExerciseSearch } from '../log/queries';
import { Combobox } from '../../components/Combobox';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { friendlyMessage } from '../../lib/errorMessage';

interface Props {
  units: UnitSystem;
  initialRows: Array<Omit<SetRow, 'localId' | 'dirty'>>;
  onCommitRow: (row: SetRow, setNumber: number) => Promise<string>; // returns dbId
  onDeleteRow: (dbId: string) => void;
}

export function SetsGrid({ units, initialRows, onCommitRow, onDeleteRow }: Props) {
  const [state, dispatch] = useReducer(gridReducer, undefined, emptyGrid);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null); // row.localId pending delete confirmation
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current && initialRows.length) { dispatch({ type: 'load', rows: initialRows }); loaded.current = true; }
  }, [initialRows]);

  const nums = setNumbers(state.rows);
  const stateRef = useRef(state);
  stateRef.current = state;

  // A not-yet-saved row has dbId=null until its INSERT round-trips; a second
  // edit (e.g. select exercise, then immediately edit weight and blur) could
  // fire before that resolves and both would see dbId=null, INSERTing twice.
  // Serialize commits per row: a commit that arrives while one is already in
  // flight waits for it, then re-reads the row (now carrying the real dbId)
  // and retries as an UPDATE instead of racing a second INSERT.
  const pendingRef = useRef<Map<string, Promise<void>>>(new Map());

  async function commit(row: SetRow) {
    if (!row.dirty || !row.exerciseId || (row.reps === null && row.weightKg === null)) return;
    const { localId } = row;
    const existing = pendingRef.current.get(localId);
    if (existing) {
      await existing;
      const latest = stateRef.current.rows.find((r) => r.localId === localId);
      if (latest) await commit(latest);
      return;
    }
    const task = (async () => {
      try {
        const dbId = await onCommitRow(row, nums.get(localId) ?? 1);
        dispatch({ type: 'markSaved', localId, dbId });
        setErrors((e) => ({ ...e, [localId]: '' }));
      } catch (err) {
        setErrors((e) => ({ ...e, [localId]: friendlyMessage(err) }));
      }
    })();
    pendingRef.current.set(localId, task);
    try {
      await task;
    } finally {
      pendingRef.current.delete(localId);
    }
  }

  // Re-reads state at call time (via ref) rather than closing over a possibly-stale row —
  // e.g. selecting an exercise after reps/weight are already filled must still see them.
  function commitLatest(localId: string) {
    const row = stateRef.current.rows.find((r) => r.localId === localId);
    if (row) void commit(row);
  }

  function numCell(row: SetRow, field: 'reps' | 'rpe', cls: string) {
    return (
      <input
        inputMode="numeric"
        className={cls}
        defaultValue={row[field] ?? ''}
        onChange={(e) => dispatch({ type: 'editCell', localId: row.localId, field, value: { num: e.target.value ? Number(e.target.value) : null } })}
        onBlur={() => commitLatest(row.localId)}
      />
    );
  }

  // Only a saved (dbId-bearing) row needs confirmation — an unsaved row hasn't
  // persisted anything yet, so removing it locally is not a destructive action.
  function requestDelete(row: SetRow) {
    if (row.dbId) setConfirmingId(row.localId);
    else dispatch({ type: 'removeRow', localId: row.localId });
  }

  function confirmDelete() {
    const row = state.rows.find((r) => r.localId === confirmingId);
    if (row) {
      if (row.dbId) onDeleteRow(row.dbId);
      dispatch({ type: 'removeRow', localId: row.localId });
    }
    setConfirmingId(null);
  }

  return (
    <div>
      <div className="table-scroll">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Exercise</th>
            <th>Set</th>
            <th>Reps</th>
            <th>Weight ({units === 'imperial' ? 'lbs' : 'kg'})</th>
            <th>RPE</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.rows.map((row) => (
            <tr key={row.localId}>
              <td className="exercise-cell">
                <ExerciseCell
                  row={row}
                  dispatch={dispatch}
                  onSelect={(exerciseId, exerciseName) => void commit({ ...row, exerciseId, exerciseName, dirty: true })}
                />
              </td>
              <td className="num-col">{nums.get(row.localId)}</td>
              <td>{numCell(row, 'reps', 'w-reps')}</td>
              <td>
                <input
                  inputMode="decimal"
                  className="w-weight"
                  defaultValue={row.weightKg === null ? '' : units === 'imperial' ? kgToLb(row.weightKg) : row.weightKg}
                  onChange={(e) => dispatch({ type: 'editCell', localId: row.localId, field: 'weightKg', value: { num: parseWeightInput(e.target.value, units) } })}
                  onBlur={() => commitLatest(row.localId)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'duplicateLast' }); } }}
                />
              </td>
              <td>{numCell(row, 'rpe', 'w-rpe')}</td>
              <td>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Delete set"
                  onClick={() => requestDelete(row)}
                >
                  ✕
                </button>
                {row.dirty && <span className="dirty-dot" title="Unsaved">●</span>}
                {errors[row.localId] && <span role="alert" className="cell-error">{errors[row.localId]}</span>}
              </td>
            </tr>
          ))}
          {state.rows.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '20px 10px', color: 'var(--mut)' }}>No sets yet — add your first below.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <div className="grid-actions">
        <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'addRow' })}>+ Set</button>
        <button className="btn" type="button" onClick={() => dispatch({ type: 'duplicateLast' })}>Duplicate last (⏎)</button>
      </div>
      <p className="grid-hint">Rows save when you leave a cell · {formatWeightKg(100, units)} = 100kg reference</p>

      <ConfirmDialog
        open={confirmingId != null}
        title="Delete this set?"
        message="This can't be undone."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingId(null)}
      />
    </div>
  );
}

function ExerciseCell({ row, dispatch, onSelect }: { row: SetRow; dispatch: React.Dispatch<Parameters<typeof gridReducer>[1]>; onSelect: (exerciseId: string, exerciseName: string) => void }) {
  const [term, setTerm] = useState(row.exerciseName);
  const [open, setOpen] = useState(false);
  const search = useExerciseSearch(open ? term : '');

  function selectExercise(ex: Exercise) {
    setTerm(ex.name);
    dispatch({ type: 'editCell', localId: row.localId, field: 'exercise', value: { exerciseId: ex.id, exerciseName: ex.name } });
    onSelect(ex.id, ex.name);
  }

  return (
    <div>
      <Combobox
        value={term}
        onChange={setTerm}
        placeholder="Search exercise…"
        open={open}
        onOpenChange={setOpen}
        items={search.data ?? []}
        getKey={(ex) => ex.id}
        renderItem={(ex) => <>{ex.name}{ex.muscle_group ? <span className="muted"> · {ex.muscle_group}</span> : null}</>}
        onSelect={selectExercise}
      />
    </div>
  );
}
