import { create } from 'zustand';
import {
  DEFAULT_ONBOARDING_DRAFT,
  OnboardingDraft,
  PrimaryGoal,
  ExperienceTier,
} from '@/types/onboarding';
import type { GoalParams } from '@/services/coaching/strength-params';

interface OnboardingState extends OnboardingDraft {
  goalParams: GoalParams | null;
  setDisplayName: (name: string) => void;
  setPrimaryGoal: (goal: PrimaryGoal) => void;
  setExperienceTier: (tier: ExperienceTier) => void;
  setWeeklyRunDays: (days: number) => void;
  setWeeklyLiftDays: (days: number) => void;
  setHealthConnected: (connected: boolean) => void;
  setThresholdAnchor: (anchor: OnboardingDraft['thresholdAnchor']) => void;
  setGoalParams: (params: GoalParams) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...DEFAULT_ONBOARDING_DRAFT,
  goalParams: null,

  setDisplayName: (displayName) => set({ displayName }),
  setPrimaryGoal: (primaryGoal) => set({ primaryGoal }),
  setExperienceTier: (experienceTier) => set({ experienceTier }),
  setWeeklyRunDays: (weeklyRunDays) => set({ weeklyRunDays }),
  setWeeklyLiftDays: (weeklyLiftDays) => set({ weeklyLiftDays }),
  setHealthConnected: (healthConnected) => set({ healthConnected }),
  setThresholdAnchor: (thresholdAnchor) => set({ thresholdAnchor }),
  setGoalParams: (goalParams) => set({ goalParams }),
  reset: () => set({ ...DEFAULT_ONBOARDING_DRAFT, goalParams: null }),
}));
