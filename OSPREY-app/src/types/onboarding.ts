import type { ThresholdAnchorMap } from '@/services/coaching/baseline';
import type { GoalParams } from '@/services/coaching/strength-params';
import type { AnchorProposal } from '@/services/coaching/performance-anchor';

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
  | 'ultra'
  | 'crossfit';
export type ExperienceTier = 'beginner' | 'intermediate' | 'advanced';

// Matches types/preferences.ts's existing longRunDay: 'saturday' | 'sunday' convention
// (full lowercase names, not 3-letter codes).
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type EquipmentId =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'bench'
  | 'pull_up_bar'
  | 'box'
  | 'stretch_band'
  | 'swiss_ball';

// A race selected on the onboarding race screen. raceId is present when picked
// from the searchable race DB (services/race-search.ts RaceSearchResult); absent
// for a manually-entered race. distanceKm mirrors race-event.tsx's distanceLabelToKm.
export interface OnboardingRaceGoal {
  raceId?: string;
  name: string;
  date: string; // YYYY-MM-DD
  distanceKm: number | null;
}

export interface OnboardingDraft {
  displayName: string;
  primaryGoal: PrimaryGoal;
  experienceTier: ExperienceTier;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  healthConnected: boolean;
  thresholdAnchor: ThresholdAnchorMap | null;
  goalParams?: GoalParams | null;
  raceGoal: OnboardingRaceGoal | null;
  bodyWeightKg: number | null;
  availableDays: Weekday[];
  longSessionDay: Weekday | null;
  equipment: EquipmentId[];
  // Reserved for WS2's injury model (region/tissue/status). WS1 never populates
  // this — it exists so the nullable DB column and draft shape are already in
  // place and WS2 doesn't need a second migration touching this table.
  injuryHistory: null;
  // The HealthKit-derived anchor candidate shown on the anchor screen before the
  // athlete confirms or edits it. Cleared once thresholdAnchor is set.
  anchorProposal: AnchorProposal | null;
}

export const DEFAULT_ONBOARDING_DRAFT: OnboardingDraft = {
  displayName: '',
  primaryGoal: 'hybrid',
  experienceTier: 'beginner',
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
};
