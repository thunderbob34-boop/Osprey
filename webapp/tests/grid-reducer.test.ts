import { describe, it, expect } from 'vitest';
import { gridReducer, emptyGrid, setNumbers, dirtyCompleteRows, type GridState } from '../src/features/grid/reducer';

const EX_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const EX_B = 'bbbbbbbb-0000-4000-8000-000000000002';

function seeded(): GridState {
  let s = emptyGrid();
  s = gridReducer(s, { type: 'addRow' });
  const id = s.rows[0].localId;
  s = gridReducer(s, { type: 'editCell', localId: id, field: 'exercise', value: { exerciseId: EX_A, exerciseName: 'Bench Press' } });
  s = gridReducer(s, { type: 'editCell', localId: id, field: 'reps', value: { num: 8 } });
  s = gridReducer(s, { type: 'editCell', localId: id, field: 'weightKg', value: { num: 83.91 } });
  return s;
}

describe('gridReducer', () => {
  it('addRow appends an empty dirty row with unique localId', () => {
    let s = emptyGrid();
    s = gridReducer(s, { type: 'addRow' });
    s = gridReducer(s, { type: 'addRow' });
    expect(s.rows).toHaveLength(2);
    expect(s.rows[0].localId).not.toBe(s.rows[1].localId);
    expect(s.rows[1]).toMatchObject({ dbId: null, exerciseId: null, dirty: true });
  });

  it('editCell sets values and marks dirty', () => {
    const s = seeded();
    expect(s.rows[0]).toMatchObject({ exerciseName: 'Bench Press', reps: 8, weightKg: 83.91, dirty: true });
  });

  it('duplicateLast copies exercise+reps+weight into a new dirty row', () => {
    let s = seeded();
    s = gridReducer(s, { type: 'markSaved', localId: s.rows[0].localId, dbId: 'dddddddd-0000-4000-8000-000000000003' });
    s = gridReducer(s, { type: 'duplicateLast' });
    expect(s.rows).toHaveLength(2);
    expect(s.rows[1]).toMatchObject({ exerciseId: EX_A, reps: 8, weightKg: 83.91, dbId: null, dirty: true });
  });

  it('duplicateLast on empty grid is a no-op addRow', () => {
    const s = gridReducer(emptyGrid(), { type: 'duplicateLast' });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].exerciseId).toBeNull();
  });

  it('markSaved clears dirty and stores dbId', () => {
    let s = seeded();
    s = gridReducer(s, { type: 'markSaved', localId: s.rows[0].localId, dbId: 'dddddddd-0000-4000-8000-000000000003' });
    expect(s.rows[0]).toMatchObject({ dirty: false, dbId: 'dddddddd-0000-4000-8000-000000000003' });
  });

  it('load hydrates rows as clean', () => {
    const s = gridReducer(emptyGrid(), { type: 'load', rows: [
      { dbId: 'dddddddd-0000-4000-8000-000000000003', exerciseId: EX_A, exerciseName: 'Bench Press', reps: 8, weightKg: 83.91, rpe: 8 },
    ]});
    expect(s.rows[0]).toMatchObject({ dirty: false, dbId: 'dddddddd-0000-4000-8000-000000000003' });
  });

  it('setNumbers counts per exercise in row order', () => {
    let s = seeded();                                   // A
    s = gridReducer(s, { type: 'duplicateLast' });      // A
    s = gridReducer(s, { type: 'addRow' });             // B (after edit)
    const bId = s.rows[2].localId;
    s = gridReducer(s, { type: 'editCell', localId: bId, field: 'exercise', value: { exerciseId: EX_B, exerciseName: 'Row' } });
    s = gridReducer(s, { type: 'duplicateLast' });      // B
    const nums = setNumbers(s.rows);
    expect(nums.get(s.rows[0].localId)).toBe(1);
    expect(nums.get(s.rows[1].localId)).toBe(2);
    expect(nums.get(s.rows[2].localId)).toBe(1);
    expect(nums.get(s.rows[3].localId)).toBe(2);
  });

  it('dirtyCompleteRows returns only dirty rows with exercise and a value', () => {
    let s = seeded();                                   // dirty+complete
    s = gridReducer(s, { type: 'addRow' });             // dirty but empty
    expect(dirtyCompleteRows(s)).toHaveLength(1);
    s = gridReducer(s, { type: 'markSaved', localId: s.rows[0].localId, dbId: 'dddddddd-0000-4000-8000-000000000003' });
    expect(dirtyCompleteRows(s)).toHaveLength(0);
  });

  it('removeRow deletes by localId', () => {
    let s = seeded();
    s = gridReducer(s, { type: 'removeRow', localId: s.rows[0].localId });
    expect(s.rows).toHaveLength(0);
  });
});
