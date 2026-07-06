// JS/TS API for the local `watch-connectivity` Expo Module (see
// ./ios/WatchConnectivityModule.swift for the native half and the contract
// with targets/watch/WorkoutDataModel.swift).
//
// Uses `requireOptionalNativeModule` (re-exported by `expo-modules-core`, and
// the same helper expo-haptics's own `ExpoHaptics.ts` uses) rather than
// `requireNativeModule` specifically because it resolves to `null` instead of
// throwing when the native module isn't linked — which is the normal state
// on Android (this module declares iOS-only support in
// expo-module.config.json) and also the normal state on iOS until a dev
// client / EAS build that actually includes this local module has been
// installed (Expo Go and any previously-built dev client will not have it).
import { EventSubscription, NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

export type WatchWorkoutStatus = 'idle' | 'active' | 'paused';

export interface WatchWorkoutContext {
  status: WatchWorkoutStatus;
  elapsedSeconds: number;
  heartRate?: number;
  distanceMiles?: number;
}

type WatchConnectivityEvents = {
  onEndWorkoutRequested: () => void;
};

declare class WatchConnectivityNativeModule extends NativeModule<WatchConnectivityEvents> {
  updateApplicationContext(context: Record<string, unknown>): Promise<void>;
  isPaired(): boolean;
}

const WatchConnectivityModule =
  requireOptionalNativeModule<WatchConnectivityNativeModule>('WatchConnectivity');

/**
 * Whether this device has a paired Apple Watch (and the bridge itself is
 * available — i.e. this is iOS and the native module was actually linked
 * into the running build). Resolves `false` rather than throwing in every
 * case where the answer can't be determined natively.
 */
export async function isWatchPaired(): Promise<boolean> {
  if (!WatchConnectivityModule) return false;
  try {
    return await WatchConnectivityModule.isPaired();
  } catch {
    return false;
  }
}

/**
 * Pushes the current workout state to a paired Watch via
 * `WCSession.updateApplicationContext`. Never throws — no paired Watch, no
 * installed Watch app, or the native module simply not being linked yet are
 * all normal, expected states, not error conditions callers should have to
 * handle. Callers (see src/hooks/useWatchSync.ts) are expected to throttle
 * calls to roughly once every 2-5 seconds; `updateApplicationContext` is
 * documented by Apple as a "latest state" channel, not a high-frequency one.
 */
export async function updateWatchContext(context: WatchWorkoutContext): Promise<void> {
  if (!WatchConnectivityModule) return;
  try {
    await WatchConnectivityModule.updateApplicationContext({
      status: context.status,
      elapsedSeconds: Math.round(context.elapsedSeconds),
      ...(context.heartRate != null ? { heartRate: Math.round(context.heartRate) } : {}),
      ...(context.distanceMiles != null ? { distanceMiles: context.distanceMiles } : {}),
    });
  } catch {
    // Swallow — see doc comment above.
  }
}

/**
 * Subscribes to "End Workout" taps from the wrist. Always returns a valid
 * subscription (a no-op one when the native module isn't available), so
 * callers never need to branch on availability before calling `.remove()`.
 */
export function addEndWorkoutListener(callback: () => void): EventSubscription {
  if (!WatchConnectivityModule) {
    return { remove() {} };
  }
  return WatchConnectivityModule.addListener('onEndWorkoutRequested', callback);
}
