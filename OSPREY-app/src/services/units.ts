import { supabase } from '@/services/supabase';
import { kgToLb } from '@/services/body-metrics';

export type UnitSystem = 'imperial' | 'metric';

const KM_TO_MILES = 0.621371;

export async function fetchUnitPreference(userId: string): Promise<UnitSystem> {
  const { data, error } = await supabase.from('users').select('units').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data?.units as UnitSystem | null) ?? 'imperial';
}

export async function updateUnitPreference(userId: string, units: UnitSystem): Promise<void> {
  const { error } = await supabase.from('users').update({ units }).eq('id', userId);
  if (error) throw error;
}

export function formatDistanceKm(km: number, units: UnitSystem): string {
  return units === 'metric'
    ? `${Math.round(km * 10) / 10} km`
    : `${Math.round(km * KM_TO_MILES * 10) / 10} mi`;
}

export function formatWeightKg(kg: number, units: UnitSystem): string {
  return units === 'metric' ? `${Math.round(kg * 10) / 10} kg` : `${kgToLb(kg)} lbs`;
}
