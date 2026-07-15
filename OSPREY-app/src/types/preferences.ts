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
}
