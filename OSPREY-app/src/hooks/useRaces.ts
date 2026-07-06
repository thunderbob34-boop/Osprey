import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRaceEvent,
  deleteRaceEvent,
  fetchPastRaces,
  fetchUpcomingRaces,
  generateOzzieBriefing,
  generateOzzieRetro,
  linkRaceToActivePlan,
  recordRaceResult,
  updateRaceLogistics,
  updateRaceRetro,
  type RaceEvent,
  type RaceEventInput,
  type RaceLogisticsUpdate,
  type RaceRetroUpdate,
} from '@/services/races';
import { withCache } from '@/services/offline-cache';
import { reconcileRaceWeekReminders } from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';

export function useRaces() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const upcomingKey = ['races-upcoming', userId];
  const pastKey = ['races-past', userId];

  const upcoming = useQuery({
    queryKey: upcomingKey,
    queryFn: () => withCache(upcomingKey, () => fetchUpcomingRaces(userId!)),
    enabled: Boolean(userId),
  });

  const past = useQuery({
    queryKey: pastKey,
    queryFn: () => withCache(pastKey, () => fetchPastRaces(userId!)),
    enabled: Boolean(userId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: upcomingKey });
    queryClient.invalidateQueries({ queryKey: pastKey });
  }

  const create = useMutation({
    mutationFn: (input: RaceEventInput) => createRaceEvent(userId!, input),
    onSuccess: () => {
      invalidate();
      if (userId) reconcileRaceWeekReminders(userId).catch(() => undefined);
    },
  });

  const recordResult = useMutation({
    mutationFn: ({ raceId, resultTimeS }: { raceId: string; resultTimeS: number }) =>
      recordRaceResult(raceId, resultTimeS),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (raceId: string) => deleteRaceEvent(raceId),
    onSuccess: () => {
      invalidate();
      if (userId) reconcileRaceWeekReminders(userId).catch(() => undefined);
    },
  });

  const linkToPlan = useMutation({
    mutationFn: (raceId: string) => linkRaceToActivePlan(userId!, raceId),
  });

  const saveLogistics = useMutation({
    mutationFn: ({ raceId, update }: { raceId: string; update: RaceLogisticsUpdate }) =>
      updateRaceLogistics(raceId, update),
    onSuccess: invalidate,
  });

  const generateBriefing = useMutation({
    mutationFn: async (race: RaceEvent) => {
      const text = await generateOzzieBriefing(race);
      await updateRaceLogistics(race.id, { ozzieBriefingText: text });
      return text;
    },
    onSuccess: invalidate,
  });

  const saveRetro = useMutation({
    mutationFn: ({ raceId, update }: { raceId: string; update: RaceRetroUpdate }) =>
      updateRaceRetro(raceId, update),
    onSuccess: invalidate,
  });

  const generateRetro = useMutation({
    mutationFn: async ({ race, feelScore }: { race: RaceEvent; feelScore: number | null }) => {
      const text = await generateOzzieRetro(race, feelScore);
      await updateRaceRetro(race.id, { ozzieRetroText: text });
      return text;
    },
    onSuccess: invalidate,
  });

  return {
    upcoming: upcoming.data as RaceEvent[] | undefined,
    past: past.data as RaceEvent[] | undefined,
    isLoading: upcoming.isLoading || past.isLoading,
    error: upcoming.error ?? past.error,
    create,
    recordResult,
    remove,
    linkToPlan,
    saveLogistics,
    generateBriefing,
    saveRetro,
    generateRetro,
  };
}
