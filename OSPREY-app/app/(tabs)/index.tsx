import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import DailySummaryScreen from '@/screens/DailySummary';
import BuildPlanBanner from '@/components/BuildPlanBanner';
import RampBanner from '@/components/RampBanner';
import { useDailySummary } from '@/hooks/useDailySummary';
import { useFuelStatus } from '@/hooks/useFuelStatus';
import { usePerformance } from '@/hooks/usePerformance';
import { useSubscription } from '@/hooks/useSubscription';
import { useTrainingGap } from '@/hooks/useTrainingGap';
import { dismissRampBanner } from '@/services/return-to-training';
import { useAuthStore } from '@/store/authStore';
import type { SessionData } from '@/types/daily-summary';
import type { SwappableSessionType } from '@/services/plan';

export default function HomeTab() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading, isRefetching, error, refetch, swapSession, compressSession } = useDailySummary();
  const { data: fuelStatus } = useFuelStatus();
  const { isPlus } = useSubscription();
  const { data: perf } = usePerformance();
  const { data: gapState, invalidate: invalidateGap } = useTrainingGap();

  async function handleDismissRamp() {
    if (userId && gapState?.gap) {
      await dismissRampBanner(userId, gapState.gap.lastWorkoutAt);
      invalidateGap();
    }
  }

  function handleStartSession(session: SessionData) {
    const sessionId = session.sessionId ?? undefined;
    if (session.sessionType === 'lift') {
      router.push({ pathname: '/workout/lift', params: { sessionId } });
      return;
    }
    if (
      session.sessionType === 'swim' ||
      session.sessionType === 'bike' ||
      session.sessionType === 'cross'
    ) {
      router.push({
        pathname: '/workout/endurance',
        params: { sessionId, sessionType: session.sessionType },
      });
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

  const hasPlan = Boolean(data?.session?.sessionId);

  return (
    <DailySummaryScreen
      showBottomNav={false}
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
      headerBanner={
        !isLoading && gapState && !gapState.dismissed ? (
          <RampBanner
            gapDays={gapState.gap.gapDays}
            lastWorkoutAt={gapState.gap.lastWorkoutAt}
            onDismiss={handleDismissRamp}
          />
        ) : !isLoading && !hasPlan ? (
          <BuildPlanBanner />
        ) : undefined
      }
    />
  );
}
