import { supabase } from '@/services/supabase';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  plannedType: string | null;
  plannedDescription: string | null;
  completedTypes: string[];
}

export async function fetchCalendarMonth(
  userId: string,
  year: number,
  month: number, // 0-indexed (JS Date convention)
): Promise<CalendarDay[]> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

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
    const date = (row.started_at as string).slice(0, 10);
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
