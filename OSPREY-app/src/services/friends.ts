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

/**
 * Normalizes a user-entered phone number to E.164 ("+15551234567") so search
 * and storage always compare the same shape. A bare 10-digit number is
 * assumed US/Canada (+1) — this app's default locale (see users.timezone's
 * own 'America/Chicago' default) — anything else needs its own leading "+".
 * Returns null if the result doesn't look like a real phone number.
 */
export function normalizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  const candidate =
    hasLeadingPlus || (digits.length === 11 && digits.startsWith('1'))
      ? `+${digits}`
      : digits.length === 10
        ? `+1${digits}`
        : `+${digits}`;

  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
}

/** Exact-phone lookup, same trust model as searchUserByEmail. Expects an already-normalized E.164 number. */
export async function searchUserByPhone(phone: string): Promise<FriendSearchResult | null> {
  const { data, error } = await supabase.rpc('search_user_by_phone', { p_phone: phone });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    friendshipStatus: row.friendship_status,
  };
}

/** One search box for both — routes by whether the input looks like an email or a phone number. */
export async function searchUserByEmailOrPhone(query: string): Promise<FriendSearchResult | null> {
  const trimmed = query.trim();
  if (trimmed.includes('@')) return searchUserByEmail(trimmed);

  const normalized = normalizePhoneNumber(trimmed);
  if (!normalized) throw new Error('Enter a valid email address or phone number.');
  return searchUserByPhone(normalized);
}

export async function fetchMyPhone(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('phone').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.phone ?? null;
}

/** Pass null to clear a previously-set number. */
export async function updateMyPhone(userId: string, phone: string | null): Promise<void> {
  const { error } = await supabase.from('users').update({ phone }).eq('id', userId);
  if (error) throw error;
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
