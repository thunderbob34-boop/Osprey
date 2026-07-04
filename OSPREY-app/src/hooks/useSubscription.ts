import { useCallback, useEffect, useState } from 'react';
import { hasOspreyPlus } from '@/services/subscriptions';

let moduleCache: boolean | null = null;

// Must be called on sign-out — otherwise a cached `true` (or another
// account's entitlement) keeps unlocking Plus features for the next
// account that signs in on the same device until something calls refresh().
export function clearSubscriptionCache() {
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

  useEffect(() => {
    if (moduleCache === null) {
      check();
    }
  }, [check]);

  const refresh = useCallback(() => {
    moduleCache = null;
    check();
  }, [check]);

  return { isPlus, isLoading, refresh };
}
