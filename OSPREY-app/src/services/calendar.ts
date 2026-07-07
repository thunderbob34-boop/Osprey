import { supabase } from '@/services/supabase';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  plannedType: string | null;
  plannedDescription: string | null;
  completedTypes: string[];
}

/** YYYY-MM-DD for a Date's local calendar day — `toISOString()` converts to
 * UTC first, which shifts the boundary for any user east of UTC. */
function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function fetchCalendarMonth(
  userId: string,
  year: number,
  month: number, // 0-indexed (JS Date convention)
): Promise<CalendarDay[]> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  // training_sessions.session_date is a plain DATE column — compare against
  // local calendar dates, not the UTC-shifted string toISOString() would
  // produce (which dropped the month's last day for UTC+ users).
  const startStr = localDateString(start);
  const endStr = localDateString(end);

  const [sessionsRes, workoutsRes] = await Promise.all([
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
  ]);

  const byDate = new Map<string, CalendarDay>();

  for (const row of sessionsRes.data ?? []) {
    byDate.set(row.session_date as string, {
      date: row.session_date as string,
      plannedType: row.session_type,
      plannedDescription: row.description,
      completedTypes: [],
    });
  }

  for (const row of workoutsRes.data ?? []) {
    // Bucket by the local calendar day the workout happened on, not the UTC
    // slice of the timestamptz string — an evening workout was otherwise
    // showing up on the next day for users west of Greenwich.
    const date = localDateString(new Date(row.started_at as string));
    const existing = byDate.get(date) ?? {
      date,
      plannedType: null,
      plannedDescription: null,
      completedTypes: [],
    };
    existing.completedTypes.push(row.session_type as string);
    byDate.set(date, existing);
  }

  return Array.from(byDate.values());
}
