import { NativeModules, NativeEventEmitter } from 'react-native';

export interface WatchWorkoutPayload {
  status: 'active' | 'paused' | 'idle';
  elapsedSeconds: number;
  heartRate: number | null;
  distanceMiles: number | null;
}

// Real implementation: WatchConnectivity session sends application context updates
// via WCSession.default.updateApplicationContext(_:) with the serialized payload.
// The native module (RCTWatchConnectivity) would bridge to WCSessionDelegate on the
// iOS side, while the Watch extension receives updates via session(_:didReceiveApplicationContext:).

export function sendWorkoutUpdate(payload: WatchWorkoutPayload): void {
  if (__DEV__) {
    console.log('[WatchConnectivity] sendWorkoutUpdate', payload);
  }
  // Real: NativeModules.WatchConnectivity.sendApplicationContext(payload)
}

export function sendWorkoutEnded(): void {
  if (__DEV__) {
    console.log('[WatchConnectivity] sendWorkoutEnded');
  }
  // Real: NativeModules.WatchConnectivity.sendApplicationContext({ status: 'idle', elapsedSeconds: 0, heartRate: null, distanceMiles: null })
}

export function onWatchRequestEnd(callback: () => void): () => void {
  if (__DEV__) {
    console.log('[WatchConnectivity] onWatchRequestEnd listener registered');
  }
  // Real: subscribe to NativeEventEmitter(NativeModules.WatchConnectivity) 'watchMessage' event,
  // filter for payload.action === 'end_workout', then invoke callback.
  // Returns a cleanup function that removes the subscription.
  return () => {};
}
