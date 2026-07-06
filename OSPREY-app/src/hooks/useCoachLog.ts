import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { fetchCoachMemory, type CoachMemoryEntry } from '@/services/performance';

/** Chronological (newest-first) coach_memory history for the "Coach's Log" screen. */
export function useCoachLog() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<CoachMemoryEntry[]>({
    queryKey: ['coach-memory', userId],
    queryFn: () => fetchCoachMemory(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
