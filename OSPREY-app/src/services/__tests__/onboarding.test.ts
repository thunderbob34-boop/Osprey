import {
  ONBOARDING_GOAL_TO_PREFERENCES,
  buildPlanPreferences,
  toLongRunDay,
  weeksPlannedForRace,
  buildAnchorHistoryRows,
} from '@/services/onboarding';
import type { OnboardingDraft } from '@/types/onboarding';

function baseDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    displayName: 'Test Athlete',
    primaryGoal: 'hybrid',
    experienceTier: 'intermediate',
    weeklyRunDays: 3,
    weeklyLiftDays: 2,
    healthConnected: false,
    thresholdAnchor: null,
    raceGoal: null,
    bodyWeightKg: null,
    availableDays: [],
    longSessionDay: null,
    equipment: [],
    injuryHistory: null,
    anchorProposal: null,
    ...overrides,
  };
}

describe('buildPlanPreferences', () => {
  // Regression test for the onboarding clobber bug: buildPlanPreferences feeds
  // invokeGeneratePlan({ preferences }), and the edge function's plan-builder-branch
  // upsert writes `goal_params: (prefs.goalParams as unknown) ?? null` straight over
  // whatever completeOnboarding just inserted. If goalParams is dropped here, a real
  // ultra athlete's race params silently revert to 50k/untrained on the very next
  // background regeneration (daily-summary.ts's invokeGeneratePlan() on Home load).
  //
  // goalParams is the generic goal_params carrier (renamed from the ultra-only
  // ultraParams — see types/preferences.ts): this test pins that the rename didn't
  // change behavior for the ultra flow it was written for.
  it("carries an ultra draft's goalParams through unchanged, so the edge upsert re-persists it instead of nulling it", () => {
    const draft = baseDraft({
      primaryGoal: 'ultra',
      goalParams: { raceDistance: '100mi', vertGainM: 3000, gutTrained: true },
    });

    expect(buildPlanPreferences(draft).goalParams).toEqual({
      raceDistance: '100mi',
      vertGainM: 3000,
      gutTrained: true,
    });
  });

  // Same carry-through, now for a lift draft's 1RMs (StrengthGoalParams) — the
  // generalized case GoalParams widening exists for.
  it("carries a lift draft's goalParams (1RMs) through unchanged, so the edge upsert re-persists a lifter's maxes instead of nulling them", () => {
    const draft = baseDraft({
      primaryGoal: 'lift',
      goalParams: { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 } },
    });

    expect(buildPlanPreferences(draft).goalParams).toEqual({
      oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 },
    });
  });

  it('sends no goalParams blob for a non-ultra draft (null goalParams)', () => {
    const draft = baseDraft({ primaryGoal: 'hybrid', goalParams: null });

    expect(buildPlanPreferences(draft).goalParams).toBeNull();
  });

  it('sends no goalParams blob for a non-ultra draft (goalParams omitted)', () => {
    const draft = baseDraft({ primaryGoal: 'hybrid' });
    delete draft.goalParams;

    expect(buildPlanPreferences(draft).goalParams).toBeNull();
  });
});

describe('ONBOARDING_GOAL_TO_PREFERENCES', () => {
  it('maps the new sports to matching plan-builder goals', () => {
    expect(ONBOARDING_GOAL_TO_PREFERENCES.swim).toBe('swim');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.rowing).toBe('rowing');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.hyrox).toBe('hyrox');
  });

  it('maps cycling to the cycling plan-builder goal', () => {
    expect(ONBOARDING_GOAL_TO_PREFERENCES.cycling).toBe('cycling');
  });

  it('leaves the existing goal mappings unchanged', () => {
    expect(ONBOARDING_GOAL_TO_PREFERENCES.run).toBe('run_performance');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.lift).toBe('strength');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.hybrid).toBe('hybrid');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.weight_loss).toBe('weight_loss');
    expect(ONBOARDING_GOAL_TO_PREFERENCES.general_fitness).toBe('general');
  });
});

describe('toLongRunDay', () => {
  // UserPreferences.longRunDay is 'saturday' | 'sunday' only and confirmed
  // unread server-side (see onboarding.ts's comment) — this is a best-effort
  // mapping, not real scheduling logic. availableDays/longSessionDay (any of
  // 7 days) are what actually get persisted for a future scheduling workstream.
  it('maps sunday through unchanged', () => {
    expect(toLongRunDay('sunday')).toBe('sunday');
  });
  it('falls back to saturday for every other day, including null (the existing-user path)', () => {
    expect(toLongRunDay('wednesday')).toBe('saturday');
    expect(toLongRunDay('saturday')).toBe('saturday');
    expect(toLongRunDay(null)).toBe('saturday');
  });
});

describe('weeksPlannedForRace', () => {
  const now = new Date('2026-08-02T00:00:00');

  it('computes whole weeks from today to the race date', () => {
    // 2026-08-02 -> 2026-10-11 is exactly 10 weeks.
    const weeks = weeksPlannedForRace({ name: 'Test 10K', date: '2026-10-11', distanceKm: 10 }, now);
    expect(weeks).toBe(10);
  });

  it('clamps below 4 weeks up to the minimum periodization window', () => {
    const weeks = weeksPlannedForRace({ name: 'Next weekend', date: '2026-08-09', distanceKm: 5 }, now);
    expect(weeks).toBe(4);
  });

  it('clamps above 20 weeks down to the maximum periodization window', () => {
    const weeks = weeksPlannedForRace({ name: 'Far out marathon', date: '2027-06-01', distanceKm: 42.2 }, now);
    expect(weeks).toBe(20);
  });
});

describe('buildAnchorHistoryRows', () => {
  const now = new Date('2026-08-02T00:00:00Z');

  it('returns [] when no anchor was set', () => {
    expect(buildAnchorHistoryRows('user-1', baseDraft({ thresholdAnchor: null }), now)).toEqual([]);
  });

  it('defaults a self-reported anchor to moderate confidence with no HealthKit provenance', () => {
    const draft = baseDraft({
      thresholdAnchor: { run: { thresholdSecPerMile: 480, source: 'self_report' } },
    });
    const rows = buildAnchorHistoryRows('user-1', draft, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: 'user-1',
      anchor_key: 'run',
      value_numeric: 480,
      unit: 'sec_per_mile',
      source: 'self_report',
      confidence: 'moderate',
      effort_duration_s: null,
      qualifying_effort_count: null,
      derived_from: null,
    });
  });

  it('carries a derived anchor\'s confidence and HealthKit provenance through from anchorProposal', () => {
    const draft = baseDraft({
      thresholdAnchor: { run: { thresholdSecPerMile: 460, source: 'derived', confidence: 'low' } },
      anchorProposal: {
        key: 'run',
        value: 460,
        confidence: 'low',
        qualifyingEffortCount: 3,
        derivedFrom: { externalId: 'hk-123', startedAt: '2026-07-01T08:00:00.000Z', distanceMiles: 2, timeS: 900 },
      },
    });
    const rows = buildAnchorHistoryRows('user-1', draft, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      confidence: 'low',
      effort_duration_s: 900,
      qualifying_effort_count: 3,
      derived_from: { externalId: 'hk-123', startedAt: '2026-07-01T08:00:00.000Z', distanceMiles: 2, timeS: 900 },
    });
  });

  it('sets a sooner reanchor_due_at for a low-confidence anchor than a high-confidence one', () => {
    const lowRows = buildAnchorHistoryRows(
      'user-1',
      baseDraft({ thresholdAnchor: { run: { thresholdSecPerMile: 480, source: 'derived', confidence: 'low' } } }),
      now,
    );
    const highRows = buildAnchorHistoryRows(
      'user-1',
      baseDraft({ thresholdAnchor: { run: { thresholdSecPerMile: 480, source: 'derived', confidence: 'high' } } }),
      now,
    );
    expect(new Date(lowRows[0].reanchor_due_at).getTime()).toBeLessThan(new Date(highRows[0].reanchor_due_at).getTime());
  });

  it('does not record anchorProposal provenance when its key does not match the confirmed anchor', () => {
    // Guards against stale provenance: if the athlete derived a run proposal
    // but ended up confirming a different key (shouldn't happen via the UI,
    // but the pure function must not silently mislabel it if it does).
    const draft = baseDraft({
      thresholdAnchor: { row: { splitSecPer500: 120, source: 'self_report' } },
      anchorProposal: {
        key: 'run',
        value: 460,
        confidence: 'high',
        qualifyingEffortCount: 6,
        derivedFrom: { externalId: 'hk-123', startedAt: '2026-07-01T08:00:00.000Z', distanceMiles: 6, timeS: 2700 },
      },
    });
    const rows = buildAnchorHistoryRows('user-1', draft, now);
    expect(rows).toHaveLength(1);
    expect(rows[0].anchor_key).toBe('row');
    expect(rows[0].derived_from).toBeNull();
    expect(rows[0].confidence).toBe('moderate'); // self-report default, not the run proposal's 'high'
  });
});
