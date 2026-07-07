export interface LiftTemplate {
  id: string;
  label: string;
  exerciseNames: string[];
}

// Names must match `exercises.name` in the library (case-insensitive) —
// see supabase/migrations/20260628000001_initial_schema.sql and
// 20260702000019_expand_exercise_library.sql for the seeded exercise names.
export const LIFT_TEMPLATES: LiftTemplate[] = [
  {
    id: 'push',
    label: 'Push',
    exerciseNames: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Lateral Raise', 'Tricep Pushdown'],
  },
  {
    id: 'pull',
    label: 'Pull',
    exerciseNames: ['Pull-Up', 'Barbell Row', 'Seated Cable Row', 'Barbell Curl', 'Face Pull'],
  },
  {
    id: 'legs',
    label: 'Legs',
    exerciseNames: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Hip Thrust', 'Calf Raise'],
  },
  {
    id: 'upper',
    label: 'Upper Body',
    exerciseNames: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Lat Pulldown', 'Barbell Curl', 'Tricep Pushdown'],
  },
  {
    id: 'full',
    label: 'Full Body',
    exerciseNames: ['Back Squat', 'Bench Press', 'Barbell Row', 'Plank'],
  },
];

/** Muscle groups touched by the current exercise selection, for the diagram. */
export function getWorkedMuscleGroups(
  exerciseIds: string[],
  library: { id: string; muscleGroup: string }[],
): Set<string> {
  const byId = new Map(library.map((e) => [e.id, e.muscleGroup]));
  const groups = new Set<string>();
  for (const id of exerciseIds) {
    const group = byId.get(id);
    if (group) groups.add(group);
  }
  return groups;
}
