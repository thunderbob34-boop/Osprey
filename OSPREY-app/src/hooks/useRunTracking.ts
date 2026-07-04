import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useWorkoutStore } from '@/store/workoutStore';

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useRunTracking(enabled: boolean) {
  const status = useWorkoutStore((s) => s.status);
  const addDistance = useWorkoutStore((s) => s.addDistance);
  const addTrackPoint = useWorkoutStore((s) => s.addTrackPoint);
  const lastPointRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!enabled || status !== 'active') return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted' || cancelled) return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 2000,
        },
        (location) => {
          const { latitude, longitude, speed } = location.coords;
          const point = {
            lat: latitude,
            lon: longitude,
            recordedAt: new Date().toISOString(),
            speedMs: speed ?? undefined,
          };

          if (lastPointRef.current) {
            const delta = haversineMeters(
              lastPointRef.current.lat,
              lastPointRef.current.lon,
              latitude,
              longitude,
            );
            if (delta >= 1) {
              addDistance(delta);
            }
          }

          lastPointRef.current = { lat: latitude, lon: longitude };
          addTrackPoint(point);
        },
      );

      if (cancelled) {
        // Effect was cleaned up (pause/unmount) while watchPositionAsync was
        // still resolving — the subscription is created after cleanup already
        // ran, so remove it immediately instead of leaking a live GPS watch.
        sub.remove();
        return;
      }
      subscription = sub;
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      // Reset so a resumed/new run doesn't compute its first distance delta
      // against a coordinate from before the pause (or a previous workout).
      lastPointRef.current = null;
    };
  }, [enabled, status, addDistance, addTrackPoint]);
}
