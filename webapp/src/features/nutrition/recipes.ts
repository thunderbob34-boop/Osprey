import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { FoodItemSchema, RecipeIngredientSchema, RecipeSchema, type MealType, type Recipe } from '../../lib/schemas';
import { perServing, scale, sumIngredientMacros, type Macros } from '../../lib/macros';
import { loggedAtFor } from '../../lib/day';

const RecipeWithIngredientsSchema = RecipeSchema.extend({
  user_recipe_ingredients: z.array(RecipeIngredientSchema.extend({ food_items: FoodItemSchema })),
});
export type RecipeWithIngredients = z.infer<typeof RecipeWithIngredientsSchema>;

const RECIPE_SELECT = '*, user_recipe_ingredients(*, food_items(*))';

export function recipeTotals(r: RecipeWithIngredients): Macros {
  return sumIngredientMacros(
    r.user_recipe_ingredients.map((i) => ({
      quantityG: i.quantity_g,
      per100g: {
        calories: i.food_items.calories_per_100g, proteinG: i.food_items.protein_g,
        carbsG: i.food_items.carbs_g, fatG: i.food_items.fat_g,
      },
    })),
  );
}

export function recipePerServing(r: RecipeWithIngredients): Macros {
  return perServing(recipeTotals(r), r.servings);
}

export function useRecipes(userId: string) {
  return useQuery({
    queryKey: ['recipes', userId],
    queryFn: async (): Promise<RecipeWithIngredients[]> => {
      const { data, error } = await supabase.from('user_recipes').select(RECIPE_SELECT).eq('user_id', userId).order('name');
      if (error) throw error;
      return z.array(RecipeWithIngredientsSchema).parse(data);
    },
  });
}

export function useRecipe(recipeId: string) {
  return useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: async (): Promise<RecipeWithIngredients> => {
      const { data, error } = await supabase.from('user_recipes').select(RECIPE_SELECT).eq('id', recipeId).single();
      if (error) throw error;
      return RecipeWithIngredientsSchema.parse(data);
    },
  });
}

function invalidateRecipe(qc: ReturnType<typeof useQueryClient>, recipeId?: string) {
  void qc.invalidateQueries({ queryKey: ['recipes'] });
  if (recipeId) void qc.invalidateQueries({ queryKey: ['recipe', recipeId] });
}

export function useCreateRecipe(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; servings: number }): Promise<Recipe> => {
      const { data, error } = await supabase
        .from('user_recipes')
        .insert({ user_id: userId, name: input.name, servings: input.servings })
        .select('*')
        .single();
      if (error) throw error;
      return RecipeSchema.parse(data);
    },
    onSuccess: () => invalidateRecipe(qc),
  });
}

export function useUpdateRecipe(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; servings?: number }) => {
      const { error } = await supabase
        .from('user_recipes')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', recipeId);
      if (error) throw error;
    },
    onSuccess: () => invalidateRecipe(qc, recipeId),
  });
}

export function useDeleteRecipe(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recipeId: string) => {
      // recipe_ingredients cascade; the shadow food_items row (if any) stays —
      // old log entries reference it and it's excluded from search by source.
      const { error } = await supabase.from('user_recipes').delete().eq('id', recipeId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['recipes', userId] }),
  });
}

export function useAddIngredient(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { foodItemId: string; quantityG: number }) => {
      const { error } = await supabase
        .from('user_recipe_ingredients')
        .insert({ recipe_id: recipeId, food_item_id: input.foodItemId, quantity_g: input.quantityG });
      if (error) throw error;
    },
    onSuccess: () => invalidateRecipe(qc, recipeId),
  });
}

export function useUpdateIngredient(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ingredientId: string; quantityG: number }) => {
      const { error } = await supabase
        .from('user_recipe_ingredients')
        .update({ quantity_g: input.quantityG })
        .eq('id', input.ingredientId);
      if (error) throw error;
    },
    onSuccess: () => invalidateRecipe(qc, recipeId),
  });
}

export function useRemoveIngredient(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ingredientId: string) => {
      const { error } = await supabase.from('user_recipe_ingredients').delete().eq('id', ingredientId);
      if (error) throw error;
    },
    onSuccess: () => invalidateRecipe(qc, recipeId),
  });
}

/** Snapshot semantics: the shadow food_items row is immutable. If the recipe's
 * name or per-serving macros changed since the shadow was created, a NEW shadow
 * row is created and recipes.shadow_food_item_id repointed. Old log entries keep
 * the old row (and the values they were logged with); shadow rows never appear
 * in search (source='recipe'). No UPDATE grant on food_items required. */
async function ensureShadowItem(recipe: RecipeWithIngredients, per: Macros): Promise<string> {
  if (recipe.shadow_food_item_id) {
    const { data, error } = await supabase
      .from('food_items').select('*').eq('id', recipe.shadow_food_item_id).maybeSingle();
    if (error) throw error;
    if (data) {
      const f = FoodItemSchema.parse(data);
      if (
        f.name === recipe.name &&
        f.calories_per_100g === per.calories && f.protein_g === per.proteinG &&
        f.carbs_g === per.carbsG && f.fat_g === per.fatG
      ) return f.id;
    }
  }
  const { data: created, error: insErr } = await supabase
    .from('food_items')
    .insert({
      name: recipe.name,
      // Per-serving macros stored as per-100g so that quantity_g = 100 × servings
      // makes quantity/100 × per100g equal servings × perServing.
      calories_per_100g: per.calories, protein_g: per.proteinG, carbs_g: per.carbsG, fat_g: per.fatG,
      source: 'recipe',
    })
    .select('id')
    .single();
  if (insErr) throw insErr;
  const { error: updErr } = await supabase
    .from('user_recipes')
    .update({ shadow_food_item_id: created.id, updated_at: new Date().toISOString() })
    .eq('id', recipe.id);
  if (updErr) throw updErr;
  return created.id as string;
}

export function useLogRecipeServing(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { recipe: RecipeWithIngredients; servings: number; mealType: MealType; dateStr: string }) => {
      if (input.recipe.user_recipe_ingredients.length === 0) throw new Error('Add ingredients before logging');
      const per = recipePerServing(input.recipe);
      const shadowId = await ensureShadowItem(input.recipe, per);
      const total = scale(per, input.servings);
      const { error } = await supabase.from('food_log_entries').insert({
        user_id: userId,
        food_item_id: shadowId,
        logged_at: loggedAtFor(input.dateStr),
        meal_type: input.mealType,
        quantity_g: 100 * input.servings,
        calories: total.calories, protein_g: total.proteinG, carbs_g: total.carbsG, fat_g: total.fatG,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['day-log', userId, v.dateStr] });
      void qc.invalidateQueries({ queryKey: ['nutrition-coaching'] });
      invalidateRecipe(qc, v.recipe.id);
    },
  });
}
