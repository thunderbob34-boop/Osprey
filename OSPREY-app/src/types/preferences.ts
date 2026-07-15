import type { UltraGoalParams } from '@/services/coaching/ultra-params';

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
   * Only meaningful when primaryGoal is 'ultra'. Round-trips through
   * invokeGeneratePlan({ preferences }) -> the edge function's plan-builder-branch
   * `user_goals` upsert, which writes `goal_params: (prefs.ultraParams as unknown) ?? null`.
   * Omitting this silently nulls out a real ultra athlete's race params on that upsert.
   */
  ultraParams?: UltraGoalParams | null;
}
