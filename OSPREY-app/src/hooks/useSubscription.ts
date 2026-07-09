import { useCallback, useEffect, useState } from 'react';
import { hasOspreyPlus } from '@/services/subscriptions';

let moduleCache: boolean | null = null;

/** Clears the cached entitlement so the next mount re-verifies instead of reusing another account's result. */
export function resetSubscriptionCache(): void {
  moduleCache = null;
}

export function useSubscription() {
  const [isPlus, setIsPlus] = useState<boolean>(moduleCache ?? false);
  const [isLoading, setIsLoading] = useState<boolean>(moduleCache === null);

  const check = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await hasOspreyPlus();
      moduleCache = result;
      setIsPlus(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Always re-verify on mount, even if a cached value exists: the cache may
  // have been populated by RevenueCat's not-yet-configured fail-open path
  // (see hasOspreyPlus), and re-checking is the only way it self-corrects
  // once configuration completes.
  useEffect(() => {
    check();
  }, [check]);

  const refresh = useCallback(() => {
    moduleCache = null;
    check();
  }, [check]);

  return { isPlus, isLoading, refresh };
}
