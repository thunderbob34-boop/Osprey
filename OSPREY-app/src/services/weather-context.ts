// Bridges the client-side weather engine and the Ozzie daily brief:
// the weather hook stashes today's compact forecast summary here, and the
// daily-summary service attaches it to the brief request so the server
// never needs the user's location or a weather API key.

import AsyncStorage from '@react-native-async-storage/async-storage';

const WEATHER_CONTEXT_KEY = 'osprey:weather-context';

export async function setCachedWeatherBriefSummary(summary: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await AsyncStorage.setItem(
    WEATHER_CONTEXT_KEY,
    JSON.stringify({ date: today, summary }),
  ).catch(() => undefined);
}

/** Today's cached weather summary, or null if missing/stale. */
export async function getCachedWeatherBriefSummary(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(WEATHER_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date?: string; summary?: string };
    const today = new Date().toISOString().slice(0, 10);
    return parsed.date === today && parsed.summary ? parsed.summary : null;
  } catch {
    return null;
  }
}
