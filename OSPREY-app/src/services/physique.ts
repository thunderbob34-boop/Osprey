import { supabase } from '@/services/supabase';

export type PhysiqueGoal = 'cut' | 'maintain' | 'lean_bulk';

export interface PhysiqueGoalState {
  physiqueGoal: PhysiqueGoal | null;
  physiqueTargetDate: string | null; // YYYY-MM-DD
}

export interface ProgressPhoto {
  id: string;
  takenOn: string; // YYYY-MM-DD
  storagePath: string;
  signedUrl: string | null;
  weightKg: number | null;
  note: string | null;
}

const BUCKET = 'progress-photos';
const SIGNED_URL_TTL_S = 60 * 60; // 1 hour — refetched with the query anyway

export async function fetchPhysiqueGoal(userId: string): Promise<PhysiqueGoalState> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('physique_goal, physique_target_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return {
    physiqueGoal: (data?.physique_goal ?? null) as PhysiqueGoal | null,
    physiqueTargetDate: data?.physique_target_date ?? null,
  };
}

export async function savePhysiqueGoal(
  userId: string,
  goal: PhysiqueGoal | null,
  targetDate: string | null,
): Promise<void> {
  // user_goals normally exists after onboarding; update in place so the
  // performance goal fields are untouched. Only insert (with a neutral
  // primary_goal) if the row is somehow missing.
  const { data: updated, error } = await supabase
    .from('user_goals')
    .update({ physique_goal: goal, physique_target_date: targetDate })
    .eq('user_id', userId)
    .select('id');

  if (error) throw error;
  if ((updated ?? []).length > 0) return;

  const { error: insertError } = await supabase.from('user_goals').insert({
    user_id: userId,
    primary_goal: 'hybrid',
    physique_goal: goal,
    physique_target_date: targetDate,
  });
  if (insertError) throw insertError;
}

export async function fetchProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('id, taken_on, storage_path, weight_kg, note')
    .eq('user_id', userId)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Bucket is private — batch-sign a short-lived URL per photo for display.
  const paths = rows.map((r) => r.storage_path as string);
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_S);
  if (signError) throw signError;

  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.error ? null : s.signedUrl]),
  );

  return rows.map((r) => ({
    id: r.id as string,
    takenOn: r.taken_on as string,
    storagePath: r.storage_path as string,
    signedUrl: urlByPath.get(r.storage_path as string) ?? null,
    weightKg: r.weight_kg != null ? Number(r.weight_kg) : null,
    note: (r.note ?? null) as string | null,
  }));
}

export async function addProgressPhoto(params: {
  userId: string;
  localUri: string;
  weightKg?: number | null;
  note?: string | null;
}): Promise<void> {
  const response = await fetch(params.localUri);
  const body = await response.arrayBuffer();

  const storagePath = `${params.userId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('progress_photos').insert({
    user_id: params.userId,
    storage_path: storagePath,
    weight_kg: params.weightKg ?? null,
    note: params.note ?? null,
  });
  if (insertError) {
    // Don't strand an orphaned object if the row insert fails.
    await supabase.storage.from(BUCKET).remove([storagePath]).then(
      () => undefined,
      () => undefined,
    );
    throw insertError;
  }
}

export async function deleteProgressPhoto(photo: ProgressPhoto): Promise<void> {
  const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([photo.storagePath]).then(
    () => undefined,
    () => undefined, // row is gone; a dangling object is harmless and owner-scoped
  );
}
