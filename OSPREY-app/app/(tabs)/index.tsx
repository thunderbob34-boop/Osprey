import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import DailySummaryScreen from '@/screens/DailySummary';
import BuildPlanBanner from '@/components/BuildPlanBanner';
import DeloadSuggestionCard from '@/components/DeloadSuggestionCard';
import WeatherCoachCard from '@/components/WeatherCoachCard';
import { useDailySummary } from '@/hooks/useDailySummary';
import { useWeatherCoach } from '@/hooks/useWeatherCoach';
import { useFuelStatus } from '@/hooks/useFuelStatus';
import { usePerformance } from '@/hooks/usePerformance';
import { usePlanDeload } from '@/hooks/usePlanDeload';
import { useSubscription } from '@/hooks/useSubscription';
import type { SessionData } from '@/types/daily-summary';
import type { SwappableSessionType } from '@/services/plan';

export default function HomeTab() {
  const router = useRouter();
  const { data, isLoading, isRefetching, error, refetch, swapSession, compressSession } = useDailySummary();
  const { data: fuelStatus } = useFuelStatus();
  const { isPlus } = useSubscription();
  const { data: perf } = usePerformance();
  const { suggestion: deloadSuggestion, isAccepting: isDeloadAccepting, accept: acceptDeload, dismiss: dismissDeload } = usePlanDeload();
  const { data: weatherCoach } = useWeatherCoach(data?.session?.sessionType ?? null);

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

  const hasPlan = Boolean(data?.session?.sessionId);

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
      weekMiles={data?.weekMiles}
      weekTarget={data?.weekTarget}
      habitTip={data?.habitTip}
      quickStats={data?.quickStats}
      trainingReadiness={isPlus ? (perf?.trainingReadiness ?? null) : null}
      onActivityPress={() => router.push('/activity')}
      onViewWeekPress={() => router.push('/plan-preview')}
      weatherCard={weatherCoach ? <WeatherCoachCard weather={weatherCoach} /> : undefined}
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
