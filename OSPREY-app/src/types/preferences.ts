export type TrainingGoal = 'hybrid' | 'run_performance' | 'strength' | 'weight_loss' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingDaysPerWeek = 3 | 4 | 5 | 6;

export interface UserPreferences {
  primaryGoal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: TrainingDaysPerWeek;
  longRunDay: 'saturday' | 'sunday';
  includeSwim: boolean;
  includeBike: boolean;
}
