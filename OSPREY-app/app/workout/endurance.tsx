import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import OzzieAvatar from '@/components/OzzieAvatar';
import { useAuthStore } from '@/store/authStore';
import { fetchIntervalPrescription, saveEnduranceWorkout, type EnduranceType } from '@/services/workouts';
import { expandIntervalSteps, ozzieCueForStep, totalIntervalDistanceM, type IntervalStep } from '@/services/intervals';
import { ozzieSpeak, ozzieStop } from '@/services/ozzie-audio';
import { formatDuration } from '@/store/workoutStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import {
  fetchHealthKitWorkouts,
  isHealthKitSupported,
  requestHealthKitAuthorization,
} from '@/services/healthkit';
import type { IntervalEffort, IntervalPrescription } from '@/types/workout';

type DistanceUnit = 'meters' | 'yards' | 'km' | 'miles';

const METERS_PER_UNIT: Record<DistanceUnit, number> = {
  meters: 1,
  yards: 0.9144,
  km: 1000,
  miles: 1609.34,
};

function metersToUnit(meters: number, unit: DistanceUnit): number {
  return meters / METERS_PER_UNIT[unit];
}

const SESSION_META: Record<EnduranceType, { icon: string; label: string; color: string; borderColor: string }> = {
  swim: { icon: '🏊', label: 'SWIM',  color: Colors.teal,  borderColor: Colors.borderTeal },
  bike: { icon: '🚴', label: 'BIKE',  color: Colors.teal,  borderColor: Colors.borderTeal },
  cross:{ icon: '🔁', label: 'CROSS', color: Colors.amber, borderColor: Colors.borderGold },
};

interface CrossActivity {
  id: string;
  label: string;
  icon: string;
}

const CROSS_ACTIVITIES: CrossActivity[] = [
  { id: 'crossfit',   label: 'CrossFit',           icon: '🏋️' },
  { id: 'yoga',       label: 'Yoga',                icon: '🧘' },
  { id: 'hiit',       label: 'HIIT',                icon: '🔥' },
  { id: 'mobility',   label: 'Mobility / Stretch',  icon: '🤸' },
  { id: 'rowing',     label: 'Rowing',              icon: '🚣' },
  { id: 'elliptical', label: 'Elliptical',          icon: '🌀' },
  { id: 'stairs',     label: 'Stair Climber',       icon: '🪜' },
  { id: 'hiking',     label: 'Hiking',              icon: '🥾' },
  { id: 'other',      label: 'Other',               icon: '🔁' },
];

const ENCOURAGEMENTS: Record<EnduranceType, string[]> = {
  swim: [
    'Smooth strokes. Stay long in the water.',
    "Every length counts. Keep your technique tight.",
    'Focus on hip rotation — power comes from the core, not the arms.',
  ],
  bike: [
    'Steady cadence. Let the gears do the work.',
    "Keep your upper body relaxed — only your legs should burn.",
    'Mid-ride check: stay hydrated, keep the power consistent.',
  ],
  cross: [
    'Active recovery is still training. This is how champions stay fresh.',
    "Your body's rebuilding right now. Stay with it.",
    'Consistent effort. Every session moves the needle.',
  ],
};

const EFFORT_COLOR: Record<IntervalEffort | 'rest', string> = {
  easy: Colors.teal,
  moderate: Colors.teal,
  threshold: Colors.amber,
  hard: Colors.red,
  max: Colors.red,
  rest: Colors.textMuted,
};

const AUTO_CUE_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function EnduranceWorkoutScreen() {
  const router = useRouter();
  const { sessionType, sessionId } = useLocalSearchParams<{ sessionType: EnduranceType; sessionId?: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { isPlus } = useSubscription();
  const { units: unitPreference } = useUnitPreference();

  const type: EnduranceType = (sessionType ?? 'cross') as EnduranceType;
  const meta = SESSION_META[type] ?? SESSION_META.cross;

  // Swims are conventionally tracked in meters/yards (pool lengths); other
  // endurance sessions use km/miles — both follow the account-wide unit
  // preference (Settings → Units), no per-session picker.
  const distanceUnit: DistanceUnit =
    type === 'swim'
      ? unitPreference === 'metric' ? 'meters' : 'yards'
      : unitPreference === 'metric' ? 'km' : 'miles';

  // startedAtRef is set at mount for swim/bike (timer starts immediately, as
  // always) but reset the moment a cross-training activity is picked — time
  // spent choosing shouldn't count toward "elapsed."
  const startedAtRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [distance, setDistance] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [crossActivity, setCrossActivity] = useState<CrossActivity | null>(null);
  const [sessionStarted, setSessionStarted] = useState(type !== 'cross');
  const lastAutoCueMs = useRef(0);
  const speakingRef = useRef(false);

  // Cross-training has no distance measurement — CrossFit/yoga/rowing/etc.
  // are all tracked purely by time.
  const showDistance = type !== 'cross';
  const badgeMeta = type === 'cross' && crossActivity
    ? { icon: crossActivity.icon, label: crossActivity.label.toUpperCase(), color: meta.color, borderColor: meta.borderColor }
    : meta;

  function startCrossActivity(activity: CrossActivity) {
    setCrossActivity(activity);
    startedAtRef.current = Date.now();
    setSessionStarted(true);
  }

  // ── Structured interval set (Ozzie's prescribed swim/bike workout) ──
  const [intervalSteps, setIntervalSteps] = useState<IntervalStep[]>([]);
  const [prescription, setPrescription] = useState<IntervalPrescription | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepRemainingS, setStepRemainingS] = useState<number | null>(null);
  const [intervalsComplete, setIntervalsComplete] = useState(false);
  const cuedStepRef = useRef(-1);
  // Wall-clock deadline for the current countdown step — the 1s timer compares
  // against this instead of decrementing state, so a slow JS frame can't drift
  // the countdown.
  const stepEndAtRef = useRef<number | null>(null);
  // Refs mirror state the timer callback needs, since its closure only
  // refreshes when intervalSteps changes — reading refs avoids stale values
  // and keeps advanceStep free of setState-updater side effects.
  const stepIndexRef = useRef(0);
  const intervalStepsRef = useRef<IntervalStep[]>([]);
  const prescriptionRef = useRef<IntervalPrescription | null>(null);
  const completedRef = useRef(false);

  const hasIntervals = intervalSteps.length > 0;
  const currentStep = hasIntervals ? intervalSteps[stepIndex] : null;

  useEffect(() => {
    if (!sessionId || (type !== 'swim' && type !== 'bike')) return;
    fetchIntervalPrescription(sessionId)
      .then((p) => {
        if (!p) return;
        const steps = expandIntervalSteps(p);
        if (steps.length === 0) return;
        prescriptionRef.current = p;
        intervalStepsRef.current = steps;
        setPrescription(p);
        setIntervalSteps(steps);
      })
      .catch(() => undefined);
  }, [sessionId, type]);

  // Speak Ozzie's cue once per step and (re)arm the countdown deadline.
  useEffect(() => {
    if (!currentStep || cuedStepRef.current === stepIndex) return;
    cuedStepRef.current = stepIndex;
    stepEndAtRef.current = currentStep.durationS != null ? Date.now() + currentStep.durationS * 1000 : null;
    setStepRemainingS(currentStep.durationS);
    ozzieSpeak(ozzieCueForStep(currentStep), 'workout').catch(() => undefined);
  }, [currentStep, stepIndex]);

  function advanceStep() {
    if (completedRef.current) return;
    const nextIndex = stepIndexRef.current + 1;

    if (nextIndex >= intervalStepsRef.current.length) {
      completedRef.current = true;
      stepEndAtRef.current = null;
      setIntervalsComplete(true);
      setStepRemainingS(null);
      ozzieSpeak("That's the full set — nice work. Wrap up and save when you're ready.", 'workout').catch(
        () => undefined,
      );
      // Auto-fill total distance if every segment was distance-based.
      const p = prescriptionRef.current;
      if (p) {
        const totalM = totalIntervalDistanceM(p);
        if (totalM != null) {
          setDistance(String(Math.round(metersToUnit(totalM, distanceUnit) * 100) / 100));
        }
      }
      return;
    }

    stepIndexRef.current = nextIndex;
    setStepIndex(nextIndex);
  }

  useEffect(() => {
    // Cross-training hasn't picked an activity yet — don't tick until it has.
    if (!sessionStarted) return;

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));

      if (stepEndAtRef.current != null) {
        const remaining = Math.ceil((stepEndAtRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          stepEndAtRef.current = null; // prevent double-advance before the next step re-arms it
          advanceStep();
        } else {
          setStepRemainingS(remaining);
        }
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      ozzieStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalSteps, sessionStarted]);

  // Auto cues every 10 minutes (OSPREY+ only) — skip while running a structured set,
  // Ozzie is already narrating each interval.
  useEffect(() => {
    if (!isPlus || speakingRef.current || hasIntervals) return;
    const nowMs = Date.now();
    if (elapsed > 0 && nowMs - lastAutoCueMs.current >= AUTO_CUE_INTERVAL_MS) {
      lastAutoCueMs.current = nowMs;
      const cues = ENCOURAGEMENTS[type];
      const idx = Math.floor(elapsed / 600) % cues.length;
      speakingRef.current = true;
      ozzieSpeak(cues[idx], 'workout').finally(() => { speakingRef.current = false; });
    }
  }, [elapsed, isPlus, type, hasIntervals]);

  async function handleManualCue() {
    const cues = ENCOURAGEMENTS[type];
    const cue = cues[Math.floor(Math.random() * cues.length)];
    await ozzieSpeak(cue, 'workout');
  }

  async function handleSyncHealthKit() {
    if (!isHealthKitSupported()) {
      Alert.alert('Apple Health', 'HealthKit not available on this device.');
      return;
    }
    setSyncing(true);
    try {
      const authorized = await requestHealthKitAuthorization();
      if (!authorized) {
        Alert.alert('Apple Health', 'Permission not granted. Enter distance manually.');
        return;
      }
      // Look for a workout an Apple Watch (or other HealthKit source) recorded
      // since this session started — e.g. the user also hit "start" on the
      // Watch's own Workout app in parallel with OSPREY.
      const workouts = await fetchHealthKitWorkouts(new Date(startedAtRef.current).toISOString());
      const match = workouts.find((w) => w.distanceMeters != null && w.distanceMeters > 0);
      if (match?.distanceMeters != null) {
        const converted = metersToUnit(match.distanceMeters, distanceUnit);
        setDistance(String(Math.round(converted * 100) / 100));
        Alert.alert(
          'Apple Health',
          `Pulled ${converted.toFixed(2)} ${distanceUnit} from your ${match.activityName} workout.`,
        );
      } else {
        Alert.alert(
          'Apple Health',
          "No matching workout with distance found yet. If you're recording on Apple Watch, end that workout first, then sync again — or enter distance manually.",
        );
      }
    } catch {
      Alert.alert('Apple Health', 'Could not sync. Enter distance manually.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleEnd() {
    if (!userId) return;
    setSaving(true);
    try {
      const durationS = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const distanceParam = showDistance && distance && parseFloat(distance) > 0
        ? { value: parseFloat(distance), unit: distanceUnit }
        : null;
      const workoutId = await saveEnduranceWorkout({
        userId,
        sessionId: sessionId ?? null,
        sessionType: type,
        startedAt: startedAtRef.current,
        durationS,
        distance: distanceParam,
        notes: type === 'cross' && crossActivity && crossActivity.id !== 'other' ? crossActivity.label : null,
      });
      router.replace({ pathname: '/workout/recap', params: { workoutId } });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      setSaving(false);
    }
  }

  function confirmEnd() {
    Alert.alert('End session?', 'Save this workout and see your recap.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard & Exit', style: 'destructive', onPress: () => router.replace('/(tabs)') },
      { text: 'End & Save', onPress: handleEnd },
    ]);
  }

  if (type === 'cross' && !sessionStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.pickerCloseBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.pickerCloseText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerTitle}>What are you doing?</Text>
          <Text style={styles.pickerSubtitle}>Pick an activity and Ozzie starts the clock.</Text>
          <View style={styles.activityGrid}>
            {CROSS_ACTIVITIES.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityTile}
                onPress={() => startCrossActivity(activity)}
                accessibilityRole="button"
                accessibilityLabel={`Start ${activity.label}`}
              >
                <Text style={styles.activityTileIcon}>{activity.icon}</Text>
                <Text style={styles.activityTileLabel}>{activity.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const hours = Math.floor(elapsed / 3600);
  const mins  = Math.floor((elapsed % 3600) / 60);
  const secs  = elapsed % 60;
  const timeStr = hours > 0
    ? `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
    : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.sessionBadge, { borderColor: badgeMeta.borderColor }]}>
          <Text style={styles.sessionIcon}>{badgeMeta.icon}</Text>
          <Text style={[styles.sessionLabel, { color: badgeMeta.color }]}>
            {hasIntervals ? `${badgeMeta.label} · OZZIE'S SET` : `${badgeMeta.label} IN PROGRESS`}
          </Text>
        </View>

        <View style={styles.timerBlock}>
          <Text style={styles.timerValue}>{timeStr}</Text>
          <Text style={styles.timerSub}>elapsed</Text>
        </View>

        {hasIntervals ? (
          <View
            style={[
              styles.intervalCard,
              { borderColor: EFFORT_COLOR[currentStep?.effort ?? 'rest'] + '55' },
            ]}
          >
            {intervalsComplete ? (
              <>
                <Text style={styles.intervalDoneIcon}>✓</Text>
                <Text style={styles.intervalDoneText}>Set complete — nice work</Text>
              </>
            ) : currentStep ? (
              <>
                <View style={styles.intervalHeaderRow}>
                  <Text style={styles.intervalProgress}>
                    Step {stepIndex + 1} of {intervalSteps.length}
                  </Text>
                  <View
                    style={[
                      styles.effortPill,
                      { backgroundColor: EFFORT_COLOR[currentStep.effort] + '22' },
                    ]}
                  >
                    <Text style={[styles.effortPillText, { color: EFFORT_COLOR[currentStep.effort] }]}>
                      {currentStep.effort.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.intervalLabel}>
                  {currentStep.phase === 'rest' ? 'Rest' : currentStep.label}
                </Text>
                {currentStep.totalReps > 1 ? (
                  <Text style={styles.intervalRep}>
                    Rep {currentStep.repIndex} of {currentStep.totalReps}
                  </Text>
                ) : null}

                {stepRemainingS != null ? (
                  <Text style={styles.intervalCountdown}>{formatMMSS(stepRemainingS)}</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.intervalCompleteBtn}
                    onPress={advanceStep}
                    accessibilityRole="button"
                    accessibilityLabel="Mark interval complete"
                  >
                    <Text style={styles.intervalCompleteBtnText}>Mark Interval Complete</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.ozzieBtn}
          onPress={handleManualCue}
          accessibilityRole="button"
          accessibilityLabel="Get an Ozzie cue"
        >
          <OzzieAvatar size={18} />
          <Text style={styles.ozzieBtnText}>Ozzie Cue</Text>
        </TouchableOpacity>

        {showDistance ? (
          <View style={styles.distanceCard}>
            <Text style={styles.distanceLabel}>Distance ({distanceUnit})</Text>
            <View style={styles.distanceInputRow}>
              <TextInput
                style={styles.distanceInput}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                value={distance}
                onChangeText={setDistance}
                keyboardType="decimal-pad"
                accessibilityLabel={`Distance in ${distanceUnit}`}
              />
            </View>
            <TouchableOpacity
              style={[styles.syncBtn, syncing && { opacity: 0.6 }]}
              onPress={handleSyncHealthKit}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel="Sync distance from Apple Health"
              accessibilityState={{ disabled: syncing, busy: syncing }}
            >
              {syncing ? (
                <ActivityIndicator color={Colors.teal} size="small" />
              ) : (
                <Text style={styles.syncBtnText}>Sync from Apple Health</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.endBtn}
          onPress={confirmEnd}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="End and save session"
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          {saving ? (
            <ActivityIndicator color={Colors.red} />
          ) : (
            <Text style={styles.endBtnText}>End & Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, padding: 28, justifyContent: 'center', gap: 20 },

  // Pre-start activity picker (cross-training only)
  pickerCloseBtn: { alignSelf: 'flex-end', padding: 16 },
  pickerCloseText: { fontSize: 18, fontWeight: '700', color: Colors.textMuted },
  pickerContent: { flex: 1, padding: 28, paddingTop: 0, justifyContent: 'center', gap: 24 },
  pickerTitle: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  pickerSubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: -12 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  activityTile: {
    width: '46%',
    aspectRatio: 1.3,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activityTileIcon: { fontSize: 30 },
  activityTileLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  sessionBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionIcon: { fontSize: 20 },
  sessionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  timerBlock: { alignItems: 'center', gap: 6, marginVertical: 20 },
  timerValue: { fontSize: 72, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -2 },
  timerSub: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },

  // Interval runner
  intervalCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  intervalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  intervalProgress: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  effortPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  effortPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  intervalLabel: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  intervalRep: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  intervalCountdown: {
    fontSize: 40,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: 6,
    letterSpacing: -1,
  },
  intervalCompleteBtn: {
    marginTop: 8,
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  intervalCompleteBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  intervalDoneIcon: { fontSize: 32, color: Colors.green, fontWeight: '900' },
  intervalDoneText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },

  ozzieBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ozzieBtnText: { fontSize: 15, fontWeight: '700', color: Colors.teal },
  distanceCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  distanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  distanceInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  distanceInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  syncBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.teal,
  },
  endBtn: {
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  endBtnText: { fontSize: 15, fontWeight: '700', color: Colors.red },
});
