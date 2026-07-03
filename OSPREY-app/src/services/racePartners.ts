import { supabase } from '@/services/supabase';

export interface FriendAtRace {
  friendUserId: string;
  friendDisplayName: string;
  friendRaceId: string;
  friendRaceName: string;
}

export interface RacePartner {
  partnerUserId: string;
  partnerDisplayName: string;
}

export async function fetchFriendsAtRace(
  userId: string,
  eventDate: string,
): Promise<FriendAtRace[]> {
  const { data, error } = await supabase.rpc('get_friends_at_race', {
    p_event_date: eventDate,
  });
  if (error) throw error;
  return (data ?? []).map((row: {
    friend_user_id: string;
    friend_display_name: string;
    friend_race_id: string;
    friend_race_name: string;
  }) => ({
    friendUserId: row.friend_user_id,
    friendDisplayName: row.friend_display_name,
    friendRaceId: row.friend_race_id,
    friendRaceName: row.friend_race_name,
  }));
}

export async function fetchRacePartners(raceId: string): Promise<RacePartner[]> {
  const { data, error } = await supabase.rpc('get_race_partners', {
    p_race_id: raceId,
  });
  if (error) throw error;
  return (data ?? []).map((row: {
    partner_user_id: string;
    partner_display_name: string;
  }) => ({
    partnerUserId: row.partner_user_id,
    partnerDisplayName: row.partner_display_name,
  }));
}

export async function addRacePartner(raceId: string, partnerUserId: string): Promise<void> {
  const { error } = await supabase
    .from('race_partners')
    .insert({ race_id: raceId, partner_user_id: partnerUserId });
  if (error) throw error;
}

export async function removeRacePartner(raceId: string, partnerUserId: string): Promise<void> {
  const { error } = await supabase
    .from('race_partners')
    .delete()
    .eq('race_id', raceId)
    .eq('partner_user_id', partnerUserId);
  if (error) throw error;
}
