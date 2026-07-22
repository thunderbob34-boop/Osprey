import { useCallback, useSyncExternalStore } from 'react';
import { hasOspreyPlus } from '@/services/subscriptions';

// Product decision 2026-07-22: paywalls/OSPREY+ are deprioritized while the
// app is still being completed — "right now it will be free for all." This is
// the one place every consumer (Home, Stats, the paywall screen itself) reads
// entitlement from, so flipping it here unlocks every currently-Plus-gated
// surface without touching the individual `isPlus ? … : …` call sites — they
// stay wired and dormant, ready to matter again the moment this flips back.
// hasOspreyPlus()'s real RevenueCat check below is UNTOUCHED (still fails
// closed in production builds per its own comment), so re-enabling
// monetization later needs no re-deriving, just deleting this override.
const FREE_FOR_ALL = true;

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
  return { isPlus: FREE_FOR_ALL || snapshot.isPlus, isLoading: snapshot.isLoading, refresh };
}
