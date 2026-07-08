import { supabase } from '@/services/supabase';
import { kgToLb } from '@/services/body-metrics';

export type UnitSystem = 'imperial' | 'metric';

const KM_TO_MILES = 0.621371;
const OZ_TO_ML = 29.5735;

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

/** Canonical km↔mile converters — use these instead of a local constant/helper. */
export function kmToMiles(km: number): number {
  return km * KM_TO_MILES;
}

export function milesToKm(miles: number): number {
  return miles / KM_TO_MILES;
}

/**
 * Hydration is stored purely in ounces in the DB (log_hydration RPC takes
 * p_ounces) regardless of unit preference — these only convert at the
 * display layer, same pattern as kmToMiles/milesToKm above.
 */
export function ozToMl(oz: number): number {
  return oz * OZ_TO_ML;
}

export function mlToOz(ml: number): number {
  return ml / OZ_TO_ML;
}

export function formatFluidOz(oz: number, units: UnitSystem): string {
  return units === 'metric' ? `${Math.round(ozToMl(oz))}` : `${Math.round(oz)}`;
}

/** "M:SS /mi" or "M:SS /km" from a total time + distance, honoring the global unit. */
export function formatPacePerUnit(totalSeconds: number | null, km: number | null, units: UnitSystem): string | null {
  if (!totalSeconds || !km || km <= 0) return null;
  const distance = units === 'metric' ? km : kmToMiles(km);
  const secPerUnit = totalSeconds / distance;
  const min = Math.floor(secPerUnit / 60);
  const sec = Math.round(secPerUnit % 60);
  return `${min}:${String(sec).padStart(2, '0')} /${units === 'metric' ? 'km' : 'mi'}`;
}
