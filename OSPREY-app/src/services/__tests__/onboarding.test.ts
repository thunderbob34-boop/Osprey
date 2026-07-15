import { ONBOARDING_GOAL_TO_PREFERENCES } from '@/services/onboarding';

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
