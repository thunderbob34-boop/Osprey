import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useWorkoutStore } from '@/store/workoutStore';

export function haversineMeters(
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

export const GPS_NOISE_THRESHOLD_M = 1;

export interface GpsAnchor {
  lat: number;
  lon: number;
}

/**
 * Distance noise filter for incoming GPS fixes. Only moves the anchor once a
 * fix clears the noise threshold. Previously the anchor was replaced on every
 * fix regardless of distance, so a run of sub-meter GPS jitter would reset the
 * reference point each time and silently drop genuine slow/steady movement
 * that never individually crossed 1m between two consecutive (but noisy) fixes.
 */
export function processLocationFix(
  anchor: GpsAnchor | null,
  lat: number,
  lon: number,
): { acceptedDelta: number; anchor: GpsAnchor } {
  if (!anchor) {
    return { acceptedDelta: 0, anchor: { lat, lon } };
  }
  const delta = haversineMeters(anchor.lat, anchor.lon, lat, lon);
  if (delta >= GPS_NOISE_THRESHOLD_M) {
    return { acceptedDelta: delta, anchor: { lat, lon } };
  }
  return { acceptedDelta: 0, anchor };
}

export function useRunTracking(enabled: boolean) {
  const status = useWorkoutStore((s) => s.status);
  const addDistance = useWorkoutStore((s) => s.addDistance);
  const addTrackPoint = useWorkoutStore((s) => s.addTrackPoint);
  const lastPointRef = useRef<GpsAnchor | null>(null);

  useEffect(() => {
    if (!enabled || status !== 'active') return;

    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') return;

      subscription = await Location.watchPositionAsync(
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

          const { acceptedDelta, anchor } = processLocationFix(
            lastPointRef.current,
            latitude,
            longitude,
          );
          if (acceptedDelta > 0) addDistance(acceptedDelta);
          lastPointRef.current = anchor;

          addTrackPoint(point);
        },
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, [enabled, status, addDistance, addTrackPoint]);
}
