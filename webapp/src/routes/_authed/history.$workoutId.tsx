import { Link, createFileRoute } from '@tanstack/react-router';
import { useWorkout, useSets } from '../../features/log/queries';
import { useUserProfile } from '../../lib/useAuthUser';
import { formatWeightKg } from '../../lib/units';
import { ErrorPanel } from '../../components/ErrorPanel';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { SESSION_TYPE_LABEL, formatSeconds, formatDistanceKm } from '../../lib/format';
import type { UnitSystem } from '../../lib/units';

function WorkoutDetail() {
  const { workoutId } = Route.useParams();
  const { data: profile } = useUserProfile();
  const units: UnitSystem = profile?.units ?? 'imperial';
  const workout = useWorkout(workoutId);
  const sets = useSets(workoutId);

  if (workout.isPending) return <p className="loading-line">Loading…</p>;
  if (workout.isError) return <ErrorPanel error={workout.error as Error} onRetry={() => void workout.refetch()} />;
  const w = workout.data;

  return (
    <>
      <PageHeader
        eyebrow={SESSION_TYPE_LABEL[w.session_type]}
        title={new Date(w.started_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        sub={[formatSeconds(w.total_duration_s), formatDistanceKm(w.total_distance_km, units), w.perceived_effort ? `Effort ${w.perceived_effort}/10` : null]
          .filter(Boolean).join(' · ') || undefined}
      />

      {w.session_type === 'lift' && (
        <>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Set</th>
                  <th className="num">Reps</th>
                  <th className="num">Weight</th>
                  <th className="num">RPE</th>
                </tr>
              </thead>
              <tbody>
                {(sets.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.exercises?.name ?? '—'}</td>
                    <td>{s.set_number}</td>
                    <td className="num">{s.reps ?? '—'}</td>
                    <td className="num">{s.weight_kg === null ? '—' : formatWeightKg(s.weight_kg, units)}</td>
                    <td className="num">{s.rpe ?? '—'}</td>
                  </tr>
                ))}
                {(sets.data ?? []).length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '20px 10px', color: 'var(--mut)' }}>No sets logged for this workout.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Link className="link-amber" to="/log/$workoutId" params={{ workoutId }}>Edit this workout</Link>
        </>
      )}

      {w.notes && (
        <div className="card" style={{ marginTop: 24, maxWidth: 620 }}>
          <div className="page-eyebrow" style={{ marginBottom: 10 }}>Notes</div>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.55 }}>{w.notes}</p>
        </div>
      )}

      {w.session_type !== 'lift' && !w.notes && (
        <p style={{ color: 'var(--mut)' }}>
          <Badge>{SESSION_TYPE_LABEL[w.session_type]}</Badge> session — no additional detail logged.
        </p>
      )}
    </>
  );
}

export const Route = createFileRoute('/_authed/history/$workoutId')({ component: WorkoutDetail });
