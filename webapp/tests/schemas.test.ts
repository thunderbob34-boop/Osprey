import { describe, it, expect } from 'vitest';
import { WorkoutLogSchema, ExerciseSetSchema, TrainingSessionSchema, SessionTypeEnum } from '../src/lib/schemas';
import { FoodItemSchema, FoodLogEntrySchema, RecipeSchema, RecipeIngredientSchema, NutritionTargetsSchema, MealTypeEnum } from '../src/lib/schemas';

describe('schemas', () => {
  it('session type enum matches DB exactly', () => {
    expect(SessionTypeEnum.options).toEqual(['run', 'lift', 'cross', 'rest', 'race', 'swim', 'bike', 'rowing', 'hyrox']);
  });
  it('parses a representative workout_logs row', () => {
    const row = {
      id: '4d2f7a44-0000-4000-8000-000000000001', user_id: '4d2f7a44-0000-4000-8000-000000000002',
      session_id: null, started_at: '2026-07-12T14:00:00+00:00', ended_at: null,
      session_type: 'lift', status: 'completed', perceived_effort: 7,
      total_distance_km: null, total_duration_s: 3600, avg_heart_rate: null, max_heart_rate: null,
      calories_burned: null, tss: null, notes: 'upper', created_at: '2026-07-12T14:00:00+00:00',
      updated_at: '2026-07-12T14:00:00+00:00', deleted_at: null,
    };
    expect(WorkoutLogSchema.parse(row).session_type).toBe('lift');
  });
  it('parses an exercise_sets row and rejects bad rpe', () => {
    const base = { id: '4d2f7a44-0000-4000-8000-000000000003', workout_id: '4d2f7a44-0000-4000-8000-000000000001',
      exercise_id: '4d2f7a44-0000-4000-8000-000000000004', set_number: 1, reps: 8, weight_kg: 83.91,
      duration_s: null, rpe: 8, created_at: '2026-07-12T14:00:00+00:00' };
    expect(ExerciseSetSchema.parse(base).weight_kg).toBe(83.91);
    expect(() => ExerciseSetSchema.parse({ ...base, rpe: 11 })).toThrow();
  });
  it('parses a training_sessions row', () => {
    const row = { id: '4d2f7a44-0000-4000-8000-000000000005', week_id: '4d2f7a44-0000-4000-8000-000000000006',
      user_id: '4d2f7a44-0000-4000-8000-000000000002', session_date: '2026-07-14', session_type: 'run',
      intensity: 'threshold', planned_minutes: 50, planned_distance_km: 10, description: 'Tempo',
      ozzie_notes: null, created_at: '2026-07-12T14:00:00+00:00', updated_at: '2026-07-12T14:00:00+00:00' };
    expect(TrainingSessionSchema.parse(row).intensity).toBe('threshold');
  });
});

describe('nutrition schemas', () => {
  it('parses a food_items row (numerics arrive as strings from PostgREST)', () => {
    const row = FoodItemSchema.parse({
      id: '5f0d2a9e-1111-4222-8333-444455556666', name: 'Greek Yogurt, plain 2%', brand: null,
      calories_per_100g: '73.0', protein_g: '9.9', carbs_g: '3.9', fat_g: '1.9',
      barcode: null, source: 'usda', created_at: '2026-07-13T00:00:00Z',
    });
    expect(row.calories_per_100g).toBe(73);
  });
  it('rejects a bad meal_type', () => {
    expect(MealTypeEnum.safeParse('brunch').success).toBe(false);
  });
  it('parses a food_log_entries row', () => {
    const row = FoodLogEntrySchema.parse({
      id: '5f0d2a9e-1111-4222-8333-444455556666', user_id: '5f0d2a9e-1111-4222-8333-444455556667',
      food_item_id: '5f0d2a9e-1111-4222-8333-444455556668', logged_at: '2026-07-13T14:00:00Z',
      meal_type: 'lunch', quantity_g: '220.0', calories: '363.0', protein_g: '68.2',
      carbs_g: '0.0', fat_g: '8.0', created_at: '2026-07-13T14:00:00Z',
    });
    expect(row.quantity_g).toBe(220);
  });
  it('parses recipes and enforces servings integer', () => {
    const r = RecipeSchema.parse({
      id: '5f0d2a9e-1111-4222-8333-444455556666', user_id: '5f0d2a9e-1111-4222-8333-444455556667',
      name: 'Overnight Oats', servings: 4, shadow_food_item_id: null,
      created_at: '2026-07-13T00:00:00Z', updated_at: '2026-07-13T00:00:00Z',
    });
    expect(r.servings).toBe(4);
    expect(RecipeSchema.safeParse({ ...r, servings: 2.5 }).success).toBe(false);
  });
  it('parses recipe_ingredients', () => {
    const i = RecipeIngredientSchema.parse({
      id: '5f0d2a9e-1111-4222-8333-444455556666', recipe_id: '5f0d2a9e-1111-4222-8333-444455556667',
      food_item_id: '5f0d2a9e-1111-4222-8333-444455556668', quantity_g: '320.0',
    });
    expect(i.quantity_g).toBe(320);
  });
  it('parses nutrition_targets with nullable columns', () => {
    const t = NutritionTargetsSchema.parse({
      id: '5f0d2a9e-1111-4222-8333-444455556666', user_id: '5f0d2a9e-1111-4222-8333-444455556667',
      calories: 2600, protein_g: 180, carbs_g: null, fat_g: 75,
      created_at: '2026-07-13T00:00:00Z', updated_at: '2026-07-13T00:00:00Z',
    });
    expect(t.carbs_g).toBeNull();
  });
});
