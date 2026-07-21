import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { Theme } from '@/constants/theme';

const BLOCK_DAYS = 7;
const DEFAULT_HOUR = 18; // 6pm fallback when we can't infer a usual time
const DEFAULT_DURATION_MIN = 45;
const CALENDAR_TITLE = 'OSPREY Workouts';

const enabledKey = (userId: string) => `osprey-calblock-enabled-${userId}`;
const calIdKey = (userId: string) => `osprey-calblock-calid-${userId}`;
// Maps training_session.id -> created calendar event id (device-local).
const mapKey = (userId: string) => `osprey-calblock-map-${userId}`;

export async function isCalendarBlockingEnabled(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(enabledKey(userId))) === 'true';
}

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function loadEventMap(userId: string): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(mapKey(userId));
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

async function saveEventMap(userId: string, map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(mapKey(userId), JSON.stringify(map));
}

async function resolveSource(): Promise<Partial<Calendar.Source>> {
  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.source) return def.source;
    } catch {
      // fall through to scanning calendars
    }
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications && c.source);
  if (writable?.source) return writable.source;
  return { isLocalAccount: true, name: 'OSPREY' };
}

/** Finds the OSPREY calendar created on a prior run, or creates a fresh one. */
async function getOrCreateOspreyCalendar(userId: string): Promise<string> {
  const stored = await AsyncStorage.getItem(calIdKey(userId));
  if (stored) {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.some((c) => c.id === stored)) return stored;
  }

  const source = await resolveSource();
  const newCalendarId = await Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: Theme.accent,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (source as Calendar.Source).id,
    source: source as Calendar.Source,
    name: CALENDAR_TITLE,
    ownerAccount: 'OSPREY',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  await AsyncStorage.setItem(calIdKey(userId), newCalendarId);
  return newCalendarId;
}

/** The OSPREY calendar id from a prior sync, or null if never created. */
export async function getOspreyCalendarId(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(calIdKey(userId));
}

/** Most common workout start hour over the last 30 days, default 6pm. */
export async function fetchUsualWorkoutHour(userId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase
    .from('workout_logs')
    .select('started_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('started_at', thirtyDaysAgo);

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    const hour = new Date(row.started_at as string).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  let bestHour = DEFAULT_HOUR;
  let bestCount = 0;
  for (const [hour, count] of counts) {
    if (count > bestCount) {
      bestHour = hour;
      bestCount = count;
    }
  }
  return bestCount >= 2 ? bestHour : DEFAULT_HOUR;
}

function upcomingDateStrings(days: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

async function clearAllBlocks(userId: string): Promise<void> {
  const map = await loadEventMap(userId);
  await Promise.all(
    Object.values(map).map((eventId) =>
      Calendar.deleteEventAsync(eventId).catch(() => undefined),
    ),
  );
  await saveEventMap(userId, {});
}

interface PlannedSession {
  id: string;
  session_date: string;
  session_type: string;
  planned_minutes: number | null;
  description: string | null;
  ozzie_notes: string | null;
}

/**
 * Re-derives calendar blocks from the next 7 days of planned, non-rest
 * sessions. Reconcile-style (clear + recreate) so reschedules and swaps are
 * always reflected. No-op when blocking is disabled. Safe to call on app open
 * and after the plan changes.
 */
export async function syncCalendarBlocks(userId: string): Promise<void> {
  if (!(await isCalendarBlockingEnabled(userId))) return;

  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status !== 'granted') return;

  await clearAllBlocks(userId);

  const dates = upcomingDateStrings(BLOCK_DAYS);
  const { data } = await supabase
    .from('training_sessions')
    .select('id, session_date, session_type, planned_minutes, description, ozzie_notes')
    .eq('user_id', userId)
    .gte('session_date', dates[0])
    .lte('session_date', dates[dates.length - 1])
    .neq('session_type', 'rest');

  const sessions = (data ?? []) as PlannedSession[];
  if (sessions.length === 0) return;

  const calendarId = await getOrCreateOspreyCalendar(userId);
  const hour = await fetchUsualWorkoutHour(userId);
  const map: Record<string, string> = {};

  for (const session of sessions) {
    const [y, m, d] = session.session_date.split('-').map(Number);
    const start = new Date(y, m - 1, d, hour, 0, 0, 0);
    if (start.getTime() < Date.now() - 86400000) continue; // skip well-past slots
    const durationMin = session.planned_minutes ?? DEFAULT_DURATION_MIN;
    const end = new Date(start.getTime() + durationMin * 60000);

    try {
      const eventId = await Calendar.createEventAsync(calendarId, {
        title: `OSPREY: ${session.description ?? session.session_type}`,
        startDate: start,
        endDate: end,
        notes: session.ozzie_notes ?? undefined,
        alarms: [{ relativeOffset: -30 }],
      });
      map[session.id] = eventId;
    } catch {
      // Skip a single failed event rather than aborting the whole sync.
    }
  }

  await saveEventMap(userId, map);
}

export async function enableCalendarBlocking(userId: string): Promise<boolean> {
  const granted = await requestCalendarPermission();
  if (!granted) return false;
  await AsyncStorage.setItem(enabledKey(userId), 'true');
  await syncCalendarBlocks(userId);
  return true;
}

export async function disableCalendarBlocking(userId: string): Promise<void> {
  await clearAllBlocks(userId);
  await AsyncStorage.setItem(enabledKey(userId), 'false');
}
