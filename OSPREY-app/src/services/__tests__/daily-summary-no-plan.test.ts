import { mapSession } from '@/services/daily-summary';
import type { TodaySessionRow } from '@/types/daily-summary';

// F-A (2026-07-21 experience audit, final whole-branch review): the Home
// no-plan copy that Task 5 fixed at the COMPONENT-default level was inert on
// the real fresh-account path, because a fresh account reaches this SERVICE
// mapping (which still emitted the false "still crunching" promise) before the
// component default ever applies. These tests pin the service-produced copy.

const noBrief = { text: null, whyReasoning: null, restRecommendation: null, habitTip: null };

describe('mapSession — no session today', () => {
  it('a genuinely fresh account (never planned) gets honest build-a-plan copy, not a false promise', () => {
    const s = mapSession(null, noBrief, /* hasEverPlanned */ false);
    expect(s.type).toBe('No Plan Yet');
    expect(s.ozzieNote).toMatch(/build your first week/i);
    expect(s.ozzieNote).not.toMatch(/still crunching/i);
    // sessionType null keeps the Home CTA on "Build My Plan" (routes to the
    // plan builder), not a phantom GPS run.
    expect(s.sessionType).toBeNull();
  });

  it('an established athlete with an empty day never sees the "still crunching" placeholder', () => {
    const s = mapSession(null, noBrief, /* hasEverPlanned */ true);
    expect(s.type).toBe('Nothing Scheduled');
    expect(s.ozzieNote).not.toMatch(/still crunching/i);
    expect(s.sessionType).toBeNull();
  });

  it('uses the real daily brief for an established athlete when one exists', () => {
    const brief = { text: 'Easy spin today to shake out the legs.', whyReasoning: 'TSB is low.', restRecommendation: null, habitTip: null };
    const s = mapSession(null, brief, /* hasEverPlanned */ true);
    expect(s.ozzieNote).toBe('Easy spin today to shake out the legs.');
  });

  it('a real planned session is unaffected by hasEverPlanned', () => {
    const session: TodaySessionRow = {
      id: 'sess-1',
      session_type: 'run',
      intensity: 'easy',
      planned_minutes: 30,
      planned_distance_km: 5,
      description: 'Easy Run',
      ozzie_notes: null,
      lift_prescription: null,
    };
    const s = mapSession(session, noBrief, /* hasEverPlanned */ false);
    expect(s.type).toBe('Easy Run');
    expect(s.sessionType).toBe('run');
    expect(s.intensity).toBe('easy');
  });

  it('a cardio session gets a Zone chip and no exercise list', () => {
    const run: TodaySessionRow = {
      id: 'r', session_type: 'run', intensity: 'threshold', planned_minutes: 40,
      planned_distance_km: 8, description: 'Threshold Run', ozzie_notes: null, lift_prescription: null,
    };
    const s = mapSession(run, noBrief, true);
    expect(s.zone).toBe('Zone 4');
    expect(s.exercises).toBeNull();
  });

  it('a strength session shows its exercises and NO cardio Zone chip', () => {
    const lift: TodaySessionRow = {
      id: 'l', session_type: 'lift', intensity: 'moderate', planned_minutes: 60,
      planned_distance_km: null, description: 'Lower Body Strength', ozzie_notes: null,
      lift_prescription: {
        exercises: [
          { name: 'Back Squat', sets: 3, reps: '8-12', note: 'Focus on form.' },
          { name: 'Romanian Deadlift', sets: 3, reps: '8-12', note: null },
        ],
      },
    };
    const s = mapSession(lift, noBrief, true);
    // "Zone N" is a cardio concept — a lift must not show it.
    expect(s.zone).toBeUndefined();
    expect(s.exercises).toEqual([
      { name: 'Back Squat', sets: 3, reps: '8-12' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-12' },
    ]);
  });
});
