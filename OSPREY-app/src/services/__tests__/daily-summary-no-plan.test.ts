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
    };
    const s = mapSession(session, noBrief, /* hasEverPlanned */ false);
    expect(s.type).toBe('Easy Run');
    expect(s.sessionType).toBe('run');
    expect(s.intensity).toBe('easy');
  });
});
