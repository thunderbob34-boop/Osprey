import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import DailySummaryScreen from '@/screens/DailySummary';
import BuildPlanBanner from '@/components/BuildPlanBanner';
import DeloadSuggestionCard from '@/components/DeloadSuggestionCard';
import WeatherCoachCard from '@/components/WeatherCoachCard';
import { useDailySummary } from '@/hooks/useDailySummary';
import { useWeatherCoach } from '@/hooks/useWeatherCoach';
import { useSavedRoutes } from '@/hooks/useSavedRoutes';
import { useHydration } from '@/hooks/useHydration';
import { useFuelStatus } from '@/hooks/useFuelStatus';
import { usePerformance } from '@/hooks/usePerformance';
import { usePlanDeload } from '@/hooks/usePlanDeload';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuthStore } from '@/store/authStore';
import { reconcileEveningBrief } from '@/services/evening-brief';
import type { SessionData } from '@/types/daily-summary';
import type { SwappableSessionType } from '@/services/plan';

export default function HomeTab() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading, isRefetching, error, refetch, swapSession, compressSession, moveIndoors } = useDailySummary();
  const { data: fuelStatus } = useFuelStatus();
  const { isPlus } = useSubscription();
  const { data: perf } = usePerformance();
  const { suggestion: deloadSuggestion, isAccepting: isDeloadAccepting, accept: acceptDeload, dismiss: dismissDeload } = usePlanDeload();
  const { data: savedRoutes } = useSavedRoutes();
  const { data: weatherCoach } = useWeatherCoach(data?.session?.sessionType ?? null, savedRoutes);
  const { data: hydration, add: addHydration } = useHydration();

  // Reconcile tonight's evening look-ahead notification whenever tomorrow's
  // forecast actually changes — no-ops instantly if the user hasn't opted
  // in. Depends on the primitive values (not the `weatherCoach` object,
  // which react-query gives a new identity on every refetch) so this
  // doesn't re-run and re-schedule on every window-focus refetch.
  const tomorrowMaxF = weatherCoach?.tomorrow?.maxF;
  const tomorrowPrecip = weatherCoach?.tomorrow?.precipProbabilityMax;
  useEffect(() => {
    if (!userId) return;
    const tomorrowWeather =
      tomorrowMaxF != null && tomorrowPrecip != null
        ? { maxF: tomorrowMaxF, precipProbabilityMax: tomorrowPrecip }
        : null;
    reconcileEveningBrief(userId, tomorrowWeather).catch(() => undefined);
  }, [userId, tomorrowMaxF, tomorrowPrecip]);

  function handleStartSession(session: SessionData) {
    const sessionId = session.sessionId ?? undefined;
    if (session.sessionType === 'lift') {
      router.push({ pathname: '/workout/lift', params: { sessionId } });
      return;
    }
    router.push({ pathname: '/workout/run', params: { sessionId } });
  }

  function handleSwapSession(newType: SwappableSessionType) {
    const sessionId = data?.session.sessionId;
    if (!sessionId) return;
    swapSession.mutate(
      { sessionId, newType },
      {
        onError: (err) => {
          Alert.alert('Swap failed', err instanceof Error ? err.message : 'Try again.');
        },
      },
    );
  }

  function handleCompressSession(availableMinutes: number) {
    const sessionId = data?.session.sessionId;
    if (!sessionId) return;
    compressSession.mutate(
      { sessionId, availableMinutes },
      {
        onError: (err) => {
          Alert.alert('Compress failed', err instanceof Error ? err.message : 'Try again.');
        },
      },
    );
  }

  function handleAcceptDeload() {
    acceptDeload()?.catch((err) => {
      Alert.alert('De-load failed', err instanceof Error ? err.message : 'Try again.');
    });
  }

  function handleMoveIndoors() {
    const sessionId = data?.session?.sessionId;
    if (!sessionId) return;
    moveIndoors.mutate(sessionId, {
      onError: (err) => {
        Alert.alert('Could not move session', err instanceof Error ? err.message : 'Try again.');
      },
    });
  }

  const hasPlan = Boolean(data?.session?.sessionId);
  const alreadyIndoors = /\((Treadmill|Trainer|Indoor)\)/i.test(data?.session?.type ?? '');

  return (
    <DailySummaryScreen
      isLoading={isLoading}
      isRefreshing={isRefetching}
      error={error?.message ?? null}
      onRetry={() => refetch()}
      onRefresh={() => refetch()}
      onStartSession={handleStartSession}
      onSwapSession={handleSwapSession}
      onCompressSession={handleCompressSession}
      fuelStatus={fuelStatus}
      userName={data?.userName}
      recovery={data?.recovery}
      session={data?.session}
      weekDistanceKm={data?.weekDistanceKm}
      weekTargetKm={data?.weekTargetKm}
      habitTip={data?.habitTip}
      quickStats={data?.quickStats}
      trainingReadiness={isPlus ? (perf?.trainingReadiness ?? null) : null}
      onActivityPress={() => router.push('/activity')}
      onOzziePress={() => router.push('/ask-ozzie')}
      onViewWeekPress={() => router.push('/plan-preview')}
      onConnectHealthPress={() => router.push('/(tabs)/settings')}
      hydration={hydration}
      onAddHydration={(oz) => addHydration.mutate(oz)}
      hydrationEmphasized={weatherCoach?.severity === 'alert'}
      weatherCard={
        weatherCoach ? (
          <WeatherCoachCard
            weather={weatherCoach}
            onMoveIndoors={hasPlan ? handleMoveIndoors : undefined}
            movingIndoors={moveIndoors.isPending}
            alreadyIndoors={alreadyIndoors}
          />
        ) : undefined
      }
      headerBanner={
        !isLoading && !hasPlan ? (
          <BuildPlanBanner />
        ) : deloadSuggestion ? (
          <DeloadSuggestionCard
            session={deloadSuggestion.session}
            daysToHighRisk={deloadSuggestion.daysToHighRisk}
            isAccepting={isDeloadAccepting}
            onAccept={handleAcceptDeload}
            onDismiss={dismissDeload}
          />
        ) : undefined
      }
    />
  );
}
