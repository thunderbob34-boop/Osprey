// Evening look-ahead brief — an optional 8pm local notification previewing
// tomorrow's planned session, forecast, and a fueling note. Reconciled fresh
// on every app open (like supplement/race-week reminders): cancel + recompute
// + schedule a one-shot for tonight only, so plan or weather changes during
// the day are reflected next time the app is opened, rather than going stale
// inside a repeating notification.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { requestNotificationPermission } from '@/services/notifications';

const EVENING_BRIEF_ID = 'osprey-evening-brief';
const EVENING_HOUR = 20; // 8pm local
const enabledKey = (userId: string) => `osprey-eveningbrief-enabled-${userId}`;

/** Opt-in, defaults off — this is a second daily notification, not a replacement for the morning nudge. */
export async function isEveningBriefEnabled(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(enabledKey(userId))) === 'true';
}

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSessionLabel(sessionType: string, description: string | null): string {
  if (sessionType === 'rest') return 'Rest day';
  return description ?? sessionType.charAt(0).toUpperCase() + sessionType.slice(1);
}

function fuelingNoteFor(sessionType: string, intensity: string | null): string {
  if (sessionType === 'rest') return 'Let recovery do its job tonight.';
  if (intensity === 'threshold' || intensity === 'interval' || intensity === 'race') {
    return 'Carb up tonight — tomorrow needs the fuel in the tank.';
  }
  return 'Keep protein and hydration on track tonight.';
}

export interface TomorrowWeather {
  maxF: number;
  precipProbabilityMax: number;
}

/**
 * Re-derives tonight's 8pm look-ahead notification from tomorrow's planned
 * session (and, when available, tomorrow's weather). No-op once today's 8pm
 * has already passed, or when the toggle is off — safe to call on every app
 * open regardless of time of day.
 */
export async function reconcileEveningBrief(userId: string, tomorrowWeather?: TomorrowWeather | null): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(EVENING_BRIEF_ID).catch(() => undefined);
  if (!(await isEveningBriefEnabled(userId))) return;

  const now = new Date();
  const fireAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), EVENING_HOUR, 0, 0, 0);
  if (fireAt.getTime() <= now.getTime()) return; // 8pm already passed today

  const { data } = await supabase
    .from('training_sessions')
    .select('session_type, intensity, planned_minutes, description')
    .eq('user_id', userId)
    .eq('session_date', tomorrowDateString())
    .maybeSingle();

  const sessionType = data?.session_type ?? 'rest';
  const label = formatSessionLabel(sessionType, data?.description ?? null);
  const duration = data?.planned_minutes ? ` (${data.planned_minutes} min)` : '';
  const weatherPart = tomorrowWeather
    ? ` · ${Math.round(tomorrowWeather.maxF)}°F${
        tomorrowWeather.precipProbabilityMax >= 40 ? `, ${tomorrowWeather.precipProbabilityMax}% rain` : ''
      }`
    : '';
  const fuelPart = ` · ${fuelingNoteFor(sessionType, data?.intensity ?? null)}`;

  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_BRIEF_ID,
    content: {
      title: "🌙 Tomorrow's look-ahead",
      body: `${label}${duration}${weatherPart}${fuelPart}`,
      sound: Platform.OS === 'ios' ? 'default' : undefined,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
}

export async function setEveningBriefEnabled(userId: string, enabled: boolean): Promise<boolean> {
  if (enabled) {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  }
  await AsyncStorage.setItem(enabledKey(userId), enabled ? 'true' : 'false');
  await reconcileEveningBrief(userId);
  return true;
}
