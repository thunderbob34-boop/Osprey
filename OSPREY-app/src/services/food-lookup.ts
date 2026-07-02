import { supabase } from '@/services/supabase';

export interface FoodItemResult {
  id: string;
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  barcode: string | null;
}

function mapRow(row: any): FoodItemResult {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? null,
    caloriesPer100g: row.calories_per_100g,
    proteinG: row.protein_g ?? null,
    carbsG: row.carbs_g ?? null,
    fatG: row.fat_g ?? null,
    barcode: row.barcode ?? null,
  };
}

export async function searchFoodByName(query: string): Promise<FoodItemResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase
    .from('food_items')
    .select('id, name, brand, calories_per_100g, protein_g, carbs_g, fat_g, barcode')
    .ilike('name', `%${trimmed}%`)
    .limit(15);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

async function fetchFromOpenFoodFacts(barcode: string): Promise<FoodItemResult | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const product = json.product;
    const nutriments = product.nutriments ?? {};
    const caloriesPer100g =
      nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? null;
    if (caloriesPer100g == null) return null;

    return {
      id: '',
      name: product.product_name || product.generic_name || 'Unknown food',
      brand: product.brands ?? null,
      caloriesPer100g: Math.round(caloriesPer100g * 10) / 10,
      proteinG: nutriments.proteins_100g ?? null,
      carbsG: nutriments.carbohydrates_100g ?? null,
      fatG: nutriments.fat_100g ?? null,
      barcode,
    };
  } catch {
    return null;
  }
}

/**
 * Looks up a scanned barcode: checks the local food_items cache first,
 * then falls back to Open Food Facts and caches the result for next time.
 */
export async function lookupBarcode(barcode: string): Promise<FoodItemResult | null> {
  const { data: existing, error } = await supabase
    .from('food_items')
    .select('id, name, brand, calories_per_100g, protein_g, carbs_g, fat_g, barcode')
    .eq('barcode', barcode)
    .maybeSingle();

  if (error) throw error;
  if (existing) return mapRow(existing);

  const remote = await fetchFromOpenFoodFacts(barcode);
  if (!remote) return null;

  const { data: inserted, error: insertError } = await supabase
    .from('food_items')
    .insert({
      name: remote.name,
      brand: remote.brand,
      calories_per_100g: remote.caloriesPer100g,
      protein_g: remote.proteinG,
      carbs_g: remote.carbsG,
      fat_g: remote.fatG,
      barcode,
      source: 'openfoodfacts',
    })
    .select('id, name, brand, calories_per_100g, protein_g, carbs_g, fat_g, barcode')
    .single();

  if (insertError || !inserted) return remote;
  return mapRow(inserted);
}
