import { supabase } from '@/services/supabase';

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';

export interface FoundUser {
  userId: string;
  displayName: string;
  status: FriendshipStatus;
}

export interface PendingRequest {
  friendshipId: string;
  otherUserId: string;
  otherDisplayName: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
}

export interface Friend {
  friendUserId: string;
  friendDisplayName: string;
}

/** Exact-email lookup — see the SQL comment on find_user_by_email for why this isn't a fuzzy search. */
export async function findUserByEmail(email: string): Promise<FoundUser | null> {
  const { data, error } = await supabase.rpc('find_user_by_email', { p_email: email.trim() });
  if (error) throw error;
  const row = (data ?? [])[0] as { user_id: string; display_name: string; friendship_status: FriendshipStatus } | undefined;
  if (!row) return null;
  return { userId: row.user_id, displayName: row.display_name, status: row.friendship_status };
}

export async function fetchPendingFriendRequests(): Promise<PendingRequest[]> {
  const { data, error } = await supabase.rpc('get_pending_friend_requests');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    friendshipId: row.friendship_id,
    otherUserId: row.other_user_id,
    otherDisplayName: row.other_display_name,
    direction: row.direction,
    createdAt: row.created_at,
  }));
}

export async function fetchMyFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('get_my_friends', { p_user_id: userId });
  if (error) throw error;
  return (data ?? []).map((row: { friend_user_id: string; friend_display_name: string }) => ({
    friendUserId: row.friend_user_id,
    friendDisplayName: row.friend_display_name,
  }));
}

/**
 * Sends a friend request. If the target already sent *us* a pending
 * request, accepts theirs instead of creating a redundant second row in
 * the other direction (friendships.UNIQUE(requester_id, addressee_id) is
 * per-direction, so A→B and B→A can otherwise coexist as two open requests).
 */
export async function sendFriendRequest(userId: string, target: FoundUser): Promise<void> {
  if (target.status === 'pending_received') {
    const { data, error: findErr } = await supabase
      .from('friendships')
      .select('id')
      .eq('requester_id', target.userId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .maybeSingle();
    if (findErr) throw findErr;
    if (data) {
      await respondToFriendRequest(data.id, 'accept');
      return;
    }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, addressee_id: target.userId, status: 'pending' });
  if (error) throw error;
}

export async function respondToFriendRequest(friendshipId: string, action: 'accept' | 'decline'): Promise<void> {
  if (action === 'accept') {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriend(userId: string, friendUserId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${userId})`,
    );
  if (error) throw error;
}
