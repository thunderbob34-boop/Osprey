import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useMonthSessions, useCompletions, useMonthRaceEvents, useNextRaceEvent, useBestRun,
  useGoalDistanceKm, useTuneUpWeeks,
} from '../../features/calendar/queries';
import { useLocationZip, useUserGoal } from '../../features/settings/queries';
import type { TrainingSession, RaceEvent } from '../../lib/schemas';
import { buildRacePredictor, formatRaceTimeSec } from '../../lib/predictions';
import { buildRunSignupSearchUrl } from '../../lib/racesearch';
import { computeRacePhase } from '../../lib/race-phase';
import { ErrorPanel } from '../../components/ErrorPanel';
import { PageHeader } from '../../components/PageHeader';
import { AddRaceForm } from '../../components/AddRaceForm';
import { SessionEditor } from '../../features/calendar/SessionEditor';
import { SESSION_TYPE_LABEL, INTENSITY_LABEL } from '../../lib/format';

const INTENSITY_COLOR: Record<string, string> = {
  easy: 'var(--mut)', moderate: 'var(--text-soft)', threshold: 'var(--amber)',
  interval: 'var(--amber-bright)', race: 'var(--danger)', rest: 'var(--line)',
};

function monthRange(anchor: Date): { fromISO: string; toISO: string; cells: Date[] } {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const start = new Date(first); start.setDate(first.getDate() - lead);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { fromISO: iso(cells[0]), toISO: iso(cells[41]), cells };
}

function daysUntil(dateISO: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateISO}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type Selection = { kind: 'session'; data: TrainingSession } | { kind: 'race'; data: RaceEvent } | null;

function CalendarPage() {
  const { userId } = Route.useRouteContext();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<Selection>(null);
  const [addingRace, setAddingRace] = useState<string | null>(null); // holds a default date, or null when closed
  const [editing, setEditing] = useState(false); // true = SessionEditor open for `selected`
  const [addDate, setAddDate] = useState<string | null>(null); // set = SessionEditor open in add mode for this date

  // Editing and an in-progress "add" form both key off the current selection: picking a
  // different session/race always exits edit mode, and — since the add affordance clears
  // `selected` when it opens — a real selection change also means the add form should close.
  // (Only clearing addDate when `selected` becomes truthy avoids fighting the add affordance's
  // own setAddDate(dISO) + setSelected(null) pair, which lands in the same batched render.)
  useEffect(() => {
    setEditing(false);
    if (selected) setAddDate(null);
  }, [selected]);

  const { fromISO, toISO, cells } = useMemo(() => monthRange(anchor), [anchor]);

  const sessions = useMonthSessions(userId, fromISO, toISO);
  const completions = useCompletions(userId, fromISO, toISO);
  const raceEvents = useMonthRaceEvents(userId, fromISO, toISO);
  const nextRace = useNextRaceEvent(userId);
  const bestRun = useBestRun(userId);
  const goalDistanceKm = useGoalDistanceKm(userId);
  const tuneUpWeeks = useTuneUpWeeks(sessions.data, goalDistanceKm.data);
  const locationZip = useLocationZip(userId);
  const userGoal = useUserGoal(userId);

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sessionsByDate = useMemo(() => {
    const m = new Map<string, TrainingSession[]>();
    for (const s of sessions.data ?? []) { const arr = m.get(s.session_date) ?? []; arr.push(s); m.set(s.session_date, arr); }
    return m;
  }, [sessions.data]);
  const racesByDate = useMemo(() => {
    const m = new Map<string, RaceEvent[]>();
    for (const r of raceEvents.data ?? []) { const arr = m.get(r.event_date) ?? []; arr.push(r); m.set(r.event_date, arr); }
    return m;
  }, [raceEvents.data]);
  const tuneUpBySessionId = useMemo(() => new Map(tuneUpWeeks.map((t) => [t.sessionId, t])), [tuneUpWeeks]);

  const predictor = bestRun.data ? buildRacePredictor(bestRun.data.miles, bestRun.data.timeS) : null;
  const selectedTuneUp = selected?.kind === 'session' ? tuneUpBySessionId.get(selected.data.id) : undefined;
  const isRunGoal = ['run', 'ultra', 'triathlon'].includes(userGoal.data?.primaryGoal ?? '');
  const phaseInfo = userGoal.data
    ? computeRacePhase({
        targetRace: userGoal.data.targetRace,
        targetDate: userGoal.data.targetDate,
        totalWeeksPlanned: userGoal.data.totalWeeksPlanned,
      })
    : null;

  if (sessions.isError) return <ErrorPanel error={sessions.error as Error} onRetry={() => void sessions.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Season" title="Calendar" />

      <div className="cal-layout">
        <section className="cal-main">
          <div className="cal-nav">
            <span className="month-title">{anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button className="btn ghost" type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>‹</button>
            <button className="btn ghost" type="button" onClick={() => setAnchor(new Date())}>Today</button>
            <button className="btn ghost" type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>›</button>
          </div>

          <div className="cal-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((d) => {
              const dISO = iso(d);
              const inMonth = d.getMonth() === anchor.getMonth();
              const daySessions = sessionsByDate.get(dISO) ?? [];
              const dayRaces = racesByDate.get(dISO) ?? [];
              return (
                <div key={dISO} className={inMonth ? 'cal-cell' : 'cal-cell out'}>
                  <span className="daynum">{d.getDate()}</span>
                  {dayRaces.map((r) => (
                    <button
                      key={r.id}
                      className={selected?.kind === 'race' && selected.data.id === r.id ? 'cal-chip race selected' : 'cal-chip race'}
                      type="button"
                      onClick={() => setSelected({ kind: 'race', data: r })}
                    >
                      ★ {r.name}
                    </button>
                  ))}
                  {daySessions.map((s) => {
                    const tuneUp = tuneUpBySessionId.get(s.id);
                    const isSelected = selected?.kind === 'session' && selected.data.id === s.id;
                    const cls = ['cal-chip', tuneUp && 'tuneup', isSelected && 'selected'].filter(Boolean).join(' ');
                    return (
                      <button
                        key={s.id}
                        className={cls}
                        type="button"
                        style={isSelected ? undefined : { color: INTENSITY_COLOR[s.intensity] ?? 'var(--text)' }}
                        onClick={() => setSelected({ kind: 'session', data: s })}
                      >
                        {tuneUp ? '◆ ' : ''}{completions.data?.has(s.id) ? '✓ ' : ''}{SESSION_TYPE_LABEL[s.session_type]}
                        {s.planned_minutes ? ` · ${s.planned_minutes}m` : ''}
                        {s.planned_distance_km ? ` · ${s.planned_distance_km}k` : ''}
                      </button>
                    );
                  })}
                  {inMonth && daySessions.length === 0 && (
                    <button
                      className="btn ghost"
                      type="button"
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '3px 6px', fontSize: 10.5 }}
                      onClick={() => { setAddDate(dISO); setSelected(null); }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="cal-aside">
          {nextRace.data && (
            <div className="race-countdown">
              <div className="days">T–{Math.max(0, daysUntil(nextRace.data.event_date))}</div>
              <div className="lab">Days to race</div>
              <div className="name">{nextRace.data.name}</div>
              <div className="meta">
                {new Date(`${nextRace.data.event_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {nextRace.data.distance_km ? ` · ${nextRace.data.distance_km}km` : ''}
                {nextRace.data.goal_time_s ? ` · Goal ${formatRaceTimeSec(nextRace.data.goal_time_s)}` : ''}
              </div>
            </div>
          )}

          {phaseInfo && (
            <div className="detail-card">
              <div className="tag">Training phase</div>
              <h3>{phaseInfo.phase}</h3>
              <p>Week {phaseInfo.currentWeekNumber} of {phaseInfo.totalWeeks} · {phaseInfo.weeksRemaining} to go</p>
            </div>
          )}

          {isRunGoal && (predictor ? (
            <div className="detail-card">
              <div className="tag">Race predictor</div>
              <p>From your best run in the last 12 weeks ({predictor.baseMiles.toFixed(1)} mi at {formatRaceTimeSec(predictor.basePaceSecPerMile)}/mi pace).</p>
              <table className="predictor-table">
                <thead><tr><th>Distance</th><th className="num">Predicted</th></tr></thead>
                <tbody>
                  {predictor.predictions.map((p) => (
                    <tr key={p.label}><td>{p.label}</td><td className="num">{formatRaceTimeSec(p.predictedTimeS)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : bestRun.isSuccess && (
            <div className="detail-card">
              <div className="tag">Race predictor</div>
              <p>Log a completed run with distance and time — including a tune-up race — and your predicted times for every distance show up here.</p>
            </div>
          ))}

          {selected?.kind === 'session' && (
            <>
              {editing ? (
                <SessionEditor
                  key={selected.data.id}
                  userId={userId}
                  session={selected.data}
                  monthSessions={sessions.data ?? []}
                  onDone={() => { setEditing(false); setSelected(null); }}
                />
              ) : (
                <div className="detail-card">
                  <div className="tag">{selected.data.session_date} · {INTENSITY_LABEL[selected.data.intensity]}</div>
                  <h3>{SESSION_TYPE_LABEL[selected.data.session_type]}{completions.data?.has(selected.data.id) ? ' · Done ✓' : ''}</h3>
                  {selected.data.description && <p>{selected.data.description}</p>}
                  {selected.data.ozzie_notes && (
                    <div className="note-block">
                      <div className="tag">Ozzie</div>
                      <p>{selected.data.ozzie_notes}</p>
                    </div>
                  )}

                  {selectedTuneUp && (
                    <div className="note-block tuneup-block">
                      <div className="tag">Tune-up opportunity</div>
                      <p>This week's long run (≈{selectedTuneUp.plannedDistanceKm.toFixed(1)}km) is close to a {selectedTuneUp.label}.</p>
                      {locationZip.data ? (
                        <a
                          className="btn small"
                          href={buildRunSignupSearchUrl({ zip: locationZip.data, ladderKm: selectedTuneUp.ladderKm, centerDateISO: selectedTuneUp.sessionDate })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Find a race near you
                        </a>
                      ) : locationZip.isError ? (
                        <p className="err-line">Couldn't check your saved zip code. Try reloading.</p>
                      ) : (
                        <p className="err-line">Set a zip code in Settings to search for races near you.</p>
                      )}
                      {' '}
                      <button className="btn ghost small" type="button" onClick={() => setAddingRace(selectedTuneUp.sessionDate)}>
                        Add the race you found
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button className="btn ghost small" type="button" onClick={() => setEditing((e) => !e)}>
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </>
          )}

          {selected?.kind === 'race' && (
            <div className="detail-card">
              <div className="tag">{selected.data.event_date}</div>
              <h3>{selected.data.name}</h3>
              <p>
                {selected.data.distance_km ? `${selected.data.distance_km}km` : 'Distance TBD'}
                {selected.data.goal_time_s ? ` · Goal ${formatRaceTimeSec(selected.data.goal_time_s)}` : ''}
                {selected.data.result_time_s ? ` · Result ${formatRaceTimeSec(selected.data.result_time_s)}` : ''}
              </p>
              {selected.data.notes && <p style={{ marginTop: 10 }}>{selected.data.notes}</p>}
            </div>
          )}

          {addDate !== null && (
            <SessionEditor
              key={addDate}
              userId={userId}
              addDate={addDate}
              monthSessions={sessions.data ?? []}
              onDone={() => setAddDate(null)}
            />
          )}

          {!selected && !addDate && (
            <p style={{ color: 'var(--mut)', fontSize: 13.5 }}>Select a session or race on the calendar to see details.</p>
          )}

          <div className="detail-card">
            {addingRace !== null ? (
              <>
                <div className="tag">Add a race</div>
                <AddRaceForm userId={userId} defaultDate={addingRace || undefined} onDone={() => setAddingRace(null)} />
              </>
            ) : (
              <button className="btn ghost small" type="button" onClick={() => setAddingRace('')}>+ Add a race</button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/calendar')({ component: CalendarPage });
