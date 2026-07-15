import { ONBOARDING_GOAL_TO_PREFERENCES, buildPlanPreferences } from '@/services/onboarding';
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
    ...overrides,
  };
}

describe('buildPlanPreferences', () => {
  // Regression test for the onboarding clobber bug: buildPlanPreferences feeds
  // invokeGeneratePlan({ preferences }), and the edge function's plan-builder-branch
  // upsert writes `goal_params: (prefs.ultraParams as unknown) ?? null` straight over
  // whatever completeOnboarding just inserted. If ultraParams is dropped here, a real
  // ultra athlete's race params silently revert to 50k/untrained on the very next
  // background regeneration (daily-summary.ts's invokeGeneratePlan() on Home load).
  it('carries an ultra draft\'s goalParams through as ultraParams, so the edge upsert re-persists it instead of nulling it', () => {
    const draft = baseDraft({
      primaryGoal: 'ultra',
      goalParams: { raceDistance: '100mi', vertGainM: 3000, gutTrained: true },
    });

    expect(buildPlanPreferences(draft).ultraParams).toEqual({
      raceDistance: '100mi',
      vertGainM: 3000,
      gutTrained: true,
    });
  });

  it('sends no ultraParams blob for a non-ultra draft (null goalParams)', () => {
    const draft = baseDraft({ primaryGoal: 'hybrid', goalParams: null });

    expect(buildPlanPreferences(draft).ultraParams).toBeNull();
  });

  it('sends no ultraParams blob for a non-ultra draft (goalParams omitted)', () => {
    const draft = baseDraft({ primaryGoal: 'hybrid' });
    delete draft.goalParams;

    expect(buildPlanPreferences(draft).ultraParams).toBeNull();
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
