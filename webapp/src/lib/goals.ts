import { z } from 'zod';

// Mirrors OSPREY-app/src/types/onboarding.ts PrimaryGoal. Keep in sync.
export const PRIMARY_GOALS = [
  'run', 'lift', 'hybrid', 'weight_loss', 'general_fitness',
  'swim', 'rowing', 'hyrox', 'cycling', 'ultra', 'crossfit',
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];
export const PrimaryGoalSchema = z.enum(PRIMARY_GOALS);
