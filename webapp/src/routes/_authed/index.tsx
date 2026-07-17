import { createFileRoute, Link } from '@tanstack/react-router';
import { useMonthSessions, useCompletions } from '../../features/calendar/queries';
import { useDailySummary, useTodayBrief } from '../../features/home/queries';
import { useUnits } from '../../features/settings/queries';
import { pickTodaySession, buildWeekStrip } from '../../features/home/model';
import { sameWeekDates } from '../../lib/session-edit';
import { toDateInputValue } from '../../lib/day';
import type { TrainingSession } from '../../lib/schemas';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/ErrorPanel';
import { Badge } from '../../components/Badge';
import { SESSION_TYPE_LABEL, INTENSITY_LABEL, formatMinutes, formatDistanceKm } from '../../lib/format';

// Shared week-query state, threaded into both TodayHero and WeekStrip so the
// month/completions fetch in DashboardPage happens exactly once.
interface WeekSlice {
  weekSessions: TrainingSession[];
  todayISO: string;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
}

function TodayHero({ userId, weekSessions, todayISO, isPending, isError, error, onRetry }: WeekSlice & { userId: string }) {
  // Independent of the shared week query — owns its own loading/error (silently absent if it fails).
  const brief = useTodayBrief(userId);
  const units = useUnits(userId);

  if (isError) return <ErrorPanel error={error ?? new Error('Could not load today.')} onRetry={onRetry} />;
  if (isPending) return <p className="loading-line">Loading…</p>;

  const todaySession = pickTodaySession(weekSessions, todayISO);

  return (
    <>
      {todaySession ? (
        <div className="detail-card">
          <div className="tag">Today</div>
          <h3>{SESSION_TYPE_LABEL[todaySession.session_type]}</h3>
          <p>
            <Badge variant="amber">{INTENSITY_LABEL[todaySession.intensity]}</Badge>
            {[formatMinutes(todaySession.planned_minutes), formatDistanceKm(todaySession.planned_distance_km, units.data ?? 'imperial')]
              .filter(Boolean)
              .map((m) => ` · ${m}`)}
          </p>
          {todaySession.description && <p>{todaySession.description}</p>}
        </div>
      ) : (
        <div className="detail-card">
          <div className="tag">Today</div>
          <p>Rest day — nothing scheduled.</p>
        </div>
      )}

      {todaySession?.ozzie_notes && (
        <div className="ozzie-note">
          <span className="tag">Ozzie</span>
          <p>{todaySession.ozzie_notes}</p>
        </div>
      )}

      {brief.data && (
        <div className="ozzie-note">
          <span className="tag">Ozzie</span>
          <p>{brief.data}</p>
        </div>
      )}
    </>
  );
}

function StatBand({ userId }: { userId: string }) {
  const ds = useDailySummary(userId);
  const s = ds.data;
  if (!s) return null; // covers "no row yet", still loading, and query error alike — nothing to show

  const tiles: { num: string; lab: string; sub?: string | null }[] = [];
  if (s.recoveryScore != null) tiles.push({ num: String(s.recoveryScore), lab: 'Recovery', sub: s.recoveryRecommendation });
  if (s.tsb != null) tiles.push({ num: (s.tsb > 0 ? '+' : '') + s.tsb, lab: 'Form (TSB)' });
  if (s.weekDistanceKm != null) tiles.push({ num: `${Math.round(s.weekDistanceKm)} km`, lab: 'This week' });
  if (s.workoutsLast30d != null) tiles.push({ num: String(s.workoutsLast30d), lab: 'Last 30 days' });
  if (tiles.length === 0) return null;

  return (
    <div className="stat-band" style={{ marginBottom: 0 }}>
      {tiles.map((t) => (
        <div className="stat" key={t.lab}>
          <div className="num">{t.num}</div>
          <div className="lab">{t.lab}</div>
          {t.sub && <div className="lab">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function WeekStrip({ weekSessions, completedIds, todayISO, isPending, isError, error, onRetry }: WeekSlice & { completedIds: Set<string> }) {
  return (
    <div className="detail-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="tag" style={{ marginBottom: 0 }}>This week</div>
        <Link className="link-amber" to="/calendar">Open calendar ›</Link>
      </div>

      {isError ? (
        <ErrorPanel error={error ?? new Error('Could not load this week.')} onRetry={onRetry} />
      ) : isPending ? (
        <p className="loading-line">Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid var(--line)' }}>
          {buildWeekStrip(weekSessions, completedIds, todayISO).map((day, i) => (
            <div
              key={day.dateISO}
              style={{
                padding: '12px 10px',
                borderRight: i < 6 ? '1px solid var(--line)' : 'none',
                background: day.isToday ? 'rgba(200,121,58,0.07)' : 'transparent',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mut)', marginBottom: 8 }}>
                {new Date(`${day.dateISO}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              {day.session && (
                <Badge variant={day.done ? 'amber' : 'default'}>
                  {day.done ? '✓ ' : ''}{SESSION_TYPE_LABEL[day.session.session_type]}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const { userId } = Route.useRouteContext();
  const todayISO = toDateInputValue(new Date());
  const week = sameWeekDates(todayISO);
  const mondayISO = week[0];
  const sundayISO = week[6];

  // Fetched once here — shared by TodayHero (pickTodaySession) and WeekStrip (buildWeekStrip).
  const sessions = useMonthSessions(userId, mondayISO, sundayISO);
  const completions = useCompletions(userId, mondayISO, sundayISO);
  const weekSessions = sessions.data ?? [];
  const completedIds = completions.data ?? new Set<string>();
  const weekIsPending = sessions.isPending || completions.isPending;
  const weekIsError = sessions.isError || completions.isError;
  const weekError = (sessions.error ?? completions.error) as Error | null;
  const retryWeek = () => { void sessions.refetch(); void completions.refetch(); };

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={new Date(`${todayISO}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <TodayHero
          userId={userId}
          weekSessions={weekSessions}
          todayISO={todayISO}
          isPending={weekIsPending}
          isError={weekIsError}
          error={weekError}
          onRetry={retryWeek}
        />

        <StatBand userId={userId} />

        <WeekStrip
          weekSessions={weekSessions}
          completedIds={completedIds}
          todayISO={todayISO}
          isPending={weekIsPending}
          isError={weekIsError}
          error={weekError}
          onRetry={retryWeek}
        />
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/')({ component: DashboardPage });
