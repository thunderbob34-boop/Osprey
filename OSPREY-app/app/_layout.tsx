import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/authStore';
import { initRevenueCat } from '@/services/subscriptions';
import { reconcileSupplementReminders } from '@/services/supplements';
import { reconcileRaceWeekReminders } from '@/services/notifications';
import { syncCalendarBlocks } from '@/services/calendar-blocking';
import { fetchDefaultLiftExercises } from '@/services/workouts';
import { ozziePrewarm } from '@/services/ozzie-audio';
import { Colors } from '@/constants/colors';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';

SplashScreen.preventAutoHideAsync();

// No-ops until EXPO_PUBLIC_SENTRY_DSN is set (in .env.local locally, and as an
// EAS environment variable for builds) — see docs/TODO.md.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn) && !__DEV__,
});

const queryClient = new QueryClient();

function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const userId = useAuthStore((s) => s.user?.id);

  // Hide the native splash immediately — AppLoadingScreen handles the branded wait
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (userId) {
      initRevenueCat(userId).catch(() => undefined);
      reconcileSupplementReminders(userId).catch(() => undefined);
      reconcileRaceWeekReminders(userId).catch(() => undefined);
      syncCalendarBlocks(userId).catch(() => undefined);
      // Warm the offline cache for the exercise library so lift logging works
      // without a signal even if the user hasn't opened the workout screen yet.
      fetchDefaultLiftExercises().catch(() => undefined);
    }
  }, [userId]);

  useEffect(() => {
    ozziePrewarm().catch(() => undefined);
  }, []);

  if (!initialized) {
    return <AppLoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="food-scanner" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="calendar" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="supplements" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="races" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="activity" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="friends" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="challenges" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="preferences" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="race-search" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="race-event" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
