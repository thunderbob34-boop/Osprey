export interface SetRow {
  localId: string; dbId: string | null; exerciseId: string | null; exerciseName: string;
  reps: number | null; weightKg: number | null; rpe: number | null; dirty: boolean;
}
export interface GridState { rows: SetRow[]; nextLocal: number; }
export type GridAction =
  | { type: 'load'; rows: Array<Omit<SetRow, 'localId' | 'dirty'>> }
  | { type: 'addRow' }
  | { type: 'duplicateLast' }
  | { type: 'editCell'; localId: string; field: 'exercise' | 'reps' | 'weightKg' | 'rpe'; value: { exerciseId?: string; exerciseName?: string; num?: number | null } }
  | { type: 'markSaved'; localId: string; dbId: string }
  | { type: 'removeRow'; localId: string };

export function emptyGrid(): GridState {
  return { rows: [], nextLocal: 1 };
}

function blankRow(localId: string): SetRow {
  return { localId, dbId: null, exerciseId: null, exerciseName: '', reps: null, weightKg: null, rpe: null, dirty: true };
}

export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'load':
      return {
        nextLocal: action.rows.length + 1,
        rows: action.rows.map((r, i) => ({ ...r, localId: `r${i + 1}`, dirty: false })),
      };
    case 'addRow':
      return { nextLocal: state.nextLocal + 1, rows: [...state.rows, blankRow(`r${state.nextLocal}`)] };
    case 'duplicateLast': {
      const last = state.rows[state.rows.length - 1];
      const row = last
        ? { ...blankRow(`r${state.nextLocal}`), exerciseId: last.exerciseId, exerciseName: last.exerciseName, reps: last.reps, weightKg: last.weightKg, rpe: last.rpe }
        : blankRow(`r${state.nextLocal}`);
      return { nextLocal: state.nextLocal + 1, rows: [...state.rows, row] };
    }
    case 'editCell':
      return {
        ...state,
        rows: state.rows.map((r) => {
          if (r.localId !== action.localId) return r;
          if (action.field === 'exercise') {
            return { ...r, exerciseId: action.value.exerciseId ?? null, exerciseName: action.value.exerciseName ?? '', dirty: true };
          }
          return { ...r, [action.field]: action.value.num ?? null, dirty: true };
        }),
      };
    case 'markSaved':
      return { ...state, rows: state.rows.map((r) => (r.localId === action.localId ? { ...r, dbId: action.dbId, dirty: false } : r)) };
    case 'removeRow':
      return { ...state, rows: state.rows.filter((r) => r.localId !== action.localId) };
  }
}

export function setNumbers(rows: SetRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  const out = new Map<string, number>();
  for (const r of rows) {
    const key = r.exerciseId ?? '∅';
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    out.set(r.localId, n);
  }
  return out;
}

export function dirtyCompleteRows(state: GridState): SetRow[] {
  return state.rows.filter((r) => r.dirty && r.exerciseId !== null && (r.reps !== null || r.weightKg !== null));
}
