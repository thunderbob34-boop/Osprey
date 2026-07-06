import { supabase } from '@/services/supabase';
import type { SavedRoute, SavedRouteInput } from '@/types/routes';

const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.609344;

interface SavedRouteRow {
  id: string;
  name: string;
  tags: string[];
  distance_km: number | null;
  notes: string | null;
  created_at: string;
}

function mapRow(row: SavedRouteRow): SavedRoute {
  return {
    id: row.id,
    name: row.name,
    tags: row.tags ?? [],
    distanceMiles: row.distance_km != null ? Math.round(row.distance_km * KM_TO_MILES * 10) / 10 : null,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function fetchSavedRoutes(userId: string): Promise<SavedRoute[]> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select('id, name, tags, distance_km, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createSavedRoute(userId: string, input: SavedRouteInput): Promise<void> {
  const { error } = await supabase.from('saved_routes').insert({
    user_id: userId,
    name: input.name.trim(),
    tags: input.tags,
    distance_km: input.distanceMiles != null ? Math.round(input.distanceMiles * MILES_TO_KM * 100) / 100 : null,
    notes: input.notes?.trim() || null,
  });

  if (error) throw error;
}

export async function deleteSavedRoute(routeId: string): Promise<void> {
  const { error } = await supabase.from('saved_routes').delete().eq('id', routeId);
  if (error) throw error;
}
