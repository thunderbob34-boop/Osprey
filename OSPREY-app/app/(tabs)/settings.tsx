import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import {
  hasOspreyPlus,
  restorePurchases,
} from '@/services/subscriptions';
import {
  isHealthKitSupported,
  requestHealthKitAuthorization,
  syncRecoveryFromHealthKit,
} from '@/services/healthkit';
import {
  cancelDailyNudge,
  fetchSmartNudgeHour,
  isDailyNudgeScheduled,
  requestNotificationPermission,
  scheduleDailyNudge,
} from '@/services/notifications';
import {
  disableCalendarBlocking,
  enableCalendarBlocking,
  isCalendarBlockingEnabled,
} from '@/services/calendar-blocking';

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export default function SettingsTab() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.user?.id);
  const [plusActive, setPlusActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [nudgeEnabled, setNudgeEnabled] = useState(false);
  const [nudgeHour, setNudgeHour] = useState<number | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [calBlockEnabled, setCalBlockEnabled] = useState(false);
  const [calBlockLoading, setCalBlockLoading] = useState(false);

  useEffect(() => {
    hasOspreyPlus().then(setPlusActive).catch(() => setPlusActive(false));
  }, []);

  useEffect(() => {
    isDailyNudgeScheduled().then(setNudgeEnabled).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (userId) isCalendarBlockingEnabled(userId).then(setCalBlockEnabled).catch(() => undefined);
  }, [userId]);

  async function handleToggleCalendarBlocking() {
    if (!userId) return;
    setCalBlockLoading(true);
    try {
      if (calBlockEnabled) {
        await disableCalendarBlocking(userId);
        setCalBlockEnabled(false);
        return;
      }
      const ok = await enableCalendarBlocking(userId);
      if (!ok) {
        Alert.alert('Calendar', 'Enable calendar access in Settings to block workout time.');
        return;
      }
      setCalBlockEnabled(true);
      Alert.alert('Calendar', "Done — this week's planned workouts are now blocked on your calendar.");
    } catch (err) {
      Alert.alert('Calendar', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCalBlockLoading(false);
    }
  }

  async function handleToggleNudge() {
    if (!userId) return;
    setNudgeLoading(true);
    try {
      if (nudgeEnabled) {
        await cancelDailyNudge();
        setNudgeEnabled(false);
        setNudgeHour(null);
        return;
      }
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Notifications', 'Enable notifications in Settings to get Ozzie\'s daily nudge.');
        return;
      }
      const hour = await fetchSmartNudgeHour(userId);
      await scheduleDailyNudge(hour);
      setNudgeHour(hour);
      setNudgeEnabled(true);
    } catch (err) {
      Alert.alert('Notifications', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setNudgeLoading(false);
    }
  }

  async function handleConnectHealth() {
    if (!userId) return;
    setHealthSyncing(true);
    try {
      const authorized = await requestHealthKitAuthorization();
      if (!authorized) {
        Alert.alert('Apple Health', 'Permission was not granted.');
        return;
      }
      setHealthConnected(true);
      const synced = await syncRecoveryFromHealthKit(userId);
      Alert.alert(
        'Apple Health',
        synced
          ? "Connected — today's recovery score will reflect your HealthKit data."
          : 'Connected. No new HRV, sleep, or heart rate data found yet.',
      );
    } catch (err) {
      Alert.alert('Apple Health', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setHealthSyncing(false);
    }
  }

  function handleUpgrade() {
    // Route through the paywall screen rather than purchasing directly —
    // the OS payment sheet alone never shows the user the feature list,
    // price framing, or subscription terms (also an App Store review risk).
    router.push('/paywall');
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      setPlusActive(restored);
      Alert.alert('Restore', restored ? 'Purchases restored.' : 'No active subscription found.');
    } catch (err) {
      Alert.alert('Restore failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          {profile?.display_name ? `Signed in as ${profile.display_name}` : 'Account settings'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>OSPREY+</Text>
          {plusActive == null ? (
            <ActivityIndicator color={Colors.teal} />
          ) : (
            <Text style={styles.cardValue}>
              {plusActive ? 'Active — all features unlocked' : 'Free tier'}
            </Text>
          )}
          {!plusActive ? (
            <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} disabled={loading}>
              <Text style={styles.upgradeText}>Upgrade to OSPREY+</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.linkBtn} onPress={handleRestore} disabled={loading}>
            <Text style={styles.linkText}>Restore purchases</Text>
          </TouchableOpacity>
        </View>

        {isHealthKitSupported() ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Apple Health</Text>
            <Text style={styles.cardValue}>
              {healthConnected ? 'Connected' : 'Not connected'}
            </Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={handleConnectHealth}
              disabled={healthSyncing}
            >
              {healthSyncing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.upgradeText}>
                  {healthConnected ? 'Sync Now' : 'Connect Apple Health'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ozzie's Daily Nudge</Text>
          <Text style={styles.cardValue}>
            {nudgeEnabled
              ? nudgeHour != null
                ? `On · ${formatHour(nudgeHour)}`
                : 'On'
              : 'Off'}
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={handleToggleNudge}
            disabled={nudgeLoading}
          >
            {nudgeLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.upgradeText}>
                {nudgeEnabled ? 'Turn Off' : 'Turn On'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Calendar Blocking</Text>
          <Text style={styles.cardValue}>
            {calBlockEnabled ? 'On · workouts blocked on your calendar' : 'Off'}
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={handleToggleCalendarBlocking}
            disabled={calBlockLoading}
          >
            {calBlockLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.upgradeText}>{calBlockEnabled ? 'Turn Off' : 'Turn On'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Supplements & Meds</Text>
          <Text style={styles.cardValue}>Timed reminders</Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => router.push('/supplements')}
          >
            <Text style={styles.upgradeText}>Manage reminders</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>TRAINING PLAN</Text>
          <TouchableOpacity style={styles.planRow} onPress={() => router.push('/plan-preview')}>
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>This Week's Plan</Text>
              <Text style={styles.planRowSub}>See your full weekly schedule</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.planRowDivider} />
          <TouchableOpacity style={styles.planRow} onPress={() => router.push('/preferences')}>
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>Training Preferences</Text>
              <Text style={styles.planRowSub}>
                {profile?.experience_tier
                  ? `Goal, days per week · ${profile.experience_tier}`
                  : 'Goal, days per week, long run day'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 28, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: 24 },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  cardValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  upgradeBtn: {
    marginTop: 4,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  upgradeText: { fontSize: 14, fontWeight: '800', color: '#000' },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  linkText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  signOutBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signOutText: { color: Colors.red, fontSize: 14, fontWeight: '600' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  planRowLeft: { flex: 1 },
  planRowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  planRowDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  chevron: { fontSize: 22, color: Colors.textMuted, marginLeft: 8 },
});
