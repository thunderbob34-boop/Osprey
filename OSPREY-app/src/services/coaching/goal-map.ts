import type { TrainingGoal } from '@/types/preferences';

// The DB `primary_goal_enum` value space. Superset of the onboarding PrimaryGoal TS union
// (@/types/onboarding) — note it additionally includes 'triathlon'.
export type PrimaryGoalEnum =
  | 'run'
  | 'lift'
  | 'hybrid'
  | 'weight_loss'
  | 'general_fitness'
  | 'triathlon'
  | 'swim'
  | 'rowing'
  | 'hyrox'
  | 'cycling'
  | 'ultra';

// Client mirror of ozzie-generate-plan/index.ts PRIMARY_GOAL_MAP. Translates a plan-builder
// TrainingGoal to the DB primary_goal_enum that the envelope build gates on. Keep in sync
// with that map and the *_primary_goal migrations.
export const TRAINING_GOAL_TO_PRIMARY_GOAL: Record<TrainingGoal, PrimaryGoalEnum> = {
  hybrid: 'hybrid',
  run_performance: 'run',
  strength: 'lift',
  weight_loss: 'weight_loss',
  general: 'general_fitness',
  triathlon: 'triathlon',
  swim: 'swim',
  rowing: 'rowing',
  hyrox: 'hyrox',
  cycling: 'cycling',
  ultra: 'ultra',
};

export function primaryGoalFromTrainingGoal(g: TrainingGoal): PrimaryGoalEnum {
  return TRAINING_GOAL_TO_PRIMARY_GOAL[g];
}
