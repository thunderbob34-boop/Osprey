// Schedule assistant: reads the day's calendar events (permission was already
// granted for calendar blocking) and, when a meeting collides with the user's
// usual training window, produces a compact summary — collision + concrete
// free windows — for the Ozzie daily brief. All computation happens on-device;
// the server only ever sees the summary string, never raw calendar data.

import * as Calendar from 'expo-calendar';
import {
  fetchUsualWorkoutHour,
  getOspreyCalendarId,
} from '@/services/calendar-blocking';

const TRAINING_WINDOW_MIN = 60;
const MIN_FREE_WINDOW_MIN = 45;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;

interface BusyBlock {
  title: string;
  start: Date;
  end: Date;
}

function formatTime(d: Date): string {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return minutes === 0 ? `${hours}${suffix.toLowerCase()}` : `${hours}:${String(minutes).padStart(2, '0')}${suffix.toLowerCase()}`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function fetchBusyBlocks(
  userId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<BusyBlock[]> {
  const ospreyCalId = await getOspreyCalendarId(userId);
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calendarIds = calendars
    .filter((c) => c.id !== ospreyCalId && c.title !== 'OSPREY Workouts')
    .map((c) => c.id);
  if (calendarIds.length === 0) return [];

  const events = await Calendar.getEventsAsync(calendarIds, dayStart, dayEnd);
  return events
    .filter((e) => !e.allDay)
    .map((e) => ({
      title: e.title || 'a meeting',
      start: new Date(e.startDate),
      end: new Date(e.endDate),
    }))
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Gaps between busy blocks within waking hours, ≥45 min, not already past. */
function findFreeWindows(busy: BusyBlock[], dayStart: Date, dayEnd: Date): Array<{ start: Date; end: Date }> {
  const now = new Date();
  const windows: Array<{ start: Date; end: Date }> = [];
  let cursor = dayStart;

  for (const block of busy) {
    if (block.start > cursor) windows.push({ start: cursor, end: block.start });
    if (block.end > cursor) cursor = block.end;
  }
  if (cursor < dayEnd) windows.push({ start: cursor, end: dayEnd });

  return windows
    .map((w) => ({ start: w.start < now ? now : w.start, end: w.end }))
    .filter((w) => (w.end.getTime() - w.start.getTime()) / 60000 >= MIN_FREE_WINDOW_MIN);
}

/**
 * A one-line schedule summary for the daily brief, or null when there is
 * nothing worth coaching about (no permission, no collision with the usual
 * training window, or calendar read fails). `dayOffset` 0 = today (morning
 * brief); pass 1 for tomorrow when the evening look-ahead brief lands.
 */
export async function getScheduleBriefSummary(
  userId: string,
  dayOffset: 0 | 1 = 0,
): Promise<string | null> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'granted') return null;

    const day = new Date();
    day.setDate(day.getDate() + dayOffset);
    const dayStart = new Date(day);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

    const [usualHour, busy] = await Promise.all([
      fetchUsualWorkoutHour(userId),
      fetchBusyBlocks(userId, dayStart, dayEnd),
    ]);
    if (busy.length === 0) return null;

    const windowStart = new Date(day);
    windowStart.setHours(usualHour, 0, 0, 0);
    const windowEnd = new Date(windowStart.getTime() + TRAINING_WINDOW_MIN * 60000);

    const conflict = busy.find((b) => overlaps(windowStart, windowEnd, b.start, b.end));
    if (!conflict) return null;

    const free = findFreeWindows(busy, dayStart, dayEnd)
      .filter((w) => !overlaps(w.start, w.end, conflict.start, conflict.end))
      .slice(0, 2);

    const dayLabel = dayOffset === 0 ? 'today' : 'tomorrow';
    const conflictPart = `Usual training window (~${formatTime(windowStart)}) collides with "${conflict.title}" (${formatTime(conflict.start)}–${formatTime(conflict.end)}) ${dayLabel}.`;
    const freePart =
      free.length > 0
        ? ` Free windows ${dayLabel}: ${free.map((w) => `${formatTime(w.start)}–${formatTime(w.end)}`).join(', ')}.`
        : ` No open window of ${MIN_FREE_WINDOW_MIN}+ minutes left ${dayLabel} — a shorter session may be the move.`;

    return conflictPart + freePart;
  } catch {
    return null;
  }
}
