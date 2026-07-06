export type QuickWorkoutType = 'run' | 'lift' | 'cross' | 'race';

export interface QuickWorkoutInput {
  sessionType: QuickWorkoutType;
  minutes: number;
  distanceMiles?: number;
  notes?: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface QuickFoodInput {
  name: string;
  mealType: MealType;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  foodItemId?: string;
  quantityG?: number;
}

export interface LoggedWorkoutRow {
  id: string;
  sessionType: string;
  startedAt: string;
  durationMinutes: number;
  distanceMiles: number | null;
  notes: string | null;
  // Passed the server-side GPS plausibility check (verify_workout_effort) —
  // eligible for verified-only challenge leaderboards.
  verified: boolean;
}

export interface LoggedFoodRow {
  id: string;
  name: string;
  mealType: string | null;
  loggedAt: string;
  calories: number | null;
}

export interface TodayLogData {
  workouts: LoggedWorkoutRow[];
  food: LoggedFoodRow[];
  totalCalories: number;
}
