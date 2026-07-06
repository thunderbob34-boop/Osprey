import { Platform } from 'react-native';
import {
  addEndWorkoutListener as addEndWorkoutListenerNative,
  isWatchPaired as isWatchPairedNative,
  updateWatchContext as updateWatchContextNative,
  type WatchWorkoutContext,
  type WatchWorkoutStatus,
} from '../../modules/watch-connectivity';

export type { WatchWorkoutContext, WatchWorkoutStatus };

/**
 * Phone-side wrapper around the local `watch-connectivity` Expo Module (see
 * modules/watch-connectivity/). Mirrors the "hardware/capability might not
 * exist, fail gracefully" convention used throughout src/services/healthkit.ts:
 * every function here resolves to a safe default instead of throwing,
 * because a missing paired Watch (or a build that doesn't include the native
 * module yet) is a normal, expected state — not an error.
 */
export function isWatchBridgeSupported(): boolean {
  return Platform.OS === 'ios';
}

export async function isWatchPaired(): Promise<boolean> {
  if (!isWatchBridgeSupported()) return false;
  try {
    return await isWatchPairedNative();
  } catch {
    return false;
  }
}

/**
 * Pushes the live workout state to a paired Apple Watch. No-ops on Android
 * or if the native module/paired Watch isn't available — never throws.
 */
export async function updateWatchContext(context: WatchWorkoutContext): Promise<void> {
  if (!isWatchBridgeSupported()) return;
  try {
    await updateWatchContextNative(context);
  } catch {
    // Never throw — see file doc comment.
  }
}

/**
 * Subscribes to "End Workout" taps sent from the wrist. Always returns a
 * valid subscription (a no-op one on Android / when unavailable), so callers
 * never need to branch before calling `.remove()`.
 */
export function addEndWorkoutListener(callback: () => void): { remove(): void } {
  if (!isWatchBridgeSupported()) {
    return { remove() {} };
  }
  return addEndWorkoutListenerNative(callback);
}
