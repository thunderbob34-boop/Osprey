import { describe, it, expect } from 'vitest';
import { sameWeekDates, weekIdForDate, sessionUpdatePayload } from '../src/lib/session-edit';
import type { TrainingSession } from '../src/lib/schemas';

const S = (over: Partial<TrainingSession>): TrainingSession => ({
  id: 'i', week_id: 'w1', user_id: 'u', session_date: '2026-07-14', session_type: 'run',
  intensity: 'interval', planned_minutes: 60, planned_distance_km: 10, description: 'x',
  ozzie_notes: null, created_at: '', updated_at: '', ...over,
});

describe('sameWeekDates', () => {
  it('returns Mon–Sun of the containing week (Tue 2026-07-14)', () => {
    expect(sameWeekDates('2026-07-14')).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19',
    ]);
  });
  it('treats Sunday as the last day of its week (2026-07-19)', () => {
    expect(sameWeekDates('2026-07-19')[0]).toBe('2026-07-13');
    expect(sameWeekDates('2026-07-19')[6]).toBe('2026-07-19');
  });
});

describe('weekIdForDate', () => {
  const month = [S({ session_date: '2026-07-13', week_id: 'wA' }), S({ session_date: '2026-07-27', week_id: 'wB' })];
  it('borrows the week_id of a sibling in the same week', () => {
    expect(weekIdForDate('2026-07-16', month)).toBe('wA'); // Thu, same week as Mon 13
  });
  it('returns null when that week has no sessions', () => {
    expect(weekIdForDate('2026-08-10', month)).toBeNull();
  });
});

describe('sessionUpdatePayload', () => {
  const base = { intensity: 'easy', planned_minutes: 30, planned_distance_km: 5, description: 'd' };
  it('a non-type edit clears no coach fields', () => {
    const p = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'run', ...base });
    expect(p).toEqual({ session_type: 'run', intensity: 'easy', planned_minutes: 30, planned_distance_km: 5, description: 'd' });
    expect('fuel' in p).toBe(false);
  });
  it('run→lift clears ozzie_notes + interval_prescription, not lift_prescription', () => {
    const p = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'lift', ...base });
    expect(p.ozzie_notes).toBeNull();
    expect(p.fuel).toBeNull();
    expect(p.interval_prescription).toBeNull();
    expect('lift_prescription' in p).toBe(false);
  });
  it('lift→run clears ozzie_notes + lift_prescription, not interval_prescription', () => {
    const p = sessionUpdatePayload(S({ session_type: 'lift' }), { session_type: 'run', ...base });
    expect(p.ozzie_notes).toBeNull();
    expect(p.fuel).toBeNull();
    expect(p.lift_prescription).toBeNull();
    expect('interval_prescription' in p).toBe(false);
  });
  it('includes session_date only when provided (a move)', () => {
    const noMove = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'run', ...base });
    expect('session_date' in noMove).toBe(false);
    const move = sessionUpdatePayload(S({ session_type: 'run' }), { session_type: 'run', ...base, session_date: '2026-07-16' });
    expect(move.session_date).toBe('2026-07-16');
  });
});
