import type { GoalParams } from '@/services/coaching/strength-params';

export type TrainingGoal =
  | 'hybrid'
  | 'run_performance'
  | 'strength'
  | 'weight_loss'
  | 'general'
  | 'triathlon'
  | 'swim'
  | 'rowing'
  | 'hyrox'
  | 'cycling'
  | 'ultra';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingDaysPerWeek = 3 | 4 | 5 | 6;
export type TriathlonDistance = 'sprint' | 'olympic' | 'half' | 'full';

export interface UserPreferences {
  primaryGoal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: TrainingDaysPerWeek;
  longRunDay: 'saturday' | 'sunday';
  includeSwim: boolean;
  includeBike: boolean;
  /** Only meaningful when primaryGoal is 'triathlon'. */
  triathlonDistance?: TriathlonDistance;
  /**
   * Sport-specific goal params (ultra race distance/vert/gut-trained; lift 1RMs; …) —
   * a generic goal_params carrier keyed off primaryGoal. Round-trips through
   * invokeGeneratePlan({ preferences }) -> the edge function's plan-builder-branch
   * `user_goals` upsert, which writes `goal_params: (prefs.goalParams as unknown) ?? null`.
   * Omitting this silently nulls out a real athlete's goal params on that upsert.
   */
  goalParams?: GoalParams | null;
}
