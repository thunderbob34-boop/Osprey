// onboarding.ts (imported for the inverse check) pulls in build-envelope → supabase;
// mock it so the module graph resolves under Jest (matches build-envelope.test.ts).
jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { ONBOARDING_GOAL_TO_PREFERENCES } from '@/services/onboarding';
import type { PrimaryGoal } from '@/types/onboarding';
import { TRAINING_GOAL_TO_PRIMARY_GOAL, primaryGoalFromTrainingGoal } from '@/services/coaching/goal-map';

describe('goal-map', () => {
  it('is the exact inverse of ONBOARDING_GOAL_TO_PREFERENCES over every PrimaryGoal', () => {
    (Object.keys(ONBOARDING_GOAL_TO_PREFERENCES) as PrimaryGoal[]).forEach((p) => {
      expect(primaryGoalFromTrainingGoal(ONBOARDING_GOAL_TO_PREFERENCES[p])).toBe(p);
    });
  });

  it('maps every plan-builder TrainingGoal (incl. triathlon) to a primary_goal_enum', () => {
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.strength).toBe('lift');
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.run_performance).toBe('run');
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.general).toBe('general_fitness');
    expect(TRAINING_GOAL_TO_PRIMARY_GOAL.triathlon).toBe('triathlon'); // plan-builder only — no onboarding inverse
    expect(Object.keys(TRAINING_GOAL_TO_PRIMARY_GOAL)).toHaveLength(11);
  });
});
