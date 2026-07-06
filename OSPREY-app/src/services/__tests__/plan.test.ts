import { computeRacePhase, currentWeekStartDate, type RaceGoal } from '@/services/plan';

// Hoisted above the import above by babel-plugin-jest-hoist, so the real
// supabase client (which throws without env vars configured) is never
// constructed when this module is required.
jest.mock('@/services/supabase', () => ({ supabase: {} }));

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('computeRacePhase', () => {
  const totalWeeks = 20;
  let today: Date;

  beforeEach(() => {
    today = new Date();
    today.setHours(0, 0, 0, 0);
  });

  it('returns null when targetDate is missing', () => {
    const goal: RaceGoal = { targetRace: 'Marathon', targetDate: null, totalWeeksPlanned: totalWeeks };
    expect(computeRacePhase(goal)).toBeNull();
  });

  it('returns null when totalWeeksPlanned is missing', () => {
    const goal: RaceGoal = { targetRace: 'Marathon', targetDate: '2026-01-01', totalWeeksPlanned: null };
    expect(computeRacePhase(goal)).toBeNull();
  });

  it('returns null when targetDate is not a valid date', () => {
    const goal: RaceGoal = { targetRace: 'Marathon', targetDate: 'not-a-date', totalWeeksPlanned: totalWeeks };
    expect(computeRacePhase(goal)).toBeNull();
  });

  it('classifies a race far in the future as Base phase', () => {
    // Race date == start of the plan -> currentWeekNumber 1 -> progress 5% (< 40%).
    const goal: RaceGoal = {
      targetRace: 'Marathon',
      targetDate: addDays(today, totalWeeks * 7),
      totalWeeksPlanned: totalWeeks,
    };
    const phase = computeRacePhase(goal);
    expect(phase).not.toBeNull();
    expect(phase!.phase).toBe('Base');
    expect(phase!.currentWeekNumber).toBe(1);
    expect(phase!.totalWeeks).toBe(totalWeeks);
  });

  it('classifies a race in the Build window (~50% through the plan)', () => {
    // currentWeekNumber = 10 of 20 -> progress 50% (between 40% and 75%).
    const goal: RaceGoal = {
      targetRace: 'Marathon',
      targetDate: addDays(today, 11 * 7 - 3),
      totalWeeksPlanned: totalWeeks,
    };
    const phase = computeRacePhase(goal);
    expect(phase!.phase).toBe('Build');
    expect(phase!.currentWeekNumber).toBe(10);
  });

  it('classifies a race in the Peak window (~85% through the plan)', () => {
    // currentWeekNumber = 17 of 20 -> progress 85% (between 75% and 90%).
    const goal: RaceGoal = {
      targetRace: 'Marathon',
      targetDate: addDays(today, 4 * 7 - 3),
      totalWeeksPlanned: totalWeeks,
    };
    const phase = computeRacePhase(goal);
    expect(phase!.phase).toBe('Peak');
    expect(phase!.currentWeekNumber).toBe(17);
  });

  it('classifies a race just days away as Taper phase', () => {
    const goal: RaceGoal = {
      targetRace: 'Marathon',
      targetDate: addDays(today, 3),
      totalWeeksPlanned: totalWeeks,
    };
    const phase = computeRacePhase(goal);
    expect(phase!.phase).toBe('Taper');
    expect(phase!.currentWeekNumber).toBe(totalWeeks);
    expect(phase!.weeksRemaining).toBe(1);
  });
});

describe('currentWeekStartDate', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    expect(currentWeekStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('always resolves to a Monday when re-parsed as a UTC date', () => {
    const dateStr = currentWeekStartDate();
    const [year, month, day] = dateStr.split('-').map(Number);
    const reparsed = new Date(Date.UTC(year, month - 1, day));
    // getUTCDay(): 0 = Sunday, 1 = Monday, ...
    expect(reparsed.getUTCDay()).toBe(1);
  });

  it('is on or before today (never a future Monday)', () => {
    const dateStr = currentWeekStartDate();
    const todayUTCStr = new Date().toISOString().slice(0, 10);
    expect(dateStr <= todayUTCStr).toBe(true);
  });
});
