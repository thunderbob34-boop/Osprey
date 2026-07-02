import { useQuery } from '@tanstack/react-query';
import { fetchCalendarMonth } from '@/services/calendar';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useCalendarMonth(year: number, month: number) {
  const userId = useAuthStore((s) => s.user?.id);
  const queryKey = ['calendar-month', userId, year, month];

  return useQuery({
    queryKey,
    queryFn: () => withCache(queryKey, () => fetchCalendarMonth(userId!, year, month)),
    enabled: Boolean(userId),
  });
}
