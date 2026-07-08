import { supabase } from '@/services/supabase';

export interface FriendSearchResult {
  userId: string;
  displayName: string;
  /** null = no relationship yet; otherwise the existing friendship's status. */
  friendshipStatus: 'pending' | 'accepted' | 'blocked' | null;
}

export interface PendingFriendRequest {
  friendshipId: string;
  requesterUserId: string;
  requesterDisplayName: string;
  createdAt: string;
}

/** Exact-email lookup — "add someone you know the email of," not a directory browse. */
export async function searchUserByEmail(email: string): Promise<FriendSearchResult | null> {
  const { data, error } = await supabase.rpc('search_user_by_email', { p_email: email.trim() });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    friendshipStatus: row.friendship_status,
  };
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) throw error;
}

export async function fetchPendingRequests(userId: string): Promise<PendingFriendRequest[]> {
  const { data, error } = await supabase.rpc('get_pending_friend_requests', { p_user_id: userId });
  if (error) throw error;
  return (data ?? []).map((row: {
    friendship_id: string;
    requester_user_id: string;
    requester_display_name: string;
    created_at: string;
  }) => ({
    friendshipId: row.friendship_id,
    requesterUserId: row.requester_user_id,
    requesterDisplayName: row.requester_display_name,
    createdAt: row.created_at,
  }));
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw error;
}

/** Declines an incoming request or cancels one the caller sent — same delete either way. */
export async function declineOrRemoveFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

/**
 * Removes an accepted friend. get_my_friends doesn't expose the friendship
 * row's own id (just the friend's user id), so this matches on the pair of
 * user ids instead — the friendship could be stored in either direction.
 */
export async function removeFriendByUserId(currentUserId: string, friendUserId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${currentUserId})`,
    );
  if (error) throw error;
}
