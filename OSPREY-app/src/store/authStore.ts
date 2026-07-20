import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/services/supabase';
import { clearOfflineCache } from '@/services/offline-cache';
import { resetRevenueCat } from '@/services/subscriptions';
import { friendlyError } from '@/utils/errorMessage';

// WebBrowser is optional — only available in native builds
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
} catch {
  // Module not available in development build; Google sign-in will be disabled
}

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
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
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
      set({
        profile: fallbackProfile(user),
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

  signInWithApple: async () => {
    set({ loading: true });
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        return { error: 'Apple sign-in returned no identity token.' };
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { error: error.message };

      // Apple only shares the name on the FIRST authorization — persist it now.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      if (data.user && fullName) {
        await ensureUserRow(data.user, fullName);
      }
      await get().fetchProfile();
      return { error: null };
    } catch (err) {
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return { error: null };
      }
      return { error: friendlyError(err, 'Apple sign-in failed.') };
    } finally {
      set({ loading: false });
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true });
    try {
      const redirectTo = makeRedirectUri({ scheme: 'osprey', path: 'auth-callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        return { error: error?.message ?? 'Could not start Google sign-in.' };
      }

      if (!WebBrowser?.openAuthSessionAsync) {
        return { error: 'Google sign-in is not available in this build.' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return { error: null }; // user canceled

      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) return { error: exchangeError.message };
      } else {
        const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
        const accessToken = fragment.get('access_token');
        const refreshToken = fragment.get('refresh_token');
        if (!accessToken || !refreshToken) {
          return { error: 'Google sign-in did not return a session.' };
        }
        const { error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setError) return { error: setError.message };
      }
      await get().fetchProfile();
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err, 'Google sign-in failed.') };
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await resetRevenueCat();
    await clearOfflineCache();
    set({
      session: null,
      user: null,
      profile: null,
      profileReady: true,
      profileError: null,
    });
  },

  sendPasswordReset: async (email) => {
    const redirectTo = makeRedirectUri({ scheme: 'osprey', path: 'reset-password' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  },

  deleteAccount: async () => {
    set({ loading: true });
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return { error: error.message };

      // The auth user no longer exists, so signOut may 4xx — clean up locally.
      await supabase.auth.signOut().catch(() => undefined);
      await resetRevenueCat();
      await clearOfflineCache();
      set({
        session: null,
        user: null,
        profile: null,
        profileReady: true,
        profileError: null,
      });
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err, 'Could not delete account.') };
    } finally {
      set({ loading: false });
    }
  },
}));
