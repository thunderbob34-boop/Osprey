import { supabase } from '@/services/supabase';

export interface MealPhotoEstimate {
  isFood: boolean;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidenceNote: string;
}

export async function estimateMealFromPhoto(imageBase64: string): Promise<MealPhotoEstimate> {
  const { data, error } = await supabase.functions.invoke<MealPhotoEstimate>('ozzie-meal-photo', {
    method: 'POST',
    body: { imageBase64 },
  });

  if (error || !data) {
    throw error ?? new Error('Failed to analyze photo');
  }

  return data;
}
