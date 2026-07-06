import { supabase } from '@/services/supabase';

export interface FoundUser {
  id: string;
  displayName: string;
}

export interface FriendRequest {
  requestId: string;
  otherUserId: string;
  otherDisplayName: string;
  createdAt: string;
}

export interface FriendUser {
  friendUserId: string;
  friendDisplayName: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function searchUserByEmail(email: string): Promise<FoundUser | null> {
  const { data, error } = await supabase.rpc('search_user_by_email', {
    p_email: email.trim(),
  });
  if (error) throw error;
  const row = (data ?? [])[0] as { id: string; display_name: string } | undefined;
  if (!row) return null;
  return { id: row.id, displayName: row.display_name };
}

interface PendingRequestRow {
  request_id: string;
  direction: 'incoming' | 'outgoing';
  other_user_id: string;
  other_display_name: string;
  created_at: string;
}

async function fetchPendingRequests(userId: string): Promise<PendingRequestRow[]> {
  const { data, error } = await supabase.rpc('get_pending_friend_requests', {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data ?? []) as PendingRequestRow[];
}

export async function fetchIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await fetchPendingRequests(userId);
  return rows
    .filter((r) => r.direction === 'incoming')
    .map((r) => ({
      requestId: r.request_id,
      otherUserId: r.other_user_id,
      otherDisplayName: r.other_display_name,
      createdAt: r.created_at,
    }));
}

export async function fetchOutgoingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await fetchPendingRequests(userId);
  return rows
    .filter((r) => r.direction === 'outgoing')
    .map((r) => ({
      requestId: r.request_id,
      otherUserId: r.other_user_id,
      otherDisplayName: r.other_display_name,
      createdAt: r.created_at,
    }));
}

export async function fetchFriends(userId: string): Promise<FriendUser[]> {
  const { data, error } = await supabase.rpc('get_my_friends', {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data ?? []).map((row: { friend_user_id: string; friend_display_name: string }) => ({
    friendUserId: row.friend_user_id,
    friendDisplayName: row.friend_display_name,
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function sendFriendRequest(userId: string, targetUserId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, addressee_id: targetUserId });
  if (error) throw error;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', requestId);
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', requestId);
  if (error) throw error;
}

// Note: get_my_friends (unchanged, pre-existing RPC) returns the *other* user's
// id, not the underlying friendships row id — so removal is keyed off the pair
// of user ids rather than a request id. RLS allows either party to delete an
// accepted friendship, and this matches regardless of who was the requester.
export async function removeFriend(userId: string, friendUserId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${userId})`,
    );
  if (error) throw error;
}
