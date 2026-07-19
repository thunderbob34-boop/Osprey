import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LiftExercise, TrackPoint, WorkoutStatus, WorkoutType } from '@/types/workout';

interface WorkoutState {
  workoutType: WorkoutType | null;
  status: WorkoutStatus;
  startedAt: number | null;
  pausedAt: number | null;
  accumulatedPauseMs: number;
  distanceMeters: number;
  trackPoints: TrackPoint[];
  heartRate: number | null;
  liftExercises: LiftExercise[];
  restSecondsLeft: number | null;
  sessionId: string | null;

  startWorkout: (type: WorkoutType, sessionId?: string | null) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  addDistance: (meters: number) => void;
  addTrackPoint: (point: TrackPoint) => void;
  setHeartRate: (hr: number | null) => void;
  setLiftExercises: (exercises: LiftExercise[]) => void;
  logLiftSet: (exerciseIndex: number, setIndex: number) => void;
  addLiftSet: (exerciseIndex: number) => void;
  startRestTimer: (seconds: number) => void;
  tickRestTimer: () => void;
  skipRestTimer: () => void;
  addRestSeconds: (seconds: number) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  workoutType: null as WorkoutType | null,
  status: 'idle' as WorkoutStatus,
  startedAt: null as number | null,
  pausedAt: null as number | null,
  accumulatedPauseMs: 0,
  distanceMeters: 0,
  trackPoints: [] as TrackPoint[],
  heartRate: null as number | null,
  liftExercises: [] as LiftExercise[],
  restSecondsLeft: null as number | null,
  sessionId: null as string | null,
};

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      startWorkout: (type, sessionId = null) =>
        set((state) => ({
          ...INITIAL_STATE,
          workoutType: type,
          status: 'active',
          startedAt: Date.now(),
          sessionId,
          // lift.tsx populates liftExercises (prescribed or default) while the
          // warm-up screen is showing, before this fires — don't clobber it.
          liftExercises: state.liftExercises,
        })),

      pauseWorkout: () => {
        const { status, pausedAt } = get();
        if (status !== 'active' || pausedAt) return;
        set({ status: 'paused', pausedAt: Date.now() });
      },

      resumeWorkout: () => {
        const { pausedAt, accumulatedPauseMs } = get();
        if (!pausedAt) return;
        set({
          status: 'active',
          pausedAt: null,
          accumulatedPauseMs: accumulatedPauseMs + (Date.now() - pausedAt),
        });
      },

      addDistance: (meters) =>
        set((state) => ({ distanceMeters: state.distanceMeters + meters })),

      addTrackPoint: (point) =>
        set((state) => ({ trackPoints: [...state.trackPoints, point] })),

      setHeartRate: (heartRate) => set({ heartRate }),

      setLiftExercises: (liftExercises) => set({ liftExercises }),

      logLiftSet: (exerciseIndex, setIndex) =>
        set((state) => {
          const liftExercises = state.liftExercises.map((exercise, ei) => {
            if (ei !== exerciseIndex) return exercise;
            return {
              ...exercise,
              sets: exercise.sets.map((set, si) =>
                si === setIndex ? { ...set, completed: true } : set,
              ),
            };
          });
          return { liftExercises };
        }),

      addLiftSet: (exerciseIndex) =>
        set((state) => {
          const liftExercises = state.liftExercises.map((exercise, ei) => {
            if (ei !== exerciseIndex) return exercise;
            const nextSetNumber = exercise.sets.length + 1;
            const last = exercise.sets[exercise.sets.length - 1];
            return {
              ...exercise,
              sets: [
                ...exercise.sets,
                {
                  setNumber: nextSetNumber,
                  reps: last?.reps ?? 8,
                  weightLbs: last?.weightLbs ?? 135,
                  completed: false,
                },
              ],
            };
          });
          return { liftExercises };
        }),

      startRestTimer: (seconds) => set({ restSecondsLeft: seconds }),

      tickRestTimer: () =>
        set((state) => {
          if (state.restSecondsLeft == null) return state;
          if (state.restSecondsLeft <= 1) return { restSecondsLeft: null };
          return { restSecondsLeft: state.restSecondsLeft - 1 };
        }),

      skipRestTimer: () => set({ restSecondsLeft: null }),

      addRestSeconds: (seconds) =>
        set((state) => ({
          restSecondsLeft: state.restSecondsLeft == null ? null : state.restSecondsLeft + seconds,
        })),

      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      // Survives an app kill mid-workout (crash, OS force-quit, swipe-away)
      // so the athlete can resume instead of losing a run/lift session with
      // no trace — see useResumeWorkoutPrompt, which reads this on launch.
      name: 'osprey:workout-in-progress',
      storage: createJSONStorage(() => AsyncStorage),
      // restSecondsLeft is a live countdown with no meaning after a restart;
      // everything else (actions included) is either derivable or safe to
      // re-run, so only the fields needed to resume/recap are persisted.
      partialize: (state) => ({
        workoutType: state.workoutType,
        status: state.status,
        startedAt: state.startedAt,
        pausedAt: state.pausedAt,
        accumulatedPauseMs: state.accumulatedPauseMs,
        distanceMeters: state.distanceMeters,
        trackPoints: state.trackPoints,
        heartRate: state.heartRate,
        liftExercises: state.liftExercises,
        sessionId: state.sessionId,
      }),
      // A workout that was 'active' (or mid-save) when the app died wasn't
      // actually paused — but treating the entire app-dead gap as elapsed
      // time would badly inflate duration/pace on resume. Land it in
      // 'paused' with pausedAt = now, matching getElapsedSeconds's existing
      // pause math, and let the athlete explicitly choose to resume.
      onRehydrateStorage: () => (state) => {
        if (state && state.status !== 'idle' && state.status !== 'paused') {
          state.status = 'paused';
          state.pausedAt = Date.now();
        }
      },
    },
  ),
);

export function getElapsedSeconds(state: Pick<WorkoutState, 'startedAt' | 'pausedAt' | 'accumulatedPauseMs' | 'status'>): number {
  if (!state.startedAt) return 0;
  const now = state.status === 'paused' && state.pausedAt ? state.pausedAt : Date.now();
  return Math.max(0, Math.floor((now - state.startedAt - state.accumulatedPauseMs) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatPace(secondsPerMile: number): string {
  if (!Number.isFinite(secondsPerMile) || secondsPerMile <= 0) return '--:--';
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = Math.round(secondsPerMile % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

/**
 * True when the store already holds a live (active/paused) workout of this
 * exact type — i.e. the athlete is resuming after a kill, not starting
 * fresh. Screens use this to skip their warm-up gate and its `startWorkout`
 * call, which would otherwise reset the very progress being resumed.
 */
export function isResumableWorkout(type: WorkoutType): boolean {
  const state = useWorkoutStore.getState();
  return (
    state.workoutType === type &&
    state.status !== 'idle' &&
    state.startedAt != null
  );
}
