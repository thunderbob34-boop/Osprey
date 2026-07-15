import { bestE1rmForLift } from '@/services/lift-analytics';
import type { LiftAnalytics } from '@/services/lift-analytics';

function analyticsWithPrs(prs: LiftAnalytics['prs']): LiftAnalytics {
  return { weekVolumeKg: 0, weekMuscleGroups: [], primaryLift: null, prs };
}

describe('bestE1rmForLift', () => {
  it("returns the rounded best e1RM for a lift that's in the athlete's top lifts", () => {
    const analytics = analyticsWithPrs([
      { exerciseName: 'Back Squat', bestE1rmKg: 205.4, achievedOn: '2026-07-01' },
    ]);
    expect(bestE1rmForLift(analytics, 'squat')).toBe(205);
  });

  it('returns null for a lift missing from analytics.prs (not in the top-5)', () => {
    const analytics = analyticsWithPrs([
      { exerciseName: 'Back Squat', bestE1rmKg: 205.4, achievedOn: '2026-07-01' },
    ]);
    expect(bestE1rmForLift(analytics, 'bench')).toBeNull();
  });

  it('maps each powerlifting lift to its canonical exercise name', () => {
    const analytics = analyticsWithPrs([
      { exerciseName: 'Back Squat', bestE1rmKg: 200, achievedOn: '2026-07-01' },
      { exerciseName: 'Bench Press', bestE1rmKg: 140, achievedOn: '2026-07-02' },
      { exerciseName: 'Deadlift', bestE1rmKg: 240, achievedOn: '2026-07-03' },
    ]);
    expect(bestE1rmForLift(analytics, 'squat')).toBe(200);
    expect(bestE1rmForLift(analytics, 'bench')).toBe(140);
    expect(bestE1rmForLift(analytics, 'deadlift')).toBe(240);
  });

  it('returns null when the athlete has no PRs at all', () => {
    expect(bestE1rmForLift(analyticsWithPrs([]), 'squat')).toBeNull();
  });
});
