import { sameWeekDates } from '../../lib/session-edit';
import type { TrainingSession } from '../../lib/schemas';

export function pickTodaySession(weekSessions: TrainingSession[], todayISO: string): TrainingSession | null {
  return weekSessions.find((s) => s.session_date === todayISO) ?? null;
}

export interface WeekDay {
  dateISO: string;
  session: TrainingSession | null;
  done: boolean;
  isToday: boolean;
}

export function buildWeekStrip(
  weekSessions: TrainingSession[],
  completedSessionIds: Set<string>,
  todayISO: string,
): WeekDay[] {
  return sameWeekDates(todayISO).map((dateISO) => {
    const session = weekSessions.find((s) => s.session_date === dateISO) ?? null;
    return { dateISO, session, done: session ? completedSessionIds.has(session.id) : false, isToday: dateISO === todayISO };
  });
}
