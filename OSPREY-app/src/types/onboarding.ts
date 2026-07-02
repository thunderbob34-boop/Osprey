export type PrimaryGoal = 'run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness';
export type ExperienceTier = 'beginner' | 'intermediate' | 'advanced';

export interface OnboardingDraft {
  displayName: string;
  primaryGoal: PrimaryGoal;
  experienceTier: ExperienceTier;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  healthConnected: boolean;
}

export const DEFAULT_ONBOARDING_DRAFT: OnboardingDraft = {
  displayName: '',
  primaryGoal: 'hybrid',
  experienceTier: 'beginner',
  weeklyRunDays: 3,
  weeklyLiftDays: 2,
  healthConnected: false,
};
