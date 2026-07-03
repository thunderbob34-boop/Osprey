import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { hasOspreyPlus, restorePurchases } from '@/services/subscriptions';
import {
  isHealthKitSupported,
  requestHealthKitAuthorization,
  syncRecoveryFromHealthKit,
} from '@/services/healthkit';
import { importHealthKitWorkouts } from '@/services/healthkit-import';
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

const HEALTH_CONNECTED_KEY = 'osprey:health-connected';

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export default function SettingsTab() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    hasOspreyPlus().then(setPlusActive).catch(() => setPlusActive(false));
  }, []);

  useEffect(() => {
    isDailyNudgeScheduled().then(setNudgeEnabled).catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(HEALTH_CONNECTED_KEY)
      .then((v) => setHealthConnected(v === '1'))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (userId) isCalendarBlockingEnabled(userId).then(setCalBlockEnabled).catch(() => undefined);
  }, [userId]);

  async function handleToggleCalendarBlocking() {
    if (!userId || calBlockLoading) return;
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
    } catch (err) {
      Alert.alert('Calendar', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCalBlockLoading(false);
    }
  }

  async function handleToggleNudge() {
    if (!userId || nudgeLoading) return;
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
      await AsyncStorage.setItem(HEALTH_CONNECTED_KEY, '1').catch(() => undefined);
      const [synced, imported] = await Promise.all([
        syncRecoveryFromHealthKit(userId),
        importHealthKitWorkouts(userId).catch(() => ({ imported: 0, skipped: 0 })),
      ]);
      const parts = [
        synced
          ? "Recovery score will reflect your HealthKit data."
          : 'No new HRV, sleep, or heart rate data found yet.',
      ];
      if (imported.imported > 0) {
        parts.push(
          `Imported ${imported.imported} workout${imported.imported === 1 ? '' : 's'} from Apple Watch/other apps.`,
        );
      }
      Alert.alert('Apple Health', `Connected — ${parts.join(' ')}`);
    } catch (err) {
      Alert.alert('Apple Health', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setHealthSyncing(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      setPlusActive(restored);
      Alert.alert('Restore', restored ? 'Purchases restored.' : 'No active subscription found.');
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently erases your account, workouts, plans, races, and nutrition history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            // Second confirmation — this is irreversible.
            Alert.alert('Are you sure?', 'All of your OSPREY data will be gone for good.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Yes, delete everything',
                style: 'destructive',
                onPress: async () => {
                  setDeleting(true);
                  const { error } = await deleteAccount();
                  setDeleting(false);
                  if (error) {
                    Alert.alert('Delete failed', error);
                  }
                  // On success the cleared session redirects to sign-in automatically.
                },
              },
            ]);
          },
        },
      ],
    );
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/paywall')}>
              <Text style={styles.primaryBtnText}>Upgrade to OSPREY+</Text>
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
              style={styles.primaryBtn}
              onPress={handleConnectHealth}
              disabled={healthSyncing}
            >
              {healthSyncing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {healthConnected ? 'Sync Now' : 'Connect Apple Health'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Text style={styles.cardLabel}>Ozzie's Daily Nudge</Text>
              <Text style={styles.switchRowSub}>
                {nudgeEnabled
                  ? nudgeHour != null
                    ? `A daily check-in around ${formatHour(nudgeHour)}`
                    : 'A daily check-in at your usual training time'
                  : 'One notification a day, timed to your training'}
              </Text>
            </View>
            {nudgeLoading ? (
              <ActivityIndicator color={Colors.teal} />
            ) : (
              <Switch
                value={nudgeEnabled}
                onValueChange={handleToggleNudge}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.tealDark }}
                thumbColor={nudgeEnabled ? Colors.teal : '#f4f3f4'}
              />
            )}
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Text style={styles.cardLabel}>Calendar Blocking</Text>
              <Text style={styles.switchRowSub}>
                {calBlockEnabled
                  ? 'Planned workouts are blocked on your calendar'
                  : 'Reserve time for planned workouts'}
              </Text>
            </View>
            {calBlockLoading ? (
              <ActivityIndicator color={Colors.teal} />
            ) : (
              <Switch
                value={calBlockEnabled}
                onValueChange={handleToggleCalendarBlocking}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.tealDark }}
                thumbColor={calBlockEnabled ? Colors.teal : '#f4f3f4'}
              />
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Supplements & Meds</Text>
          <TouchableOpacity style={styles.planRow} onPress={() => router.push('/supplements')}>
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>Reminders</Text>
              <Text style={styles.planRowSub}>Timed supplement & medication nudges</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Training Plan</Text>
          <TouchableOpacity style={styles.planRow} onPress={() => router.push('/plan-preview')}>
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>This Week's Plan</Text>
              <Text style={styles.planRowSub}>See your full weekly schedule</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
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

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Danger zone ── */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerLabel}>Danger Zone</Text>
          <Text style={styles.dangerSub}>
            Permanently delete your account and all training data.
          </Text>
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color={Colors.red} />
            ) : (
              <Text style={styles.dangerBtnText}>Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>OSPREY v{appVersion}</Text>
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
    textTransform: 'uppercase',
  },
  cardValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  linkText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchRowLeft: { flex: 1, gap: 4 },
  switchRowSub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  planRowLeft: { flex: 1 },
  planRowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted, marginLeft: 8 },
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
  signOutText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  dangerCard: {
    marginTop: 24,
    backgroundColor: 'rgba(255,68,68,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  dangerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.red,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dangerSub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  dangerBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.45)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnText: { fontSize: 14, fontWeight: '800', color: Colors.red },
  versionText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
  },
});
