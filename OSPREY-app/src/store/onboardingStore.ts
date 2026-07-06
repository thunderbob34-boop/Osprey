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
  setTargetRaceName: (name: string | null) => void;
  setTargetDate: (date: string | null) => void;
  setInjuryNotes: (notes: string) => void;
  setConstraintTags: (tags: string[]) => void;
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
  setTargetRaceName: (targetRaceName) => set({ targetRaceName }),
  setTargetDate: (targetDate) => set({ targetDate }),
  setInjuryNotes: (injuryNotes) => set({ injuryNotes }),
  setConstraintTags: (constraintTags) => set({ constraintTags }),
  reset: () => set({ ...DEFAULT_ONBOARDING_DRAFT }),
}));
