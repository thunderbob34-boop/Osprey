import { create } from 'zustand';
import {
  DEFAULT_ONBOARDING_DRAFT,
  OnboardingDraft,
  PrimaryGoal,
  ExperienceTier,
  Weekday,
  EquipmentId,
  OnboardingRaceGoal,
} from '@/types/onboarding';
import type { GoalParams } from '@/services/coaching/strength-params';
import type { AnchorProposal } from '@/services/coaching/performance-anchor';

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
  setRaceGoal: (race: OnboardingRaceGoal | null) => void;
  setBodyWeightKg: (kg: number | null) => void;
  setAvailableDays: (days: Weekday[]) => void;
  setLongSessionDay: (day: Weekday | null) => void;
  setEquipment: (equipment: EquipmentId[]) => void;
  setAnchorProposal: (proposal: AnchorProposal | null) => void;
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
  setRaceGoal: (raceGoal) => set({ raceGoal }),
  setBodyWeightKg: (bodyWeightKg) => set({ bodyWeightKg }),
  setAvailableDays: (availableDays) => set({ availableDays }),
  setLongSessionDay: (longSessionDay) => set({ longSessionDay }),
  setEquipment: (equipment) => set({ equipment }),
  setAnchorProposal: (anchorProposal) => set({ anchorProposal }),
  reset: () => set({ ...DEFAULT_ONBOARDING_DRAFT, goalParams: null }),
}));
