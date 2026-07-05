import { useCallback, useEffect, useState } from 'react';
import { hasOspreyPlus } from '@/services/subscriptions';

let moduleCache: boolean | null = null;

/** Call on sign-out so the next signed-in user doesn't briefly see the previous account's cached entitlement. */
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
