import { create } from 'zustand';
import {
  DEFAULT_ONBOARDING_DRAFT,
  OnboardingDraft,
  PrimaryGoal,
  ExperienceTier,
} from '@/types/onboarding';

interface OnboardingState extends OnboardingDraft {
  setDisplayName: (name: string) => void;
  setPrimaryGoal: (goal: PrimaryGoal) => void;
  setExperienceTier: (tier: ExperienceTier) => void;
  setWeeklyRunDays: (days: number) => void;
  setWeeklyLiftDays: (days: number) => void;
  setHealthConnected: (connected: boolean) => void;
  setThresholdAnchor: (anchor: OnboardingDraft['thresholdAnchor']) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...DEFAULT_ONBOARDING_DRAFT,

  setDisplayName: (displayName) => set({ displayName }),
  setPrimaryGoal: (primaryGoal) => set({ primaryGoal }),
  setExperienceTier: (experienceTier) => set({ experienceTier }),
  setWeeklyRunDays: (weeklyRunDays) => set({ weeklyRunDays }),
  setWeeklyLiftDays: (weeklyLiftDays) => set({ weeklyLiftDays }),
  setHealthConnected: (healthConnected) => set({ healthConnected }),
  setThresholdAnchor: (thresholdAnchor) => set({ thresholdAnchor }),
  reset: () => set({ ...DEFAULT_ONBOARDING_DRAFT }),
}));
