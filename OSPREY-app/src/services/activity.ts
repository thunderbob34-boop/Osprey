import { supabase } from '@/services/supabase';

export interface ActivityCard {
  shareId: string;
  workoutId: string;
  userId: string;
  userName: string;
  caption: string | null;
  sessionType: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  postedAt: string;
  kudoCount: number;
  hasKudo: boolean; // current user gave a kudo
}

interface ActivityCardRow {
  share_id: string;
  workout_id: string;
  user_id: string;
  display_name: string;
  caption: string | null;
  session_type: string;
  total_duration_s: number | null;
  total_distance_km: number | null;
  share_created_at: string;
  kudo_count: number;
  user_gave_kudo: boolean;
}

function mapRow(row: ActivityCardRow): ActivityCard {
  return {
    shareId: row.share_id,
    workoutId: row.workout_id,
    userId: row.user_id,
    userName: row.display_name,
    caption: row.caption,
    sessionType: row.session_type,
    durationMinutes: row.total_duration_s ? Math.round(row.total_duration_s / 60) : null,
    distanceKm: row.total_distance_km,
    postedAt: row.share_created_at,
    kudoCount: row.kudo_count,
    hasKudo: row.user_gave_kudo,
  };
}

/**
 * Fetch the recent activity feed: workouts shared by the user and their friends,
 * ordered newest first. Includes kudo counts and whether the current user gave a kudo.
 */
export async function fetchActivityFeed(userId: string, limit = 50): Promise<ActivityCard[]> {
  const { data, error } = await supabase.rpc('get_activity_feed', { p_user_id: userId, p_limit: limit });

  if (error) {
    // Fall back to a simple query if the RPC doesn't exist yet.
    return fetchActivityFeedSimple(userId, limit);
  }

  return (data ?? []).map(mapRow);
}

/** Fallback: fetch recent shares + joins without RPC. Slower but works. */
async function fetchActivityFeedSimple(userId: string, limit: number): Promise<ActivityCard[]> {
  const { data: shares, error } = await supabase
    .from('activity_shares')
    .select(
      `
      share_id:id,
      workout_id,
      user_id,
      caption,
      share_created_at:created_at,
      users!inner(display_name),
      workout_logs!inner(session_type, total_duration_s, total_distance_km)
    `,
    )
    // Degraded fallback for when the get_activity_feed RPC is unavailable.
    // activity_shares RLS only exposes the caller's own rows (user_id =
    // auth.uid()), so friends' activity can't appear here — scope explicitly to
    // make that intent clear and defend in depth. The RPC is the real feed path.
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Fetch kudos for all shares.
  const shareIds = (shares ?? []).map((s) => (s as any).share_id);
  const { data: kudosData } = await supabase
    .from('kudos')
    .select('share_id, from_user')
    .in('share_id', shareIds);

  const kudosByShare = new Map<string, Set<string>>();
  for (const kudo of kudosData ?? []) {
    if (!kudosByShare.has(kudo.share_id)) kudosByShare.set(kudo.share_id, new Set());
    kudosByShare.get(kudo.share_id)!.add(kudo.from_user);
  }

  return (shares ?? [])
    .filter((s) => (s as any).users && (s as any).workout_logs)
    .map((s) => {
      const row = s as any;
      const kudos = kudosByShare.get(row.share_id) ?? new Set();
      return {
        shareId: row.share_id,
        workoutId: row.workout_id,
        userId: row.user_id,
        userName: row.users.display_name,
        caption: row.caption,
        sessionType: row.workout_logs.session_type,
        durationMinutes: row.workout_logs.total_duration_s ? Math.round(row.workout_logs.total_duration_s / 60) : null,
        distanceKm: row.workout_logs.total_distance_km,
        postedAt: row.share_created_at,
        kudoCount: kudos.size,
        hasKudo: kudos.has(userId),
      };
    });
}

/** Post a completed workout as an activity card. */
export async function shareWorkout(
  userId: string,
  workoutId: string,
  caption?: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('activity_shares')
    .insert({ user_id: userId, workout_id: workoutId, caption: caption ?? null })
    .select('id')
    .single();

  if (error || !data) throw error ?? new Error('Failed to share workout');
  return data.id;
}

/** Give or remove a kudo on a shared workout. Returns true if kudo was added, false if removed. */
export async function toggleKudo(shareId: string, userId: string): Promise<boolean> {
  // Check if already has kudo.
  const { data: existing } = await supabase
    .from('kudos')
    .select('id')
    .eq('share_id', shareId)
    .eq('from_user', userId)
    .maybeSingle();

  if (existing) {
    // Remove kudo.
    const { error } = await supabase
      .from('kudos')
      .delete()
      .eq('share_id', shareId)
      .eq('from_user', userId);
    if (error) throw error;
    return false;
  }

  // Add kudo.
  const { error } = await supabase
    .from('kudos')
    .insert({ share_id: shareId, from_user: userId });
  if (error) {
    // 23505 = a concurrent tap already inserted this kudo (kudos has a
    // UNIQUE(share_id, from_user) constraint). The check-then-insert above is
    // not atomic, so treat the conflict as "kudo present" instead of surfacing
    // a race error to the user.
    if ((error as { code?: string }).code === '23505') return true;
    throw error;
  }
  return true;
}

/** Delete a shared workout (soft delete). */
export async function deleteShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_shares')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', shareId);
  if (error) throw error;
}
