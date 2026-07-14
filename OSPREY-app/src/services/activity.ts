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
  // Relying on RLS alone here previously meant a permissive `activity_shares`
  // policy would leak every user's shares through this fallback path — scope
  // explicitly to the caller + their accepted friends, matching what
  // get_activity_feed does server-side.
  const { data: friendRows } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  const friendIds = new Set<string>([userId]);
  for (const row of friendRows ?? []) {
    friendIds.add(row.requester_id === userId ? row.addressee_id : row.requester_id);
  }

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
    .is('deleted_at', null)
    .in('user_id', Array.from(friendIds))
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

const POSTGRES_UNIQUE_VIOLATION = '23505';

/** Give or remove a kudo on a shared workout. Returns true if kudo was added, false if removed.
 *
 * The read-then-write below is inherently racy under a rapid double-tap (both
 * reads can see "no kudo yet"), so both branches tolerate the DB's UNIQUE
 * (share_id, from_user) constraint firing instead of surfacing it as an error:
 * a losing INSERT is treated as "kudo already given" (true), and a losing
 * DELETE (0 rows affected) is simply a no-op.
 */
export async function toggleKudo(shareId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('kudos')
    .select('id')
    .eq('share_id', shareId)
    .eq('from_user', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('kudos')
      .delete()
      .eq('share_id', shareId)
      .eq('from_user', userId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from('kudos')
    .insert({ share_id: shareId, from_user: userId });
  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) return true;
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
