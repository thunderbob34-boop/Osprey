import { describe, it, expect } from 'vitest';
import { pickTodaySession, buildWeekStrip } from '../src/features/home/model';
import type { TrainingSession } from '../src/lib/schemas';

const S = (over: Partial<TrainingSession>): TrainingSession => ({
  id: 'i', week_id: 'w', user_id: 'u', session_date: '2026-07-14', session_type: 'run',
  intensity: 'easy', planned_minutes: 40, planned_distance_km: 8, description: null,
  ozzie_notes: null, created_at: '', updated_at: '', ...over,
});

describe('pickTodaySession', () => {
  it('returns the session dated today, else null', () => {
    const week = [S({ id: 'a', session_date: '2026-07-13' }), S({ id: 'b', session_date: '2026-07-14' })];
    expect(pickTodaySession(week, '2026-07-14')?.id).toBe('b');
    expect(pickTodaySession(week, '2026-07-16')).toBeNull();
  });
});

describe('buildWeekStrip', () => {
  it('returns 7 Mon-Sun days with the right session, done flag, and today marker', () => {
    const week = [S({ id: 'mon', session_date: '2026-07-13' }), S({ id: 'tue', session_date: '2026-07-14' })];
    const done = new Set(['mon']);
    const strip = buildWeekStrip(week, done, '2026-07-14');
    expect(strip.map((d) => d.dateISO)).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19',
    ]);
    expect(strip[0]).toMatchObject({ session: expect.objectContaining({ id: 'mon' }), done: true, isToday: false });
    expect(strip[1]).toMatchObject({ done: false, isToday: true });
    expect(strip[2]).toMatchObject({ session: null, done: false, isToday: false }); // empty day
  });
});
