import { format } from 'date-fns';
import { supabase } from '@/services/supabase';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  plannedType: string | null;
  plannedDescription: string | null;
  completedTypes: string[];
  /** Race-hub event on this day (name), or null. */
  raceName: string | null;
}

function emptyDay(date: string): CalendarDay {
  return { date, plannedType: null, plannedDescription: null, completedTypes: [], raceName: null };
}

export async function fetchCalendarMonth(
  userId: string,
  year: number,
  month: number, // 0-indexed (JS Date convention)
): Promise<CalendarDay[]> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  // Local-date strings: toISOString() renders the previous day for UTC+
  // timezones, which would shift the whole month window.
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  const [sessionsRes, workoutsRes, racesRes] = await Promise.all([
    supabase
      .from('training_sessions')
      .select('session_date, session_type, description')
      .eq('user_id', userId)
      .gte('session_date', startStr)
      .lte('session_date', endStr),
    supabase
      .from('workout_logs')
      .select('started_at, session_type')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('started_at', start.toISOString())
      .lte('started_at', new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('race_events')
      .select('event_date, name')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('event_date', startStr)
      .lte('event_date', endStr),
  ]);

  // Throw instead of rendering an empty month — this also lets withCache fall
  // back to the last good copy instead of caching an empty result.
  if (sessionsRes.error) throw sessionsRes.error;
  if (workoutsRes.error) throw workoutsRes.error;
  if (racesRes.error) throw racesRes.error;

  const byDate = new Map<string, CalendarDay>();
  const getDay = (date: string): CalendarDay => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const fresh = emptyDay(date);
    byDate.set(date, fresh);
    return fresh;
  };

  for (const row of sessionsRes.data ?? []) {
    const day = getDay(row.session_date as string);
    // Keep the first planned session if a day has several (e.g. tri brick days).
    if (!day.plannedType) {
      day.plannedType = row.session_type;
      day.plannedDescription = row.description;
    }
  }

  for (const row of workoutsRes.data ?? []) {
    // started_at is a UTC timestamp — bucket by the athlete's local day, or an
    // evening workout lands on tomorrow's square.
    const date = format(new Date(row.started_at as string), 'yyyy-MM-dd');
    getDay(date).completedTypes.push(row.session_type as string);
  }

  for (const row of racesRes.data ?? []) {
    getDay(row.event_date as string).raceName = row.name as string;
  }

  // The workouts query window is extended by +24h to catch late-night
  // UTC-shifted workouts, which can bucket a workout onto a local day just
  // outside the requested month — filter those stray days back out.
  return Array.from(byDate.values()).filter((day) => day.date >= startStr && day.date <= endStr);
}
