import type { ThresholdAnchorMap } from '@/services/coaching/baseline';
import type { GoalParams } from '@/services/coaching/strength-params';

export type PrimaryGoal =
  | 'run'
  | 'lift'
  | 'hybrid'
  | 'weight_loss'
  | 'general_fitness'
  | 'swim'
  | 'rowing'
  | 'hyrox'
  | 'cycling'
  | 'ultra';
export type ExperienceTier = 'beginner' | 'intermediate' | 'advanced';

export interface OnboardingDraft {
  displayName: string;
  primaryGoal: PrimaryGoal;
  experienceTier: ExperienceTier;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  healthConnected: boolean;
  thresholdAnchor: ThresholdAnchorMap | null;
  goalParams?: GoalParams | null;
}

export const DEFAULT_ONBOARDING_DRAFT: OnboardingDraft = {
  displayName: '',
  primaryGoal: 'hybrid',
  experienceTier: 'beginner',
  weeklyRunDays: 3,
  weeklyLiftDays: 2,
  healthConnected: false,
  thresholdAnchor: null,
};
