import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useWorkoutStore } from '@/store/workoutStore';
import type { WorkoutType } from '@/types/workout';

// Screens have been patched to skip their warm-up/start gate and resume
// in place for these three types (see isResumableWorkout usage in
// app/workout/{run,lift,endurance}.tsx). Other types can't safely appear
// in the store today (only run/lift/bike ever call startWorkout), but if
// one somehow does, offer Discard only rather than routing into a screen
// that would silently overwrite the resumed data.
const RESUMABLE_TYPES = new Set<WorkoutType>(['run', 'lift', 'bike']);

const WORKOUT_LABEL: Record<WorkoutType, string> = {
  run: 'run',
  lift: 'lift session',
  bike: 'bike ride',
  swim: 'swim',
  rowing: 'row',
  cross: 'workout',
  hyrox: 'HYROX workout',
};

/**
 * Detects a workout left mid-session by an app kill (crash, OS force-quit,
 * swipe-away) and offers to resume or discard it. Call once from a
 * long-lived, always-mounted screen — the (tabs) layout — so it fires on
 * every cold start regardless of which tab the user lands on.
 */
export function useResumeWorkoutPrompt() {
  const router = useRouter();
  const checkedRef = useRef(false);

  useEffect(() => {
    function resumeRoute(type: WorkoutType, sessionId: string | null) {
      const sessionParams = sessionId ? { sessionId } : {};
      if (type === 'run') {
        router.push({ pathname: '/workout/run', params: sessionParams });
      } else if (type === 'lift') {
        router.push({ pathname: '/workout/lift', params: sessionParams });
      } else if (type === 'bike') {
        router.push({
          pathname: '/workout/endurance',
          params: { sessionType: 'bike', mode: 'outside', ...sessionParams },
        });
      }
    }

    function check() {
      if (checkedRef.current) return;
      checkedRef.current = true;

      const state = useWorkoutStore.getState();
      if (state.status === 'idle' || !state.startedAt || !state.workoutType) return;

      const type = state.workoutType;
      const label = WORKOUT_LABEL[type] ?? 'workout';
      const canResume = RESUMABLE_TYPES.has(type);

      Alert.alert(
        'Unsaved workout found',
        canResume
          ? `You have a ${label} in progress from before the app closed. Resume it, or discard it?`
          : `You have an unsaved ${label} from before the app closed. It can't be resumed here — discard it?`,
        canResume
          ? [
              { text: 'Discard', style: 'destructive', onPress: () => useWorkoutStore.getState().reset() },
              { text: 'Resume', onPress: () => resumeRoute(type, state.sessionId) },
            ]
          : [{ text: 'Discard', style: 'destructive', onPress: () => useWorkoutStore.getState().reset() }],
      );
    }

    if (useWorkoutStore.persist.hasHydrated()) {
      check();
      return;
    }
    return useWorkoutStore.persist.onFinishHydration(check);
  }, [router]);
}
