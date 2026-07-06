import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

const SUPP_PREFIX = 'osprey-supp-';
const masterEnabledKey = (userId: string) => `osprey-suppmaster-enabled-${userId}`;

/**
 * Category-level switch shown in Settings. Defaults ON (opt-out) since
 * per-reminder scheduling already existed before this toggle — flipping the
 * default to off would silently break notifications for every existing user
 * with reminders already set up.
 */
export async function isSupplementRemindersEnabled(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(masterEnabledKey(userId))) !== 'false';
}

/** Toggles the master switch and re-derives scheduled notifications immediately. */
export async function setSupplementRemindersEnabled(userId: string, enabled: boolean): Promise<boolean> {
  if (enabled) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
  }
  await AsyncStorage.setItem(masterEnabledKey(userId), enabled ? 'true' : 'false');
  await reconcileSupplementReminders(userId);
  return true;
}

export interface SupplementReminder {
  id: string;
  name: string;
  dosage: string | null;
  remindHour: number;
  remindMinute: number;
  trainingDaysOnly: boolean;
  enabled: boolean;
}

interface SupplementReminderRow {
  id: string;
  name: string;
  dosage: string | null;
  remind_hour: number;
  remind_minute: number;
  training_days_only: boolean;
  enabled: boolean;
}

function mapRow(row: SupplementReminderRow): SupplementReminder {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage,
    remindHour: row.remind_hour,
    remindMinute: row.remind_minute,
    trainingDaysOnly: row.training_days_only,
    enabled: row.enabled,
  };
}

export async function fetchSupplementReminders(userId: string): Promise<SupplementReminder[]> {
  const { data, error } = await supabase
    .from('supplement_reminders')
    .select('id, name, dosage, remind_hour, remind_minute, training_days_only, enabled')
    .eq('user_id', userId)
    .order('remind_hour', { ascending: true })
    .order('remind_minute', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export interface SupplementReminderInput {
  name: string;
  dosage?: string | null;
  remindHour: number;
  remindMinute: number;
  trainingDaysOnly: boolean;
}

export async function createSupplementReminder(
  userId: string,
  input: SupplementReminderInput,
): Promise<SupplementReminder> {
  const { data, error } = await supabase
    .from('supplement_reminders')
    .insert({
      user_id: userId,
      name: input.name,
      dosage: input.dosage ?? null,
      remind_hour: input.remindHour,
      remind_minute: input.remindMinute,
      training_days_only: input.trainingDaysOnly,
      enabled: true,
    })
    .select('id, name, dosage, remind_hour, remind_minute, training_days_only, enabled')
    .single();

  if (error || !data) throw error ?? new Error('Failed to create reminder');
  return mapRow(data);
}

export async function setSupplementReminderEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('supplement_reminders')
    .update({ enabled })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSupplementReminder(id: string): Promise<void> {
  const { error } = await supabase.from('supplement_reminders').delete().eq('id', id);
  if (error) throw error;
}

function reminderBody(reminder: SupplementReminder): string {
  return reminder.dosage ? `Time for ${reminder.name} — ${reminder.dosage}.` : `Time for ${reminder.name}.`;
}

/** Local YYYY-MM-DD strings for the next `days` days starting today. */
function upcomingDateStrings(days: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

async function cancelAllSupplementNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(SUPP_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)),
  );
}

/**
 * Re-derives the device's scheduled supplement notifications from the DB.
 * Daily reminders use a single repeating trigger; training-day reminders are
 * scheduled as one-shot notifications on each upcoming planned training day
 * (the only reliable way to gate an OS notification by training day). Call on
 * app open and whenever a reminder or the training plan changes.
 */
export async function reconcileSupplementReminders(userId: string): Promise<void> {
  await cancelAllSupplementNotifications();
  if (!(await isSupplementRemindersEnabled(userId))) return;

  const reminders = (await fetchSupplementReminders(userId)).filter((r) => r.enabled);
  if (reminders.length === 0) return;

  const sound = Platform.OS === 'ios' ? 'default' : undefined;

  // Resolve which of the next 7 days have a planned, non-rest session — only
  // needed if at least one reminder is training-day gated.
  let trainingDates = new Set<string>();
  if (reminders.some((r) => r.trainingDaysOnly)) {
    const dates = upcomingDateStrings(7);
    const { data } = await supabase
      .from('training_sessions')
      .select('session_date, session_type')
      .eq('user_id', userId)
      .gte('session_date', dates[0])
      .lte('session_date', dates[dates.length - 1])
      .neq('session_type', 'rest');
    trainingDates = new Set((data ?? []).map((s) => s.session_date as string));
  }

  for (const reminder of reminders) {
    if (!reminder.trainingDaysOnly) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${SUPP_PREFIX}${reminder.id}`,
        content: { title: '💊 Supplement reminder', body: reminderBody(reminder), sound },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: reminder.remindHour,
          minute: reminder.remindMinute,
          repeats: true,
        },
      });
      continue;
    }

    for (const dateStr of trainingDates) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const fireAt = new Date(y, m - 1, d, reminder.remindHour, reminder.remindMinute, 0, 0);
      if (fireAt.getTime() <= Date.now()) continue; // time already passed today
      await Notifications.scheduleNotificationAsync({
        identifier: `${SUPP_PREFIX}${reminder.id}-${dateStr}`,
        content: { title: '💊 Supplement reminder', body: reminderBody(reminder), sound },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
      });
    }
  }
}
