import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { fetchForecast } from '@/services/weather';
import { deriveWeatherCoach, type WeatherCoachResult } from '@/services/weather-coach';
import { setCachedWeatherBriefSummary } from '@/services/weather-context';

async function getCoords(): Promise<{ latitude: number; longitude: number } | null> {
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

export function useWeatherCoach(todaySessionType: string | null | undefined) {
  return useQuery<WeatherCoachResult | null>({
    queryKey: ['weather-coach', todaySessionType ?? 'unknown'],
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const coords = await getCoords();
      if (!coords) return null;

      const forecast = await fetchForecast(coords.latitude, coords.longitude);
      const result = deriveWeatherCoach(forecast, todaySessionType ?? null);

      // Stash a compact summary so the Ozzie daily brief can reference the
      // forecast without the server needing location or a weather key.
      if (result) {
        await setCachedWeatherBriefSummary(result.briefSummary);
      }

      return result;
    },
  });
}
