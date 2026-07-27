/**
 * Every session type an athlete can log by hand. Mirrors session_type_enum
 * minus 'rest' (nothing to log about a rest day). This was stuck at the
 * original four while swim/bike (20260702000015) and rowing/hyrox
 * (20260707000028) were added to the enum and given their own live runners —
 * so a pool swim could only be filed as "Cross", and editing an existing
 * swim from the Log tab showed no selected type at all.
 */
export type QuickWorkoutType =
  | 'run'
  | 'lift'
  | 'swim'
  | 'bike'
  | 'rowing'
  | 'hyrox'
  | 'cross'
  | 'race';

/**
 * The chips the Log tab offers, in display order. Lives here beside the type
 * so the two can't drift — handleEditWorkout seeds its selection from a
 * stored session_type, and a type with no chip leaves the row showing
 * nothing selected and no way to set it back.
 */
export const WORKOUT_TYPES: { value: QuickWorkoutType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'lift', label: 'Lift' },
  { value: 'swim', label: 'Swim' },
  { value: 'bike', label: 'Bike' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'hyrox', label: 'Hyrox' },
  { value: 'cross', label: 'Cross' },
  { value: 'race', label: 'Race' },
];

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
