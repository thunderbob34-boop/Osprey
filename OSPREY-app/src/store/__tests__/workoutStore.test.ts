import { useWorkoutStore, formatPace } from '@/store/workoutStore';

function seedExercise() {
  useWorkoutStore.setState({
    liftExercises: [
      {
        exerciseId: 'bench',
        name: 'Bench Press',
        sets: [{ setNumber: 1, reps: 8, weightLbs: 135, completed: false }],
      },
    ],
  });
}

describe('updateLiftSet', () => {
  beforeEach(() => {
    useWorkoutStore.setState(useWorkoutStore.getState());
    seedExercise();
  });

  it('applies a single field update', () => {
    useWorkoutStore.getState().updateLiftSet(0, 0, 'weightLbs', 185);
    expect(useWorkoutStore.getState().liftExercises[0].sets[0]).toMatchObject({
      weightLbs: 185,
      reps: 8,
    });
  });

  it('preserves both fields when two updates fire synchronously (voice-log regression)', () => {
    // The 2026-07-14 audit bug: voice logging called a closure-based updater
    // twice back-to-back (weight, then reps). Both calls read the same stale
    // render-time snapshot, so the second call clobbered the first — weight
    // silently reverted to its old value. updateLiftSet reads from the store's
    // live state instead, so both updates survive.
    const { updateLiftSet } = useWorkoutStore.getState();
    updateLiftSet(0, 0, 'weightLbs', 185);
    updateLiftSet(0, 0, 'reps', 10);
    expect(useWorkoutStore.getState().liftExercises[0].sets[0]).toMatchObject({
      weightLbs: 185,
      reps: 10,
    });
  });

  it('does not affect other exercises or sets', () => {
    useWorkoutStore.setState({
      liftExercises: [
        { exerciseId: 'bench', name: 'Bench', sets: [{ setNumber: 1, reps: 8, weightLbs: 135, completed: false }, { setNumber: 2, reps: 8, weightLbs: 135, completed: false }] },
        { exerciseId: 'squat', name: 'Squat', sets: [{ setNumber: 1, reps: 5, weightLbs: 225, completed: false }] },
      ],
    });
    useWorkoutStore.getState().updateLiftSet(0, 1, 'weightLbs', 145);
    const state = useWorkoutStore.getState();
    expect(state.liftExercises[0].sets[0].weightLbs).toBe(135);
    expect(state.liftExercises[0].sets[1].weightLbs).toBe(145);
    expect(state.liftExercises[1].sets[0].weightLbs).toBe(225);
  });
});

describe('formatPace', () => {
  it('formats a normal pace', () => {
    expect(formatPace(510)).toBe('8:30');
  });

  it('never emits an invalid M:60 (audit regression)', () => {
    // 539.6 s/mi: floor(539.6/60)=8, round(539.6%60)=round(59.6)=60 under the
    // old independent-rounding logic, producing the invalid "8:60".
    expect(formatPace(539.6)).toBe('9:00');
  });

  it('returns the placeholder for non-finite or non-positive input', () => {
    expect(formatPace(0)).toBe('--:--');
    expect(formatPace(-5)).toBe('--:--');
    expect(formatPace(NaN)).toBe('--:--');
  });
});
