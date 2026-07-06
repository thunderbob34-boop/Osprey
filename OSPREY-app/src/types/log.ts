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
}

export interface LoggedFoodRow {
  id: string;
  name: string;
  mealType: string | null;
  loggedAt: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  quantityG: number | null;
  foodItemId: string | null;
}

export interface TodayLogData {
  workouts: LoggedWorkoutRow[];
  food: LoggedFoodRow[];
  totalCalories: number;
}

/** A frequently-logged meal, ready for one-tap re-logging. */
export interface RecentMeal {
  foodItemId: string;
  name: string;
  mealType: MealType | null;
  quantityG: number | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  timesLogged: number;
}
