import { z } from 'zod';

export const SessionTypeEnum = z.enum(['run', 'lift', 'cross', 'rest', 'race', 'swim', 'bike', 'rowing', 'hyrox']);
export const WorkoutStatusEnum = z.enum(['planned', 'completed', 'skipped', 'partial']);
export const IntensityEnum = z.enum(['easy', 'moderate', 'threshold', 'interval', 'race', 'rest']);

export const WorkoutLogSchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid(), session_id: z.string().uuid().nullable(),
  started_at: z.string(), ended_at: z.string().nullable(),
  session_type: SessionTypeEnum, status: WorkoutStatusEnum,
  perceived_effort: z.number().int().min(1).max(10).nullable(),
  total_distance_km: z.coerce.number().nullable(), total_duration_s: z.number().int().nullable(),
  avg_heart_rate: z.number().int().nullable(), max_heart_rate: z.number().int().nullable(),
  calories_burned: z.number().int().nullable(), tss: z.coerce.number().nullable(),
  notes: z.string().nullable(), created_at: z.string(), updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type WorkoutLog = z.infer<typeof WorkoutLogSchema>;

export const ExerciseSetSchema = z.object({
  id: z.string().uuid(), workout_id: z.string().uuid(), exercise_id: z.string().uuid(),
  set_number: z.number().int(), reps: z.number().int().nullable(),
  weight_kg: z.coerce.number().nullable(), duration_s: z.number().int().nullable(),
  rpe: z.number().int().min(1).max(10).nullable(), created_at: z.string(),
});
export type ExerciseSet = z.infer<typeof ExerciseSetSchema>;

export const TrainingSessionSchema = z.object({
  id: z.string().uuid(), week_id: z.string().uuid(), user_id: z.string().uuid(),
  session_date: z.string(), session_type: SessionTypeEnum, intensity: IntensityEnum,
  planned_minutes: z.number().int().nullable(), planned_distance_km: z.coerce.number().nullable(),
  description: z.string().nullable(), ozzie_notes: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
});
export type TrainingSession = z.infer<typeof TrainingSessionSchema>;

export const RaceEventSchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid(), name: z.string(),
  distance_km: z.coerce.number().nullable(), event_date: z.string(),
  goal_time_s: z.number().int().nullable(), result_time_s: z.number().int().nullable(),
  notes: z.string().nullable(),
});
export type RaceEvent = z.infer<typeof RaceEventSchema>;

export const ExerciseSchema = z.object({
  id: z.string().uuid(), name: z.string(), muscle_group: z.string().nullable(),
  equipment: z.string().nullable(), created_at: z.string(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const MealTypeEnum = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof MealTypeEnum>;

export const FoodItemSchema = z.object({
  id: z.string().uuid(), name: z.string(), brand: z.string().nullable(),
  calories_per_100g: z.coerce.number().nullable(), protein_g: z.coerce.number().nullable(),
  carbs_g: z.coerce.number().nullable(), fat_g: z.coerce.number().nullable(),
  barcode: z.string().nullable(), source: z.string().nullable(), created_at: z.string(),
});
export type FoodItem = z.infer<typeof FoodItemSchema>;

export const FoodLogEntrySchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid(), food_item_id: z.string().uuid(),
  logged_at: z.string(), meal_type: MealTypeEnum.nullable(),
  quantity_g: z.coerce.number(), calories: z.coerce.number().nullable(),
  protein_g: z.coerce.number().nullable(), carbs_g: z.coerce.number().nullable(),
  fat_g: z.coerce.number().nullable(), created_at: z.string(),
});
export type FoodLogEntry = z.infer<typeof FoodLogEntrySchema>;

export const NutritionTargetsSchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid(),
  calories: z.number().int().nullable(), protein_g: z.number().int().nullable(),
  carbs_g: z.number().int().nullable(), fat_g: z.number().int().nullable(),
  created_at: z.string(), updated_at: z.string(),
});
export type NutritionTargets = z.infer<typeof NutritionTargetsSchema>;

export const RecipeSchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid(), name: z.string(),
  servings: z.number().int().positive(), shadow_food_item_id: z.string().uuid().nullable(),
  created_at: z.string(), updated_at: z.string(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const RecipeIngredientSchema = z.object({
  id: z.string().uuid(), recipe_id: z.string().uuid(), food_item_id: z.string().uuid(),
  quantity_g: z.coerce.number(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
