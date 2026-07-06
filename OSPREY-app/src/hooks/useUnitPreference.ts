import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUnitPreference, updateUnitPreference, type UnitSystem } from '@/services/units';
import { useAuthStore } from '@/store/authStore';

export function useUnitPreference() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ['unit-preference', userId];

  const query = useQuery<UnitSystem>({
    queryKey,
    queryFn: () => fetchUnitPreference(userId!),
    enabled: Boolean(userId),
    staleTime: Infinity,
  });

  const setUnits = useMutation({
    mutationFn: (units: UnitSystem) => updateUnitPreference(userId!, units),
    onSuccess: (_data, units) => queryClient.setQueryData(queryKey, units),
  });

  return { units: query.data ?? 'imperial', isLoading: query.isLoading, setUnits };
}
