// fetchLiftAnalytics reads exercise_sets with embedded workout_logs/exercises.
// Every figure it produces is keyed by the workout's date, so a row whose
// embed came back empty used to carry started_at: '' all the way to the Stats
// PR card, which rendered it as "Est. 1RM · Invalid Date".

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockRows: unknown[] = [];

jest.mock('@/services/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'gte', 'not']) {
    builder[m] = jest.fn(() => builder);
  }
  // The query is awaited directly rather than via .then-able terminator.
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: mockRows, error: null });
  return { supabase: { from: jest.fn(() => builder) } };
});

import { fetchLiftAnalytics } from '@/services/lift-analytics';

const set = (weight: number, reps: number, startedAt: string | null, name = 'Back Squat') => ({
  reps,
  weight_kg: weight,
  workout_logs: startedAt === null ? [] : { started_at: startedAt, user_id: 'u1', deleted_at: null },
  exercises: { name, muscle_group: 'Legs' },
});

describe('fetchLiftAnalytics — rows with no usable workout date', () => {
  it('never produces a PR whose achievedOn cannot be parsed as a date', async () => {
    mockRows = [set(100, 5, null), set(90, 5, null, 'Deadlift')];
    const analytics = await fetchLiftAnalytics('u1');

    expect(analytics.prs).toHaveLength(0);
    for (const pr of analytics.prs) {
      expect(Number.isNaN(new Date(pr.achievedOn).getTime())).toBe(false);
    }
  });

  it('keeps the dated rows when only some are missing their workout', async () => {
    const dated = new Date(Date.now() - 3 * 86400000).toISOString();
    mockRows = [set(100, 5, null), set(120, 3, dated)];
    const analytics = await fetchLiftAnalytics('u1');

    expect(analytics.prs).toHaveLength(1);
    expect(analytics.prs[0].exerciseName).toBe('Back Squat');
    expect(Number.isNaN(new Date(analytics.prs[0].achievedOn).getTime())).toBe(false);
  });
});
