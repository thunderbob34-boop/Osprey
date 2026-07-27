// (tabs)/_layout renders `null` while profileReady is false, so anything that
// clears that flag unmounts the entire tab UI to a black screen. The auth
// listener used to clear it on EVERY onAuthStateChange event — including the
// TOKEN_REFRESHED that Supabase fires on its own roughly hourly — so a signed-in
// athlete's app blanked periodically for no reason. These pin that only a real
// identity change puts us back into the not-ready state.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'osprey://' }));
jest.mock('expo-web-browser', () => ({}));
jest.mock('@/services/offline-cache', () => ({ clearOfflineCache: jest.fn() }));

const user = (id: string) => ({ id, email: `${id}@osprey.app`, user_metadata: {} });
const mockProfileRow = { id: 'u1', display_name: 'Alex', onboarding_complete: true, experience_tier: 'intermediate' };

let mockAuthCallback: (event: string, session: unknown) => Promise<void>;
let mockInitialSession: { user: ReturnType<typeof user> } | null = { user: user('u1') };

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: mockInitialSession } })),
      onAuthStateChange: jest.fn((cb: typeof mockAuthCallback) => {
        mockAuthCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({ data: mockProfileRow, error: null })),
    })),
  },
}));

import { useAuthStore } from '@/store/authStore';

describe('authStore — profileReady across auth events', () => {
  beforeEach(async () => {
    mockInitialSession = { user: user('u1') };
    useAuthStore.setState({
      session: null, user: null, profile: null,
      profileReady: false, profileError: null, loading: false, initialized: false,
    });
    await useAuthStore.getState().initialize();
  });

  it('keeps profileReady true through a token refresh for the same user', async () => {
    expect(useAuthStore.getState().profileReady).toBe(true);

    const readyDuringRefresh: boolean[] = [];
    const unsub = useAuthStore.subscribe((s) => readyDuringRefresh.push(s.profileReady));

    await mockAuthCallback('TOKEN_REFRESHED', { user: user('u1') });
    unsub();

    // Never dipped false at any point — a single false would have blanked the
    // tab layout for the duration of the profile re-fetch.
    expect(readyDuringRefresh).not.toContain(false);
    expect(useAuthStore.getState().profileReady).toBe(true);
  });

  it('still clears profileReady when a different user signs in', async () => {
    const seen: boolean[] = [];
    const unsub = useAuthStore.subscribe((s) => seen.push(s.profileReady));

    await mockAuthCallback('SIGNED_IN', { user: user('u2') });
    unsub();

    expect(seen).toContain(false);
    expect(useAuthStore.getState().profileReady).toBe(true);
  });

  it('marks ready with a null profile on sign-out', async () => {
    await mockAuthCallback('SIGNED_OUT', null);
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().profileReady).toBe(true);
  });
});
