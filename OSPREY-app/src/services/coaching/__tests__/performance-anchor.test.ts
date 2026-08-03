import { deriveRunAnchorProposal, deriveRowAnchorProposal } from '@/services/coaching/performance-anchor';
import type { HealthKitWorkout } from '@/services/healthkit';

// Fixture builder — only the fields deriveRunAnchorProposal/deriveRowAnchorProposal
// actually read are meaningful; endedAt/calories are along for the ride to match
// HealthKitWorkout's shape.
function workout(overrides: Partial<HealthKitWorkout>): HealthKitWorkout {
  return {
    externalId: 'w-default',
    activityName: 'Running',
    startedAt: '2026-06-01T08:00:00.000Z',
    endedAt: '2026-06-01T08:30:00.000Z',
    durationS: 1800,
    distanceMeters: 5000,
    calories: 300,
    ...overrides,
  };
}

const METERS_PER_MILE = 1609.344;
function runWorkout(id: string, miles: number, timeS: number, startedAt = '2026-06-01T08:00:00.000Z'): HealthKitWorkout {
  return workout({ externalId: id, activityName: 'Running', distanceMeters: miles * METERS_PER_MILE, durationS: timeS, startedAt });
}
function rowWorkout(id: string, km: number, timeS: number, startedAt = '2026-06-01T08:00:00.000Z'): HealthKitWorkout {
  return workout({ externalId: id, activityName: 'Rowing', distanceMeters: km * 1000, durationS: timeS, startedAt });
}

describe('deriveRunAnchorProposal', () => {
  it('derives a run anchor from 3+ qualifying efforts, ≥1.5mi best effort', () => {
    const workouts = [
      runWorkout('a', 6, 48 * 60), // 8:00/mi
      runWorkout('b', 3, 27 * 60), // 9:00/mi
      runWorkout('c', 4, 32 * 60), // 8:00/mi
    ];
    const proposal = deriveRunAnchorProposal(workouts);
    expect(proposal).not.toBeNull();
    expect(proposal!.key).toBe('run');
    expect(proposal!.qualifyingEffortCount).toBe(3);
    // Threshold should land in the same plausible band parseRunBaseline enforces.
    expect(proposal!.value).toBeGreaterThan(240);
    expect(proposal!.value).toBeLessThan(900);
    expect(['a', 'b', 'c']).toContain(proposal!.derivedFrom.externalId);
  });

  // healthkit-import.ts maps Walking/Hiking to session_type 'run' for LOAD
  // ACCOUNTING — correct there, wrong here: a walk's pace has no business
  // anchoring a threshold pace. This is the exact poisoned-threshold trap.
  it('excludes Walking and Hiking even though healthkit-import.ts treats them as runs', () => {
    const workouts = [
      runWorkout('real-1', 6, 48 * 60),
      runWorkout('real-2', 4, 32 * 60),
      workout({ externalId: 'walk-1', activityName: 'Walking', distanceMeters: 3 * METERS_PER_MILE, durationS: 45 * 60 }),
      workout({ externalId: 'hike-1', activityName: 'Hiking', distanceMeters: 5 * METERS_PER_MILE, durationS: 90 * 60 }),
    ];
    // Only 2 real Running workouts qualify — below the sufficiency gate — even
    // though 4 total workouts exist. If Walking/Hiking were wrongly included,
    // this would clear the gate (4 >= 3) and return a proposal.
    const proposal = deriveRunAnchorProposal(workouts);
    expect(proposal).toBeNull();
  });

  it('returns no proposal below the sufficiency gate (only 2 qualifying workouts)', () => {
    const workouts = [runWorkout('a', 6, 48 * 60), runWorkout('b', 4, 32 * 60)];
    expect(deriveRunAnchorProposal(workouts)).toBeNull();
  });

  it('returns no proposal when the best effort is under 1.5mi even with enough workouts', () => {
    const workouts = [runWorkout('a', 1.1, 9 * 60), runWorkout('b', 1.2, 10 * 60), runWorkout('c', 1.0, 8 * 60)];
    expect(deriveRunAnchorProposal(workouts)).toBeNull();
  });

  it('returns no proposal when the derived value fails the plausibility band (absurdly fast)', () => {
    // 2mi in 6min = 3:00/mi average — far outside any plausible threshold.
    const workouts = [runWorkout('a', 2, 6 * 60), runWorkout('b', 2, 6 * 60), runWorkout('c', 2, 6 * 60)];
    expect(deriveRunAnchorProposal(workouts)).toBeNull();
  });

  // selectBestRunEffort picks by projected-threshold QUALITY, not distance — a
  // deliberate prior fix (anchor.ts). Pin that this caller doesn't regress it
  // back to "pick the longest run".
  it('picks the best-projecting effort, not the longest', () => {
    const workouts = [
      runWorkout('long-slow', 10, 100 * 60), // 10:00/mi
      runWorkout('filler', 3, 30 * 60), // 10:00/mi
      runWorkout('short-fast', 2, 12 * 60), // 6:00/mi
    ];
    const proposal = deriveRunAnchorProposal(workouts);
    expect(proposal).not.toBeNull();
    expect(proposal!.derivedFrom.externalId).toBe('short-fast');
  });

  it('derives high confidence from ≥8 weeks of regular running history (the WS1 acceptance case)', () => {
    const workouts: HealthKitWorkout[] = [];
    for (let week = 0; week < 8; week++) {
      const day = week * 7;
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString();
      workouts.push(runWorkout(`w${week}a`, 5, 45 * 60, date));
      workouts.push(runWorkout(`w${week}b`, 3, 27 * 60, date));
    }
    const proposal = deriveRunAnchorProposal(workouts);
    expect(proposal).not.toBeNull();
    expect(proposal!.confidence).toBe('high');
  });
});

describe('deriveRunAnchorProposal / deriveRowAnchorProposal — swim and bike stay self-report', () => {
  // Neither function has a swim/bike counterpart at all — this module derives
  // run and row only (swim CSS needs a 400/200 TT pair, bike FTP needs power;
  // neither is in a HealthKit workout sample). Feeding only Swimming activity
  // proves neither derivation path picks it up.
  it('returns null for a workout history containing only Swimming activities', () => {
    const workouts = [
      workout({ externalId: 's1', activityName: 'Swimming', distanceMeters: 2000, durationS: 2400 }),
      workout({ externalId: 's2', activityName: 'Swimming', distanceMeters: 2000, durationS: 2400 }),
      workout({ externalId: 's3', activityName: 'Swimming', distanceMeters: 2000, durationS: 2400 }),
    ];
    expect(deriveRunAnchorProposal(workouts)).toBeNull();
    expect(deriveRowAnchorProposal(workouts)).toBeNull();
  });
});

describe('deriveRowAnchorProposal', () => {
  it('derives a row anchor from 3+ qualifying rowing efforts', () => {
    const workouts = [rowWorkout('a', 5, 22 * 60), rowWorkout('b', 2, 9 * 60), rowWorkout('c', 6, 26 * 60)];
    const proposal = deriveRowAnchorProposal(workouts);
    expect(proposal).not.toBeNull();
    expect(proposal!.key).toBe('row');
    expect(proposal!.qualifyingEffortCount).toBe(3);
    expect(proposal!.value).toBeGreaterThanOrEqual(80);
    expect(proposal!.value).toBeLessThanOrEqual(180);
  });

  it('returns no proposal below the sufficiency gate', () => {
    const workouts = [rowWorkout('a', 5, 22 * 60), rowWorkout('b', 2, 9 * 60)];
    expect(deriveRowAnchorProposal(workouts)).toBeNull();
  });
});
