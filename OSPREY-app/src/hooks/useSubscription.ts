import { useCallback, useSyncExternalStore } from 'react';
import { hasOspreyPlus } from '@/services/subscriptions';

// Shared subscription state so every mounted useSubscription() stays in sync:
// when the paywall refreshes after a purchase, the Home/Stats/workout screens
// reading `isPlus` update too, instead of showing stale entitlement until they
// remount.
let state: { isPlus: boolean; isLoading: boolean } = { isPlus: false, isLoading: true };
let started = false;
const listeners = new Set<() => void>();

function setState(next: { isPlus: boolean; isLoading: boolean }) {
  state = next;
  listeners.forEach((l) => l());
}

async function runCheck() {
  try {
    const result = await hasOspreyPlus();
    setState({ isPlus: result, isLoading: false });
  } catch {
    setState({ isPlus: state.isPlus, isLoading: false });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    runCheck();
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

/** Re-check entitlement and notify every mounted useSubscription(). */
export function refreshSubscription() {
  setState({ isPlus: state.isPlus, isLoading: true });
  runCheck();
}

export function useSubscription() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const refresh = useCallback(() => refreshSubscription(), []);
  return { isPlus: snapshot.isPlus, isLoading: snapshot.isLoading, refresh };
}
