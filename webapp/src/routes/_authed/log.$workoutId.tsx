import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useSets, useWorkout, useCommitSet, useDeleteSet, useUpdateWorkout } from '../../features/log/queries';
import { useUnits } from '../../features/settings/queries';
import { SetsGrid } from '../../features/grid/SetsGrid';
import { ErrorPanel } from '../../components/ErrorPanel';
import { PageHeader } from '../../components/PageHeader';

function WorkoutEditor() {
  const { workoutId } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const workout = useWorkout(workoutId);
  const sets = useSets(workoutId);
  const units = useUnits(userId);
  const commit = useCommitSet(workoutId);
  const del = useDeleteSet(workoutId);
  const patch = useUpdateWorkout(workoutId);
  const [effortError, setEffortError] = useState<string | null>(null);

  if (workout.isPending || sets.isPending || units.isPending) return <p className="loading-line">Loading…</p>;
  if (workout.isError) return <ErrorPanel error={workout.error as Error} onRetry={() => void workout.refetch()} />;
  if (sets.isError) return <ErrorPanel error={sets.error as Error} onRetry={() => void sets.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="Lift"
        title={new Date(workout.data.started_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        sub="Rows save when you leave a cell. Enter duplicates the last set."
      />

      <SetsGrid
        units={units.data ?? 'imperial'}
        initialRows={(sets.data ?? []).map((s) => ({ dbId: s.id, exerciseId: s.exercise_id, exerciseName: s.exercises?.name ?? '', reps: s.reps, weightKg: s.weight_kg, rpe: s.rpe }))}
        onCommitRow={async (row, setNumber) => (await commit.mutateAsync({ dbId: row.dbId, exerciseId: row.exerciseId!, setNumber, reps: row.reps, weightKg: row.weightKg, rpe: row.rpe })).dbId}
        onDeleteRow={(dbId) => del.mutate(dbId)}
      />

      <div className="card" style={{ marginTop: 28, maxWidth: 620 }}>
        <div className="log-form" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="effort">Effort (1–10)</label>
            <input
              id="effort"
              inputMode="numeric"
              defaultValue={workout.data.perceived_effort ?? ''}
              onChange={() => setEffortError(null)}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') { patch.mutate({ perceived_effort: null }); return; }
                const n = Number(raw);
                if (!Number.isInteger(n) || n < 1 || n > 10) {
                  setEffortError('Effort must be a whole number from 1 to 10.');
                  e.target.value = workout.data.perceived_effort != null ? String(workout.data.perceived_effort) : '';
                  return;
                }
                patch.mutate({ perceived_effort: n });
              }}
            />
            {effortError && <p className="err-line" role="alert">{effortError}</p>}
          </div>
          <div className="field span-full">
            <label htmlFor="notes">Notes</label>
            <input
              id="notes"
              defaultValue={workout.data.notes ?? ''}
              onBlur={(e) => patch.mutate({ notes: e.target.value || null })}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/log/$workoutId')({ component: WorkoutEditor });
