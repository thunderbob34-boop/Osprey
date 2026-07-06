import { useEffect, useRef } from 'react';
import {
  addEndWorkoutListener,
  updateWatchContext,
  type WatchWorkoutStatus,
} from '@/services/watch-connectivity';

// Apple documents `WCSession.updateApplicationContext` as a "latest state"
// channel, not a high-frequency one — don't spam it on every render/tick.
const SYNC_INTERVAL_MS = 3000;

/**
 * Keeps a paired Apple Watch's on-wrist view in sync with an in-progress
 * OSPREY workout, and lets the wrist end the workout.
 *
 * - Pushes `{ status, elapsedSeconds, heartRate, distanceMiles }` to the
 *   Watch roughly every `SYNC_INTERVAL_MS`, plus immediately whenever
 *   `status` itself changes (idle/active/paused transitions matter more than
 *   the numeric ticks in between and shouldn't wait for the next tick).
 * - Subscribes to "End Workout" taps from the wrist and invokes
 *   `onEndWorkout` when one arrives.
 *
 * No-ops safely everywhere the native bridge isn't available (Android, no
 * paired Watch, or a build that doesn't include the module yet) — see
 * src/services/watch-connectivity.ts.
 */
export function useWatchSync(
  status: WatchWorkoutStatus,
  elapsedSeconds: number,
  heartRate: number | null,
  distanceMiles: number | null,
  onEndWorkout?: () => void,
): void {
  const latestRef = useRef({ status, elapsedSeconds, heartRate, distanceMiles });
  latestRef.current = { status, elapsedSeconds, heartRate, distanceMiles };

  const lastStatusRef = useRef(status);

  const onEndWorkoutRef = useRef(onEndWorkout);
  onEndWorkoutRef.current = onEndWorkout;

  // Throttled periodic push of whatever the latest values are.
  useEffect(() => {
    function push() {
      const s = latestRef.current;
      updateWatchContext({
        status: s.status,
        elapsedSeconds: s.elapsedSeconds,
        heartRate: s.heartRate ?? undefined,
        distanceMiles: s.distanceMiles ?? undefined,
      });
    }

    push(); // send current state right away on mount
    const interval = setInterval(push, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Push immediately on idle/active/paused transitions rather than waiting
  // for the next throttled tick.
  useEffect(() => {
    if (lastStatusRef.current === status) return;
    lastStatusRef.current = status;
    updateWatchContext({
      status,
      elapsedSeconds,
      heartRate: heartRate ?? undefined,
      distanceMiles: distanceMiles ?? undefined,
    });
  }, [status, elapsedSeconds, heartRate, distanceMiles]);

  // Watch -> phone: "End Workout" tapped on the wrist.
  useEffect(() => {
    const subscription = addEndWorkoutListener(() => onEndWorkoutRef.current?.());
    return () => subscription.remove();
  }, []);
}
