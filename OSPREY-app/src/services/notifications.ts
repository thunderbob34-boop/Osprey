import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';

const DAILY_NUDGE_ID = 'osprey-daily-nudge';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedules Ozzie's daily nudge at the given hour (local time), repeating
 * every day. Cancels and replaces any existing nudge first so re-scheduling
 * at a new hour doesn't stack duplicate notifications.
 */
export async function scheduleDailyNudge(hour: number, minute = 0): Promise<void> {
  await cancelDailyNudge();

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_NUDGE_ID,
    content: {
      title: "Ozzie's here 👋",
      body: "Time to check today's session and log how you're fueling up.",
      sound: Platform.OS === 'ios' ? 'default' : undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

/**
 * Finds the user's most consistent workout hour over the last 14 days
 * (3+ sessions clustered in the same hour), so the nudge lands when it's
 * actually useful instead of an arbitrary default time.
 */
export async function fetchSmartNudgeHour(userId: string): Promise<number> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('workout_logs')
    .select('started_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('started_at', fourteenDaysAgo);

  const hourCounts = new Map<number, number>();
  for (const row of data ?? []) {
    const hour = new Date(row.started_at as string).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  let bestHour = -1;
  let bestCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > bestCount) {
      bestHour = hour;
      bestCount = count;
    }
  }

  if (bestCount >= 3) {
    // Nudge an hour before their usual training time.
    return (bestHour + 23) % 24;
  }

  return 8; // default: 8am
}

export async function cancelDailyNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NUDGE_ID).catch(() => undefined);
}

export async function isDailyNudgeScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier === DAILY_NUDGE_ID);
}
