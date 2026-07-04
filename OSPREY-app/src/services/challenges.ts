import { supabase } from '@/services/supabase';

export type ChallengeType = 'mileage' | 'workouts' | 'duration';

export interface Challenge {
  id: string;
  creatorUserId: string;
  name: string;
  type: ChallengeType;
  startsOn: string; // YYYY-MM-DD
  endsOn: string;   // YYYY-MM-DD
  memberCount: number;
  daysLeft: number;  // negative = ended
  status: 'upcoming' | 'active' | 'past';
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  value: number;
  rank: number;
}

export interface FriendUser {
  friendUserId: string;
  friendDisplayName: string;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  mileage:  '🏃 Miles',
  workouts: '💪 Workouts',
  duration: '⏱️ Minutes',
};

export function formatChallengeValue(value: number, type: ChallengeType): string {
  if (type === 'mileage')  return `${value.toFixed(1)} mi`;
  if (type === 'workouts') return `${Math.round(value)} workouts`;
  return `${Math.round(value)} min`;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysLeftUntil(endsOn: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = endsOn.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

function challengeStatus(startsOn: string, endsOn: string): Challenge['status'] {
  const today = todayStr();
  if (today < startsOn) return 'upcoming';
  if (today > endsOn)   return 'past';
  return 'active';
}

/** Returns first and last day of the current calendar month as YYYY-MM-DD. */
export function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${lastDay}` };
}

// ── Queries ───────────────────────────────────────────────────────────────────

interface ChallengeRow {
  id: string;
  creator_user_id: string;
  name: string;
  type: ChallengeType;
  starts_on: string;
  ends_on: string;
}

interface MemberCountRow {
  challenge_id: string;
  count: number;
}

export async function fetchMyChallenges(userId: string): Promise<Challenge[]> {
  // Fetch challenges the user is a member of.
  const { data: memberRows, error: memberError } = await supabase
    .from('challenge_members')
    .select('challenge_id')
    .eq('user_id', userId);

  if (memberError) throw memberError;
  if (!memberRows || memberRows.length === 0) return [];

  const ids = memberRows.map((r) => r.challenge_id);

  const { data, error } = await supabase
    .from('challenges')
    .select('id, creator_user_id, name, type, starts_on, ends_on')
    .in('id', ids)
    .is('deleted_at', null)
    .order('starts_on', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Fetch member counts in one query.
  const { data: counts, error: countError } = await supabase
    .from('challenge_members')
    .select('challenge_id')
    .in('challenge_id', ids);

  if (countError) throw countError;

  const countMap: Record<string, number> = {};
  (counts ?? []).forEach((r) => {
    countMap[r.challenge_id] = (countMap[r.challenge_id] ?? 0) + 1;
  });

  return (data as ChallengeRow[]).map((row) => ({
    id: row.id,
    creatorUserId: row.creator_user_id,
    name: row.name,
    type: row.type,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    memberCount: countMap[row.id] ?? 1,
    daysLeft: daysLeftUntil(row.ends_on),
    status: challengeStatus(row.starts_on, row.ends_on),
  }));
}

export async function fetchChallengeLeaderboard(
  challengeId: string,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_challenge_leaderboard', {
    p_challenge_id: challengeId,
  });
  if (error) throw error;
  return (data ?? []).map((row: {
    user_id: string;
    display_name: string;
    value: number;
    rank: number;
  }) => ({
    userId: row.user_id,
    displayName: row.display_name,
    value: Number(row.value),
    rank: Number(row.rank),
  }));
}

export async function fetchMyFriends(userId: string): Promise<FriendUser[]> {
  // userId is unused server-side — get_my_friends scopes to auth.uid()
  // internally so a caller can't pass someone else's id and read their friends.
  const { data, error } = await supabase.rpc('get_my_friends');
  if (error) throw error;
  return (data ?? []).map((row: { friend_user_id: string; friend_display_name: string }) => ({
    friendUserId: row.friend_user_id,
    friendDisplayName: row.friend_display_name,
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface CreateChallengeInput {
  name: string;
  type: ChallengeType;
  startsOn: string;
  endsOn: string;
  invitedFriendIds: string[];
}

export async function createChallenge(
  userId: string,
  input: CreateChallengeInput,
): Promise<string> {
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_user_id: userId,
      name: input.name.trim(),
      type: input.type,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .select('id')
    .single();

  if (error || !data) throw error ?? new Error('Failed to create challenge');

  const challengeId = (data as { id: string }).id;

  // Add creator + invited friends as members.
  const memberRows = [userId, ...input.invitedFriendIds].map((uid) => ({
    challenge_id: challengeId,
    user_id: uid,
  }));

  const { error: memberError } = await supabase.from('challenge_members').insert(memberRows);
  if (memberError) throw memberError;

  return challengeId;
}

export async function leaveChallenge(challengeId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('challenge_members')
    .delete()
    .eq('challenge_id', challengeId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', challengeId);
  if (error) throw error;
}
