import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addRacePartner,
  fetchFriendsAtRace,
  fetchRacePartners,
  removeRacePartner,
  type FriendAtRace,
  type RacePartner,
} from '@/services/racePartners';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';
import type { RaceEvent } from '@/services/races';

export function useRacePartners(race: RaceEvent) {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const friendsKey = ['race-friends-at-date', userId, race.eventDate];
  const partnersKey = ['race-partners', race.id];

  const friendsAtRace = useQuery({
    queryKey: friendsKey,
    queryFn: () =>
      withCache(friendsKey, () => fetchFriendsAtRace(race.eventDate)),
    enabled: Boolean(userId),
  });

  const partners = useQuery({
    queryKey: partnersKey,
    queryFn: () => withCache(partnersKey, () => fetchRacePartners(race.id)),
    enabled: Boolean(race.id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: partnersKey });
  }

  const addPartner = useMutation({
    mutationFn: (partnerUserId: string) => addRacePartner(race.id, partnerUserId),
    onSuccess: invalidate,
  });

  const removePartner = useMutation({
    mutationFn: (partnerUserId: string) => removeRacePartner(race.id, partnerUserId),
    onSuccess: invalidate,
  });

  const partnerIds = new Set((partners.data as RacePartner[] | undefined)?.map((p) => p.partnerUserId) ?? []);

  return {
    friendsAtRace: friendsAtRace.data as FriendAtRace[] | undefined,
    partners: partners.data as RacePartner[] | undefined,
    partnerIds,
    isLoading: friendsAtRace.isLoading || partners.isLoading,
    addPartner,
    removePartner,
  };
}
