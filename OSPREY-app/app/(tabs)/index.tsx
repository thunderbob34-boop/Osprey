import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import DailySummaryScreen from '@/screens/DailySummary';
import BuildPlanBanner from '@/components/BuildPlanBanner';
import DeloadSuggestionCard from '@/components/DeloadSuggestionCard';
import WeatherCoachCard from '@/components/WeatherCoachCard';
import { useDailySummary } from '@/hooks/useDailySummary';
import { loadLabelFromTsb } from '@/services/daily-summary';
import { routeForSession } from '@/services/session-route';
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
    // Shared with the Workout tab's "Today's session" shortcut so both doors
    // into the same prescribed session always land on the same screen.
    router.push(routeForSession(session.sessionType, session.sessionId));
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

  // The "Load" quick stat's own source (v_daily_summary.tsb) is permanently
  // null — load_scores, the table behind it, is never written to. Re-derive it
  // from usePerformance()'s CTL/ATL/TSB pipeline instead, which is real (it's
  // computed straight from workout_logs) and already fetched on this screen
  // for trainingReadiness. Gated the same way as everywhere else that pipeline
  // is surfaced (Stats' Fitness & Form, the race predictor) — perf.ctl > 0 is
  // usePerformance's own "enough history to mean anything" check — so this
  // doesn't silently turn a paid metric free.
  const quickStats = data?.quickStats
    ? { ...data.quickStats, load: isPlus && perf && perf.ctl > 0 ? loadLabelFromTsb(perf.tsb) : '—' }
    : data?.quickStats;

  return (
    <DailySummaryScreen
      isLoading={isLoading}
      isRefreshing={isRefetching}
      error={error?.message ?? null}
      onRetry={() => refetch()}
      onRefresh={() => refetch()}
      onStartSession={handleStartSession}
      onBuildPlan={() => router.push('/plan-preview')}
      onSwapSession={handleSwapSession}
      onCompressSession={handleCompressSession}
      fuelStatus={fuelStatus}
      userName={data?.userName}
      recovery={data?.recovery}
      session={data?.session}
      weekDistanceKm={data?.weekDistanceKm}
      weekTargetKm={data?.weekTargetKm}
      habitTip={data?.habitTip}
      quickStats={quickStats}
      trainingReadiness={isPlus ? (perf?.trainingReadiness ?? null) : null}
      onActivityPress={() => router.push('/activity')}
      // Ask Ozzie hidden until OpenAI billing is on — omitting this prop hides
      // the header avatar button (DailySummary gates it on onOzziePress). The
      // ask-ozzie screen stays; re-enable by restoring this line.
      // onOzziePress={() => router.push('/ask-ozzie')}
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
