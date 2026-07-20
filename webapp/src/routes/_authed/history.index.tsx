import { useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useHistory, PAGE_SIZE } from '../../features/history/queries';
import { SessionTypeEnum } from '../../lib/schemas';
import { useUserProfile } from '../../lib/useAuthUser';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { ErrorPanel } from '../../components/ErrorPanel';
import { EmptyState } from '../../components/EmptyState';
import { SESSION_TYPE_LABEL, STATUS_LABEL, formatSeconds, formatDistanceKm, formatDateShort } from '../../lib/format';
import type { UnitSystem } from '../../lib/units';

function HistoryPage() {
  const { userId } = Route.useRouteContext();
  const { data: profile } = useUserProfile();
  const units: UnitSystem = profile?.units ?? 'imperial';

  const [type, setType] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const q = useHistory(userId, { type, from, to, page });

  const completed = (q.data?.rows ?? []).filter((r) => r.status === 'completed');
  const totalDistanceKm = completed.reduce((sum, r) => sum + (r.total_distance_km ?? 0), 0);
  const efforts = completed.map((r) => r.perceived_effort).filter((e): e is number => e != null);
  const avgEffort = efforts.length ? (efforts.reduce((a, b) => a + b, 0) / efforts.length).toFixed(1) : '—';

  return (
    <>
      <PageHeader eyebrow="Every session" title="History" sub="Everything you've logged, most recent first." />

      <div className="filter-row">
        <select value={type ?? ''} onChange={(e) => { setType(e.target.value || null); setPage(0); }}>
          <option value="">All types</option>
          {SessionTypeEnum.options.map((t) => <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>)}
        </select>
        <input type="date" value={from ?? ''} onChange={(e) => { setFrom(e.target.value || null); setPage(0); }} />
        <input type="date" value={to ?? ''} onChange={(e) => { setTo(e.target.value || null); setPage(0); }} />
      </div>

      {q.isError && <ErrorPanel error={q.error as Error} onRetry={() => void q.refetch()} />}
      {q.isPending && <p className="loading-line">Loading…</p>}

      {q.data && (
        <>
          <div className="stat-band">
            <div className="stat"><div className="num">{q.data.count}</div><div className="lab">Sessions logged</div></div>
            <div className="stat"><div className="num">{formatDistanceKm(totalDistanceKm, units) ?? '0'}</div><div className="lab">Total distance</div></div>
            <div className="stat"><div className="num">{avgEffort}</div><div className="lab">Avg effort</div></div>
          </div>

          {q.data.rows.length === 0 ? (
            <EmptyState title="No workouts match" body="Try clearing the filters, or log your first session." />
          ) : (
            <>
              <div className="table-scroll">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th className="num">Duration</th>
                      <th className="num">Distance</th>
                      <th className="num">Effort</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.rows.map((w) => (
                      <tr key={w.id}>
                        <td><Link className="link-amber" to="/history/$workoutId" params={{ workoutId: w.id }}>{formatDateShort(w.started_at)}</Link></td>
                        <td><Badge variant={w.session_type === 'rest' ? 'muted' : 'amber'}>{SESSION_TYPE_LABEL[w.session_type]}</Badge></td>
                        <td>{STATUS_LABEL[w.status]}</td>
                        <td className="num">{formatSeconds(w.total_duration_s) ?? '—'}</td>
                        <td className="num">{formatDistanceKm(w.total_distance_km, units) ?? '—'}</td>
                        <td className="num">{w.perceived_effort ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button className="btn ghost" type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                <span className="page-info">Page {page + 1} of {Math.max(1, Math.ceil(q.data.count / PAGE_SIZE))}</span>
                <button className="btn ghost" type="button" disabled={(page + 1) * PAGE_SIZE >= q.data.count} onClick={() => setPage((p) => p + 1)}>Next ›</button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export const Route = createFileRoute('/_authed/history/')({ component: HistoryPage });
