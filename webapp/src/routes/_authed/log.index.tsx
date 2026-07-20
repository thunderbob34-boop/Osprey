import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCreateWorkout, useWeekSessions } from '../../features/log/queries';
import { PageHeader } from '../../components/PageHeader';
import { SESSION_TYPE_LABEL } from '../../lib/format';
import { friendlyMessage } from '../../lib/errorMessage';

function LogLauncher() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const create = useCreateWorkout(userId);
  const sessions = useWeekSessions(userId);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [sessionId, setSessionId] = useState<string>('');

  async function start() {
    const w = await create.mutateAsync({ startedAt: new Date(startedAt).toISOString(), sessionId: sessionId || null });
    void navigate({ to: '/log/$workoutId', params: { workoutId: w.id } });
  }

  return (
    <>
      <PageHeader eyebrow="Log a lift" title="What are you lifting?" sub="Start a session, then log sets as you go — every row saves the moment you tab away." />

      <div className="card" style={{ maxWidth: 520 }}>
        <div className="log-form" style={{ marginBottom: 20 }}>
          <div className="field">
            <label htmlFor="started-at">Started at</label>
            <input id="started-at" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </div>
          <div className="field span-full">
            <label htmlFor="session-link">Link to plan session (optional)</label>
            <select id="session-link" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">— none —</option>
              {(sessions.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.session_date} · {SESSION_TYPE_LABEL[s.session_type]}{s.description ? ` · ${s.description}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {create.isError && <p className="err-line" role="alert" style={{ marginBottom: 14 }}>{friendlyMessage(create.error)}</p>}
        <div className="log-form-actions">
          <button className="btn" type="button" onClick={() => void start()} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Start logging'}
          </button>
        </div>
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/log/')({ component: LogLauncher });
