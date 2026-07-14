// calendar.ts imports the supabase client at module level for its fetch helper;
// the pure function under test never touches it.
jest.mock('@/services/supabase', () => ({ supabase: {} }));

import { clampDaysToMonth } from '@/services/calendar';
import type { CalendarDay } from '@/services/calendar';

function day(date: string): CalendarDay {
  return { date, plannedType: null, plannedDescription: null, completedTypes: [], raceName: null };
}

describe('clampDaysToMonth', () => {
  const startStr = '2026-07-01';
  const endStr = '2026-07-31';

  it('keeps days inside the month, including both boundaries', () => {
    const days = [day('2026-07-01'), day('2026-07-15'), day('2026-07-31')];
    expect(clampDaysToMonth(days, startStr, endStr).map((d) => d.date)).toEqual([
      '2026-07-01',
      '2026-07-15',
      '2026-07-31',
    ]);
  });

  it('drops a stray day after the month (the +24h UTC-window leak)', () => {
    const days = [day('2026-07-31'), day('2026-08-01')];
    expect(clampDaysToMonth(days, startStr, endStr).map((d) => d.date)).toEqual(['2026-07-31']);
  });

  it('drops a stray day before the month', () => {
    const days = [day('2026-06-30'), day('2026-07-01')];
    expect(clampDaysToMonth(days, startStr, endStr).map((d) => d.date)).toEqual(['2026-07-01']);
  });
});
