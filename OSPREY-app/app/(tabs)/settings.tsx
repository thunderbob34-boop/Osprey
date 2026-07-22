import { useEffect, useState } from 'react';
import {
  Linking,
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
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Card, Button } from '@/components/ui';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/constants/links';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';
import { blueprintSport } from '@/services/coaching/zones';
import type { PrimaryGoalEnum } from '@/services/coaching/goal-map';
import { goalLabel } from '@/constants/sports';
import type { UnitSystem } from '@/services/units';
import { useAuthStore } from '@/store/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { restorePurchases } from '@/services/subscriptions';
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
  isRaceWeekRemindersEnabled,
  requestNotificationPermission,
  scheduleDailyNudge,
  setRaceWeekRemindersEnabled,
} from '@/services/notifications';
import { isSupplementRemindersEnabled, setSupplementRemindersEnabled } from '@/services/supplements';
import { isEveningBriefEnabled, setEveningBriefEnabled } from '@/services/evening-brief';
import { requestDataExport } from '@/services/data-export';
import {
  disableCalendarBlocking,
  enableCalendarBlocking,
  isCalendarBlockingEnabled,
} from '@/services/calendar-blocking';

const HEALTH_CONNECTED_KEY = 'osprey:health-connected';
const HEALTH_LAST_SYNCED_KEY = 'osprey:health-last-synced';

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

function formatLastSynced(isoStr: string): string {
  const synced = new Date(isoStr);
  const minutes = Math.floor((Date.now() - synced.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SettingsTab() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const profile = useAuthStore((s) => s.profile);
  const { data: goal } = useTrainingGoal();

  // What the athlete's preferences actually ARE. This line used to read
  // "Goal, days per week · intermediate" — two field names joined to one value.
  const trainingSummary =
    [
      goalLabel(goal?.primaryGoal ?? null),
      goal?.daysPerWeek ? `${goal.daysPerWeek} days/week` : null,
      profile?.experience_tier ?? null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Goal, days per week, and long run day';
  const userId = useAuthStore((s) => s.user?.id);
  const { units, setUnits } = useUnitPreference();
  // Shared with every other screen — was a second, independent hasOspreyPlus()
  // poll that bypassed useSubscription()'s FREE_FOR_ALL override, so Settings
  // could show "Free tier" + an Upgrade button while the rest of the app
  // already treated the athlete as fully entitled.
  const { isPlus: plusActive, isLoading: plusLoading, refresh: refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthLastSynced, setHealthLastSynced] = useState<string | null>(null);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [nudgeEnabled, setNudgeEnabled] = useState(false);
  const [nudgeHour, setNudgeHour] = useState<number | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [calBlockEnabled, setCalBlockEnabled] = useState(false);
  const [calBlockLoading, setCalBlockLoading] = useState(false);
  const [suppRemindersEnabled, setSuppRemindersEnabled] = useState(true);
  const [suppRemindersLoading, setSuppRemindersLoading] = useState(false);
  const [raceWeekEnabled, setRaceWeekEnabled] = useState(true);
  const [raceWeekLoading, setRaceWeekLoading] = useState(false);
  const [eveningBriefEnabled, setEveningBriefEnabledState] = useState(false);
  const [eveningBriefLoading, setEveningBriefLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    isDailyNudgeScheduled().then(setNudgeEnabled).catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(HEALTH_CONNECTED_KEY)
      .then((v) => setHealthConnected(v === '1'))
      .catch(() => undefined);
    AsyncStorage.getItem(HEALTH_LAST_SYNCED_KEY)
      .then(setHealthLastSynced)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (userId) isCalendarBlockingEnabled(userId).then(setCalBlockEnabled).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (userId) isSupplementRemindersEnabled(userId).then(setSuppRemindersEnabled).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (userId) isRaceWeekRemindersEnabled(userId).then(setRaceWeekEnabled).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (userId) isEveningBriefEnabled(userId).then(setEveningBriefEnabledState).catch(() => undefined);
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

  async function handleToggleSupplementReminders() {
    if (!userId || suppRemindersLoading) return;
    setSuppRemindersLoading(true);
    try {
      const next = !suppRemindersEnabled;
      const ok = await setSupplementRemindersEnabled(userId, next);
      if (!ok) {
        Alert.alert('Notifications', 'Enable notifications in Settings to get supplement reminders.');
        return;
      }
      setSuppRemindersEnabled(next);
    } catch (err) {
      Alert.alert('Notifications', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSuppRemindersLoading(false);
    }
  }

  async function handleToggleRaceWeek() {
    if (!userId || raceWeekLoading) return;
    setRaceWeekLoading(true);
    try {
      const next = !raceWeekEnabled;
      const ok = await setRaceWeekRemindersEnabled(userId, next);
      if (!ok) {
        Alert.alert('Notifications', 'Enable notifications in Settings to get race-week reminders.');
        return;
      }
      setRaceWeekEnabled(next);
    } catch (err) {
      Alert.alert('Notifications', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setRaceWeekLoading(false);
    }
  }

  async function handleToggleEveningBrief() {
    if (!userId || eveningBriefLoading) return;
    setEveningBriefLoading(true);
    try {
      const next = !eveningBriefEnabled;
      const ok = await setEveningBriefEnabled(userId, next);
      if (!ok) {
        Alert.alert('Notifications', 'Enable notifications in Settings to get the evening look-ahead.');
        return;
      }
      setEveningBriefEnabledState(next);
    } catch (err) {
      Alert.alert('Notifications', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setEveningBriefLoading(false);
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
      const now = new Date().toISOString();
      await AsyncStorage.setItem(HEALTH_LAST_SYNCED_KEY, now).catch(() => undefined);
      setHealthLastSynced(now);
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
      refreshSubscription();
      Alert.alert('Restore', restored ? 'Purchases restored.' : 'No active subscription found.');
    } catch (err) {
      Alert.alert('Restore failed', err instanceof Error ? err.message : 'Try again.');
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

  async function handleExportData() {
    if (exporting) return;
    setExporting(true);
    try {
      const { email } = await requestDataExport();
      Alert.alert('Export sent', `Check ${email} in a few minutes for your data.`);
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setExporting(false);
    }
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

        <Card style={styles.card}>
          <Text style={styles.cardLabel}>OSPREY+</Text>
          {plusLoading ? (
            <ActivityIndicator color={Theme.accent} />
          ) : (
            <Text style={styles.cardValue}>
              {plusActive ? 'Active — all features unlocked' : 'Free tier'}
            </Text>
          )}
          {!plusActive ? (
            <Button
              variant="primary"
              onPress={() => router.push('/paywall')}
              accessibilityLabel="Upgrade to OSPREY+"
              style={styles.btnSpacing}
            >
              Upgrade to OSPREY+
            </Button>
          ) : null}
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={handleRestore}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Text style={styles.linkText}>Restore purchases</Text>
          </TouchableOpacity>
        </Card>

        {isHealthKitSupported() ? (
          <Card style={styles.card}>
            <Text style={styles.cardLabel}>Apple Health</Text>
            <Text style={styles.cardValue}>
              {healthConnected ? 'Connected' : 'Not connected'}
            </Text>
            {healthConnected && healthLastSynced ? (
              <Text style={styles.switchRowSub}>Last synced {formatLastSynced(healthLastSynced)}</Text>
            ) : null}
            <Button
              onPress={handleConnectHealth}
              disabled={healthSyncing}
              busy={healthSyncing}
              accessibilityLabel={healthConnected ? 'Sync Apple Health now' : 'Connect Apple Health'}
              style={styles.primaryBtn}
            >
              {healthSyncing ? (
                <ActivityIndicator color={Theme.ink} />
              ) : healthConnected ? (
                'Sync Now'
              ) : (
                'Connect Apple Health'
              )}
            </Button>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.cardLabel}>NOTIFICATIONS</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Text style={styles.cardValue}>Ozzie's Daily Nudge</Text>
              <Text style={styles.switchRowSub}>
                {nudgeEnabled
                  ? nudgeHour != null
                    ? `A daily check-in around ${formatHour(nudgeHour)}`
                    : 'A daily check-in at your usual training time'
                  : 'One notification a day, timed to your training'}
              </Text>
            </View>
            {nudgeLoading ? (
              <ActivityIndicator color={Theme.accent} />
            ) : (
              <Switch
                value={nudgeEnabled}
                onValueChange={handleToggleNudge}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: Theme.accent }}
                thumbColor={nudgeEnabled ? Theme.accent : '#f4f3f4'}
                accessibilityRole="switch"
                accessibilityLabel="Ozzie's daily nudge"
              />
            )}
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Text style={styles.cardValue}>Supplement Reminders</Text>
              <Text style={styles.switchRowSub}>Timed nudges for each reminder you've set up</Text>
            </View>
            {suppRemindersLoading ? (
              <ActivityIndicator color={Theme.accent} />
            ) : (
              <Switch
                value={suppRemindersEnabled}
                onValueChange={handleToggleSupplementReminders}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: Theme.accent }}
                thumbColor={suppRemindersEnabled ? Theme.accent : '#f4f3f4'}
                accessibilityRole="switch"
                accessibilityLabel="Supplement reminders"
              />
            )}
          </View>
          <TouchableOpacity
            style={styles.subLinkRow}
            onPress={() => router.push('/supplements')}
            accessibilityRole="button"
            accessibilityLabel="Manage individual supplement and medication reminders"
          >
            <Text style={styles.subLinkText}>Manage individual reminders</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Text style={styles.cardValue}>Race-Week Reminders</Text>
              <Text style={styles.switchRowSub}>A heads-up 7 days before each upcoming race</Text>
            </View>
            {raceWeekLoading ? (
              <ActivityIndicator color={Theme.accent} />
            ) : (
              <Switch
                value={raceWeekEnabled}
                onValueChange={handleToggleRaceWeek}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: Theme.accent }}
                thumbColor={raceWeekEnabled ? Theme.accent : '#f4f3f4'}
                accessibilityRole="switch"
                accessibilityLabel="Race-week reminders"
              />
            )}
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Text style={styles.cardValue}>Evening Look-Ahead</Text>
              <Text style={styles.switchRowSub}>
                An 8pm heads-up on tomorrow's session, weather, and fueling
              </Text>
            </View>
            {eveningBriefLoading ? (
              <ActivityIndicator color={Theme.accent} />
            ) : (
              <Switch
                value={eveningBriefEnabled}
                onValueChange={handleToggleEveningBrief}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: Theme.accent }}
                thumbColor={eveningBriefEnabled ? Theme.accent : '#f4f3f4'}
                accessibilityRole="switch"
                accessibilityLabel="Evening look-ahead"
              />
            )}
          </View>
        </Card>

        <Card style={styles.card}>
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
              <ActivityIndicator color={Theme.accent} />
            ) : (
              <Switch
                value={calBlockEnabled}
                onValueChange={handleToggleCalendarBlocking}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: Theme.accent }}
                thumbColor={calBlockEnabled ? Theme.accent : '#f4f3f4'}
                accessibilityRole="switch"
                accessibilityLabel="Calendar blocking"
              />
            )}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Training Plan</Text>
          <TouchableOpacity
            style={styles.planRow}
            onPress={() => router.push('/plan-preview')}
            accessibilityRole="button"
            accessibilityLabel="This week's plan"
          >
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>This Week's Plan</Text>
              <Text style={styles.planRowSub}>See your full weekly schedule</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.planRow}
            onPress={() => router.push('/preferences')}
            accessibilityRole="button"
            accessibilityLabel="Training preferences"
          >
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>Training Preferences</Text>
              <Text style={styles.planRowSub}>{trainingSummary}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {blueprintSport(goal?.primaryGoal ?? '') != null ||
          (goal?.primaryGoal as PrimaryGoalEnum | undefined) === 'triathlon' ? (
            <>
              <View style={styles.rowDivider} />
              <TouchableOpacity
                style={styles.planRow}
                onPress={() => router.push('/training-baseline')}
                accessibilityRole="button"
                accessibilityLabel="Training baseline"
              >
                <View style={styles.planRowLeft}>
                  <Text style={styles.cardValue}>Training Baseline</Text>
                  <Text style={styles.planRowSub}>Sharpen your training paces</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* Hyrox-only, and here rather than under About & Support: it's a
              coaching feature, not legal boilerplate, and a runner has no use
              for a quiz on the Hyrox race format. */}
          {goal?.primaryGoal === 'hyrox' ? (
            <>
              <View style={styles.rowDivider} />
              <TouchableOpacity
                style={styles.planRow}
                onPress={() => router.push('/hyrox-quiz')}
                accessibilityRole="button"
                accessibilityLabel="Hyrox knowledge quiz"
              >
                <View style={styles.planRowLeft}>
                  <Text style={styles.cardValue}>Hyrox Knowledge Quiz</Text>
                  <Text style={styles.planRowSub}>Test what you know about the race format</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Units</Text>
          <View style={styles.unitToggleRow}>
            {(['imperial', 'metric'] as UnitSystem[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.unitOption, units === option && styles.unitOptionActive]}
                onPress={() => setUnits.mutate(option)}
                disabled={setUnits.isPending}
                accessibilityRole="button"
                accessibilityLabel={option === 'imperial' ? 'Imperial, miles and pounds' : 'Metric, kilometers and kilograms'}
                accessibilityState={{ selected: units === option, disabled: setUnits.isPending }}
              >
                <Text style={[styles.unitOptionText, units === option && styles.unitOptionTextActive]}>
                  {option === 'imperial' ? 'Imperial (mi, lbs)' : 'Metric (km, kg)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardLabel}>About & Support</Text>
          <TouchableOpacity
            style={styles.planRow}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined)}
            accessibilityRole="button"
            accessibilityLabel="Privacy policy"
          >
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>Privacy Policy</Text>
              <Text style={styles.planRowSub}>How your training data is handled</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.planRow}
            onPress={() =>
              Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=OSPREY%20Support`).catch(() =>
                Alert.alert('Contact Support', `Email us at ${SUPPORT_EMAIL}`),
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Contact support"
          >
            <View style={styles.planRowLeft}>
              <Text style={styles.cardValue}>Contact Support</Text>
              <Text style={styles.planRowSub}>{SUPPORT_EMAIL}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Your Data</Text>
          <Text style={styles.planRowSub}>
            Export everything you've logged — workouts, lift sets, nutrition, bodyweight, and races —
            as CSV files emailed to your account address.
          </Text>
          <Button
            variant="secondary"
            onPress={handleExportData}
            disabled={exporting}
            busy={exporting}
            accessibilityLabel="Export my data"
            style={styles.exportBtn}
          >
            {exporting ? <ActivityIndicator color={Theme.accent} /> : 'Export My Data'}
          </Button>
        </Card>

        <Button
          variant="secondary"
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          style={styles.signOutBtn}
        >
          Sign Out
        </Button>

        {/* ── Danger zone ── */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerLabel}>Danger Zone</Text>
          <Text style={styles.dangerSub}>
            Permanently delete your account and all training data.
          </Text>
          {/* NOT converted to <Button>: this is the destructive delete-account
              action, deliberately styled red through the whole design migration.
              The primitive is accent-only (primary/secondary), so converting it
              would erase the danger signal. Left hand-rolled on purpose. */}
          <TouchableOpacity
            style={[styles.dangerBtn, deleting && styles.dangerBtnDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityState={{ disabled: deleting, busy: deleting }}
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
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '900', color: Theme.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Theme.textMut, lineHeight: 20, marginBottom: 24 },
  card: {
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.textMut,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  cardValue: { fontSize: 15, fontWeight: '700', color: Theme.text },
  unitToggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  unitOption: {
    flex: 1,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    backgroundColor: 'transparent',
    borderRadius: Radius.card,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unitOptionActive: { backgroundColor: Theme.panel, borderColor: Theme.accent },
  unitOptionText: { fontSize: 13, fontWeight: '600', color: Theme.textSoft },
  unitOptionTextActive: { color: Theme.accent, fontWeight: '700' },
  // Only what <Button> does not already provide (fill, border, radius,
  // paddingVertical: 12, and ink label all come from the primary variant now).
  primaryBtn: { marginTop: 4 },
  btnSpacing: { marginTop: 4 },
  // Left-aligned and accented like every other control on this screen. Centred
  // grey text read as a caption, not something you could tap.
  linkBtn: { alignSelf: 'flex-start', paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 13, color: Theme.accent, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchRowLeft: { flex: 1, gap: 4 },
  switchRowSub: { fontSize: 12, color: Theme.textSoft, lineHeight: 17 },
  rowDivider: { height: 1, backgroundColor: Theme.line, marginVertical: 10 },
  subLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingLeft: 4,
  },
  subLinkText: { fontSize: 12, fontWeight: '600', color: Theme.accent },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  planRowLeft: { flex: 1 },
  planRowSub: { fontSize: 12, color: Theme.textSoft, marginTop: 2 },
  chevron: { fontSize: 22, color: Theme.textMut, marginLeft: 8 },
  signOutBtn: {
    marginTop: 12,
  },
  // variant="secondary" gives the accent label/spinner and BorderWidth.card/
  // Radius.card border for free; this button additionally overrides the
  // secondary variant's transparent fill + accent border with a panel fill
  // + line border (its own third look, documented as fair game via `style`
  // in the primitive's own prop docs), plus its own padding/alignment.
  exportBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: Theme.panel,
    borderColor: Theme.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
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
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  dangerSub: { fontSize: 12, color: Theme.textSoft, lineHeight: 17 },
  dangerBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.45)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnDisabled: { opacity: 0.5 },
  dangerBtnText: { fontSize: 14, fontWeight: '800', color: Colors.red },
  versionText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    color: Theme.textMut,
  },
});
