import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { fetchForecast } from '@/services/weather';
import { deriveWeatherCoach, type WeatherCoachResult, type WeatherRouteRef } from '@/services/weather-coach';
import { setCachedWeatherBriefSummary } from '@/services/weather-context';

// DEV-ONLY web-preview fixture. The Expo web preview (`npm run start -- --web`)
// runs in a sandboxed browser that doesn't hand geolocation to the app, so the
// weather coach can never get coords there and its card always stays hidden —
// which makes it impossible to audit weather UI on web. In development on web
// only, fall back to a fixed city so the card renders. Gated on
// `__DEV__ && Platform.OS === 'web'`, so real iOS/Android builds and any
// production build are byte-for-byte unaffected — they always use real
// device location (or hide the card). Charlotte, NC is an arbitrary default
// (matches this project's test-race data); it never ships to a user.
const DEV_WEB_FALLBACK_COORDS = { latitude: 35.2271, longitude: -80.8431 };

async function getRealCoords(): Promise<{ latitude: number; longitude: number } | null> {
  // Never prompt from the Home screen — only use location if the user already
  // granted it (e.g. for GPS runs). The card simply stays hidden otherwise.
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) return null;

  const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
  if (lastKnown) return lastKnown.coords;

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Low,
  }).catch(() => null);
  return current?.coords ?? null;
}

async function getCoords(): Promise<{ latitude: number; longitude: number } | null> {
  // Real device location always wins — so a browser that HAS granted geolocation
  // still uses it, and native is entirely unchanged.
  const real = await getRealCoords().catch(() => null);
  if (real) return real;

  if (__DEV__ && Platform.OS === 'web') return DEV_WEB_FALLBACK_COORDS;
  return null;
}

export function useWeatherCoach(
  todaySessionType: string | null | undefined,
  savedRoutes?: WeatherRouteRef[],
) {
  return useQuery<WeatherCoachResult | null>({
    queryKey: ['weather-coach', todaySessionType ?? 'unknown', savedRoutes?.length ?? 0],
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const coords = await getCoords();
      if (!coords) return null;

      const forecast = await fetchForecast(coords.latitude, coords.longitude);
      const result = deriveWeatherCoach(forecast, todaySessionType ?? null, savedRoutes);

      // Stash a compact summary so the Ozzie daily brief can reference the
      // forecast without the server needing location or a weather key.
      if (result) {
        await setCachedWeatherBriefSummary(result.briefSummary);
      }

      return result;
    },
  });
}
