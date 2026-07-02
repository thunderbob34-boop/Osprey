import { useEffect, useRef } from 'react';
import { sendWorkoutUpdate, sendWorkoutEnded, type WatchWorkoutPayload } from '@/services/watch-connectivity';

export function useWatchSync(payload: WatchWorkoutPayload | null): void {
  const lastPayloadRef = useRef<WatchWorkoutPayload | null>(null);

  useEffect(() => {
    if (payload === null) return;
    sendWorkoutUpdate(payload);
    lastPayloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    return () => {
      if (lastPayloadRef.current && lastPayloadRef.current.status !== 'idle') {
        sendWorkoutEnded();
      }
    };
  }, []);
}
