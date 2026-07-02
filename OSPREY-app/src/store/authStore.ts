import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { clearOfflineCache } from '@/services/offline-cache';
import { resetRevenueCatOnSignOut } from '@/services/subscriptions';
import { resetSubscriptionCache } from '@/hooks/useSubscription';
import { useWorkoutStore } from '@/store/workoutStore';
import { useOnboardingStore } from '@/store/onboardingStore';

export interface UserProfile {
  id: string;
  display_name: string;
  onboarding_complete: boolean;
  experience_tier: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  profileReady: boolean;
  profileError: string | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

function fallbackProfile(user: User): UserProfile {
  return {
    id: user.id,
    display_name:
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Athlete',
    onboarding_complete: false,
    experience_tier: 'beginner',
  };
}

async function ensureUserRow(user: User, displayName?: string): Promise<UserProfile | null> {
  const email = user.email ?? '';
  const name =
    displayName ??
    (user.user_metadata?.display_name as string | undefined) ??
    email.split('@')[0] ??
    'Athlete';

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        email,
        display_name: name,
        build_type: 'personal',
        onboarding_complete: false,
      },
      { onConflict: 'id' },
    )
    .select('id, display_name, onboarding_complete, experience_tier')
    .single();

  if (error) {
    console.warn('[Auth] ensureUserRow error:', error.message);
    return null;
  }

  return data;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  profileReady: false,
  profileError: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, initialized: true });

    if (session?.user) {
      await get().fetchProfile();
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null, profileReady: false });
      if (session?.user) {
        await get().fetchProfile();
      } else {
        set({ profile: null, profileReady: true, profileError: null });
      }
    });
  },

  fetchProfile: async () => {
    const user = get().user;
    if (!user) {
      set({ profile: null, profileReady: true, profileError: null });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, onboarding_complete, experience_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[Auth] fetchProfile error:', error.message);
      // Leave `profile` null (not a synthetic onboarding_complete:false profile) so
      // app/index.tsx shows the "Could not load profile / Try Again" screen instead
      // of routing an already-onboarded user back through onboarding on a transient
      // network error, which would re-run onboarding and overwrite their real data.
      set({
        profile: null,
        profileReady: true,
        profileError: error.message,
      });
      return;
    }

    if (!data) {
      const created = await ensureUserRow(user);
      set({
        profile: created ?? fallbackProfile(user),
        profileReady: true,
        profileError: created ? null : 'Could not create user profile row.',
      });
      return;
    }

    set({ profile: data, profileReady: true, profileError: null });
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      set({ loading: false });
      return { error: error.message };
    }

    if (data.user) {
      const created = await ensureUserRow(data.user, displayName);
      if (!created) {
        set({ loading: false });
        return {
          error:
            'Account created but profile could not be saved. Run 002_fix_users_rls.sql in Supabase.',
        };
      }
      set({ profile: created, profileReady: true, profileError: null });
    }

    set({ loading: false });
    return { error: null };
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await get().fetchProfile();
    }
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await clearOfflineCache();
    try {
      // Purchases.logOut() can reject (e.g. already-anonymous user, SDK
      // error) — must not skip the local state reset below on failure, or
      // the device is left signed out of Supabase but still holding stale
      // local auth/subscription/workout state.
      await resetRevenueCatOnSignOut();
    } catch (err) {
      console.warn('[Auth] resetRevenueCatOnSignOut error:', err);
    }
    resetSubscriptionCache();
    useWorkoutStore.getState().reset();
    useOnboardingStore.getState().reset();
    set({
      session: null,
      user: null,
      profile: null,
      profileReady: true,
      profileError: null,
    });
  },
}));
