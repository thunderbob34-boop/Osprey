import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getSession } from './auth';
import type { UnitSystem } from './units';

export function useSessionUser() {
  return useQuery({
    queryKey: ['session-user'],
    queryFn: async () => {
      const session = await getSession();
      if (!session) return null;
      return { id: session.user.id, email: session.user.email ?? '' };
    },
    staleTime: 5 * 60_000,
  });
}

export interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  experience_tier: 'beginner' | 'intermediate' | 'advanced';
  units: UnitSystem;
}

export function useUserProfile() {
  const { data: sessionUser } = useSessionUser();
  return useQuery({
    queryKey: ['user-profile', sessionUser?.id],
    enabled: !!sessionUser,
    queryFn: async (): Promise<UserProfile> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, experience_tier, units')
        .eq('id', sessionUser!.id)
        .single();
      if (error) throw error;
      return data as UserProfile;
    },
  });
}
