import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import OzzieAvatar from '@/components/OzzieAvatar';
import RunMap from '@/components/RunMap';
import { useRunTracking } from '@/hooks/useRunTracking';
import {
  useWorkoutStore,
  getElapsedSeconds,
  formatDuration,
  metersToMiles,
} from '@/store/workoutStore';
import { useAuthStore } from '@/store/authStore';
import { fetchIntervalPrescription, saveRunWorkout } from '@/services/workouts';
import { expandIntervalSteps, type IntervalStep } from '@/services/intervals';
import {
  computeStepProgress,
  fetchPaceBands,
  formatPaceBand,
  formatPaceSecPerMile,
  paceStatusForBand,
  runCueForStep,
  type PaceBands,
} from '@/services/run-guidance';
import { OZZIE_VOICE_ENABLED, ozzieSpeak, ozzieStop } from '@/services/ozzie-audio';
import { useCueBanner } from '@/hooks/useCueBanner';
import { generateWarmup, type WarmupDrill } from '@/services/warmup';
import { OUTSIDE_RUN_CUES } from '@/services/ozzie-cues';
import {
  fetchLatestHeartRateBpm,
  isHealthKitSupported,
  requestHealthKitAuthorization,
} from '@/services/healthkit';
import {
  checkCues,
  makeCoachingState,
  type CoachingState,
} from '@/services/coaching-engine';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistanceKm, formatPacePerUnit } from '@/services/units';

export default function RunWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const userId = useAuthStore((s) => s.user?.id);

  const status = useWorkoutStore((s) => s.status);
  const startedAt = useWorkoutStore((s) => s.startedAt);
  const pausedAt = useWorkoutStore((s) => s.pausedAt);
  const accumulatedPauseMs = useWorkoutStore((s) => s.accumulatedPauseMs);
  const distanceMeters = useWorkoutStore((s) => s.distanceMeters);
  const trackPoints = useWorkoutStore((s) => s.trackPoints);
  const heartRate = useWorkoutStore((s) => s.heartRate);
  const setHeartRate = useWorkoutStore((s) => s.setHeartRate);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const reset = useWorkoutStore((s) => s.reset);

  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [warmingUp, setWarmingUp] = useState(true);
  const [warmupDrills] = useState<WarmupDrill[]>(() => generateWarmup('run'));
  const [checkedDrills, setCheckedDrills] = useState<Set<number>>(new Set());
  const allDrillsChecked = warmupDrills.length > 0 && checkedDrills.size === warmupDrills.length;
  const coachingStateRef = useRef<CoachingState>(makeCoachingState());
  const speakingRef = useRef(false);
  const { isPlus } = useSubscription();
  const { units } = useUnitPreference();
  const { cueBannerText, showCueBanner } = useCueBanner();

  // Structured in-run guidance (Ozzie-prescribed intervals for today's session)
  const [intervalSteps, setIntervalSteps] = useState<IntervalStep[] | null>(null);
  const [paceBands, setPaceBands] = useState<PaceBands | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [intervalsDone, setIntervalsDone] = useState(false);
  const stepStartRef = useRef({ elapsedS: 0, distanceM: 0 });

  useRunTracking(status === 'active');

  useEffect(() => {
    if (!params.sessionId) return;
    fetchIntervalPrescription(params.sessionId)
      .then((prescription) => {
        if (prescription) setIntervalSteps(expandIntervalSteps(prescription));
      })
      .catch(() => undefined);
    if (userId) {
      fetchPaceBands(userId).then(setPaceBands).catch(() => undefined);
    }
  }, [params.sessionId, userId]);

  // Auto-advance interval steps on time/distance and cue every transition.
  useEffect(() => {
    if (!intervalSteps || intervalsDone || status !== 'active') return;
    const step = intervalSteps[stepIndex];
    if (!step) return;

    const progress = computeStepProgress(
      step,
      stepStartRef.current.elapsedS,
      stepStartRef.current.distanceM,
      elapsed,
      distanceMeters,
    );
    if (!progress.done) return;

    stepStartRef.current = { elapsedS: elapsed, distanceM: distanceMeters };
    const next = intervalSteps[stepIndex + 1];
    if (next) {
      setStepIndex(stepIndex + 1);
      ozzieSpeak(runCueForStep(next, paceBands), 'workout').catch(() => undefined);
    } else {
      setIntervalsDone(true);
      ozzieSpeak('Intervals complete. Great work — cruise it home easy.', 'workout').catch(
        () => undefined,
      );
    }
  }, [elapsed, distanceMeters, intervalSteps, stepIndex, intervalsDone, status, paceBands]);

  useEffect(() => {
    return () => {
      ozzieStop();
    };
  }, []);

  // Pull the latest Apple Watch heart-rate sample from HealthKit while running.
  // Requires the user to be recording on a paired Watch (or another HealthKit
  // source) in parallel — OSPREY has no direct Watch connection of its own.
  useEffect(() => {
    if (status !== 'active' || !isHealthKitSupported()) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    requestHealthKitAuthorization().then((authorized) => {
      if (!authorized || cancelled) return;
      const poll = () => {
        fetchLatestHeartRateBpm()
          .then((bpm) => {
            if (!cancelled && bpm != null) setHeartRate(bpm);
          })
          .catch(() => undefined);
      };
      poll();
      interval = setInterval(poll, 15000);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [status, setHeartRate]);

  function handleStartAfterWarmup() {
    setWarmingUp(false);
    startWorkout('run', params.sessionId ?? null);
    if (intervalSteps?.[0]) {
      stepStartRef.current = { elapsedS: 0, distanceM: 0 };
      ozzieSpeak(runCueForStep(intervalSteps[0], paceBands), 'workout').catch(() => undefined);
    }
  }

  function toggleDrill(index: number) {
    setCheckedDrills((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(getElapsedSeconds({ startedAt, pausedAt, accumulatedPauseMs, status }));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt, pausedAt, accumulatedPauseMs, status]);

  // Auto coaching cues (OSPREY+ only)
  useEffect(() => {
    if (!isPlus || status !== 'active' || speakingRef.current) return;

    const miles = metersToMiles(distanceMeters);
    const currentElapsed = getElapsedSeconds({ startedAt, pausedAt, accumulatedPauseMs, status });
    const cue = checkCues(
      coachingStateRef.current,
      miles,
      currentElapsed,
      heartRate,
      null,
      Date.now(),
    );

    if (cue) {
      coachingStateRef.current = cue.nextState;
      if (OZZIE_VOICE_ENABLED) {
        speakingRef.current = true;
        ozzieSpeak(cue.text, 'workout').finally(() => {
          speakingRef.current = false;
        });
      } else {
        showCueBanner(cue.text);
      }
    }
  }, [elapsed, isPlus, status, distanceMeters, heartRate, startedAt, pausedAt, accumulatedPauseMs]);

  const distanceKm = distanceMeters / 1000;
  const distanceLabel = formatDistanceKm(distanceKm, units);
  const pace = formatPacePerUnit(elapsed, distanceKm, units) ?? '--:--';
  const coordinates = trackPoints.map((p) => ({ latitude: p.lat, longitude: p.lon }));
  const region =
    coordinates.length > 0
      ? {
          latitude: coordinates[coordinates.length - 1].latitude,
          longitude: coordinates[coordinates.length - 1].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : {
          latitude: 41.8781,
          longitude: -87.6298,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };

  async function handleOzzieCue() {
    const cue = OUTSIDE_RUN_CUES[Math.floor(Math.random() * OUTSIDE_RUN_CUES.length)];
    await ozzieSpeak(cue, 'workout');
  }

  function handleExit() {
    reset();
    // dismissTo dismisses (correct "closing" animation) while walking the
    // stack until it finds this exact route, rather than a bare back(),
    // which has no fallback and proved unreliable elsewhere in this flow.
    router.dismissTo('/(tabs)/workout');
  }

  function handlePause() {
    Haptics.selectionAsync().catch(() => undefined);
    pauseWorkout();
  }

  function handleResume() {
    Haptics.selectionAsync().catch(() => undefined);
    resumeWorkout();
  }

  async function handleEndWorkout() {
    if (!userId || !startedAt) return;

    setSaving(true);
    try {
      const workoutId = await saveRunWorkout({
        userId,
        sessionId: params.sessionId ?? null,
        startedAt,
        durationS: elapsed,
        distanceMeters,
        trackPoints,
        heartRate,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reset();
      router.replace({ pathname: '/workout/recap', params: { workoutId } });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      setSaving(false);
    }
  }

  function confirmEnd() {
    Alert.alert('End workout?', 'Save this run and see your recap.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard & Exit',
        style: 'destructive',
        onPress: () => {
          reset();
          // dismissTo dismisses (correct "closing" animation) while walking
          // the stack until it finds this exact route, rather than back()'s
          // one-step pop, which can resolve unpredictably.
          router.dismissTo('/(tabs)/workout');
        },
      },
      { text: 'End & Save', onPress: handleEndWorkout },
    ]);
  }

  if (warmingUp) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.warmupWrap}>
          <View style={styles.warmupHeaderRow}>
            <Text style={styles.warmupTitle}>🔥 Warm Up First</Text>
            <TouchableOpacity
              onPress={handleExit}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Exit workout"
            >
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.warmupSubtitle}>
            A few minutes here cuts injury risk and makes the first mile feel better.
          </Text>
          {warmupDrills.map((drill, i) => (
            <TouchableOpacity
              key={drill.name}
              style={styles.warmupRow}
              onPress={() => toggleDrill(i)}
              accessibilityRole="checkbox"
              accessibilityLabel={`${drill.name}, ${drill.durationLabel}`}
              accessibilityState={{ checked: checkedDrills.has(i) }}
            >
              <View style={[styles.checkbox, checkedDrills.has(i) && styles.checkboxChecked]}>
                {checkedDrills.has(i) ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.warmupDrillName}>{drill.name}</Text>
                <Text style={styles.warmupDrillDuration}>{drill.durationLabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: undefined, marginTop: 8 }, !allDrillsChecked && styles.primaryBtnDisabled]}
            onPress={handleStartAfterWarmup}
            disabled={!allDrillsChecked}
            accessibilityRole="button"
            accessibilityLabel="Start run"
            accessibilityState={{ disabled: !allDrillsChecked }}
          >
            <Text style={styles.primaryBtnText}>Start Run →</Text>
          </TouchableOpacity>
          {!allDrillsChecked ? (
            <Text style={styles.warmupHint}>Check off each drill to start the run.</Text>
          ) : null}
          <TouchableOpacity
            onPress={handleStartAfterWarmup}
            accessibilityRole="button"
            accessibilityLabel="Skip warm-up"
          >
            <Text style={styles.skipWarmupText}>Skip warm-up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <RunMap region={region} coordinates={coordinates} />
        <View style={styles.mapOverlay}>
          <Text style={styles.sessionLabel}>RUN IN PROGRESS</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatBlock label="DISTANCE" value={distanceLabel} />
        <StatBlock label="PACE" value={pace} accent />
        <StatBlock label="TIME" value={formatDuration(elapsed)} />
        <StatBlock label="HR" value={heartRate ? `${heartRate}` : '--'} />
      </View>

      {intervalSteps ? (
        <IntervalGuidanceCard
          steps={intervalSteps}
          stepIndex={stepIndex}
          done={intervalsDone}
          bands={paceBands}
          elapsed={elapsed}
          distanceMeters={distanceMeters}
          stepStart={stepStartRef.current}
        />
      ) : null}

      {status === 'paused' ? (
        <View style={styles.pausedBanner}>
          <Text style={styles.pausedText}>Paused — Ozzie says take a breath, then resume when ready.</Text>
        </View>
      ) : null}

      {!OZZIE_VOICE_ENABLED && cueBannerText ? (
        <View style={styles.cueBanner}>
          <OzzieAvatar size={18} />
          <Text style={styles.cueBannerText}>{cueBannerText}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {OZZIE_VOICE_ENABLED ? (
          <TouchableOpacity
            style={styles.ozzieBtn}
            onPress={handleOzzieCue}
            accessibilityRole="button"
            accessibilityLabel="Get an Ozzie cue"
          >
            <OzzieAvatar size={18} />
            <Text style={styles.ozzieBtnText}>Ozzie Cue</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.controlRow}>
          {status === 'paused' ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleResume}
              accessibilityRole="button"
              accessibilityLabel="Resume run"
            >
              <Text style={styles.primaryBtnText}>▶ Resume</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handlePause}
              accessibilityRole="button"
              accessibilityLabel="Pause run"
            >
              <Text style={styles.secondaryBtnText}>⏸ Pause</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.endBtn}
            onPress={confirmEnd}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="End and save run"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.endBtnText}>End & Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function IntervalGuidanceCard({
  steps,
  stepIndex,
  done,
  bands,
  elapsed,
  distanceMeters,
  stepStart,
}: {
  steps: IntervalStep[];
  stepIndex: number;
  done: boolean;
  bands: PaceBands | null;
  elapsed: number;
  distanceMeters: number;
  stepStart: { elapsedS: number; distanceM: number };
}) {
  if (done) {
    return (
      <View style={styles.intervalCard}>
        <Text style={styles.intervalHeader}>OZZIE'S INTERVALS</Text>
        <Text style={styles.intervalLabel}>Intervals complete ✓ — cruise it home easy.</Text>
      </View>
    );
  }

  const step = steps[stepIndex];
  const progress = computeStepProgress(
    step,
    stepStart.elapsedS,
    stepStart.distanceM,
    elapsed,
    distanceMeters,
  );

  const remaining =
    progress.remainingS != null
      ? formatDuration(Math.ceil(progress.remainingS))
      : progress.remainingM != null
        ? `${Math.ceil(progress.remainingM)}m to go`
        : '';

  const band = step.phase === 'work' && bands ? bands[step.effort as keyof PaceBands] : null;
  const paceStatus =
    band && progress.stepPaceSecPerMile != null
      ? paceStatusForBand(progress.stepPaceSecPerMile, band)
      : null;
  const statusColor =
    paceStatus === 'in_band' ? Colors.green : paceStatus == null ? Colors.textMuted : Colors.amber;
  const statusText =
    paceStatus === 'in_band'
      ? 'On target'
      : paceStatus === 'too_fast'
        ? 'Ease up'
        : paceStatus === 'too_slow'
          ? 'Pick it up'
          : null;

  return (
    <View style={styles.intervalCard}>
      <Text style={styles.intervalHeader}>
        OZZIE'S INTERVALS · STEP {stepIndex + 1}/{steps.length}
      </Text>
      <View style={styles.intervalRow}>
        <Text style={[styles.intervalLabel, step.phase === 'rest' && { color: Colors.gold }]}>
          {step.phase === 'rest'
            ? 'Rest'
            : step.totalReps > 1
              ? `${step.label} · rep ${step.repIndex}/${step.totalReps}`
              : step.label}
        </Text>
        <Text style={styles.intervalRemaining}>{remaining}</Text>
      </View>
      {band ? (
        <View style={styles.intervalRow}>
          <Text style={styles.intervalTarget}>Target {formatPaceBand(band)}</Text>
          {progress.stepPaceSecPerMile != null ? (
            <Text style={[styles.intervalStatus, { color: statusColor }]}>
              {formatPaceSecPerMile(progress.stepPaceSecPerMile)} /mi{statusText ? ` · ${statusText}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function StatBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: Colors.teal }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  mapWrap: { flex: 1, minHeight: 280 },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(6,9,18,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
  },
  sessionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1.2,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', letterSpacing: 0.8 },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  pausedBanner: {
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceGold,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  pausedText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  cueBanner: {
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceTeal,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cueBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18 },
  intervalCard: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  intervalHeader: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1,
  },
  intervalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  intervalLabel: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, flexShrink: 1 },
  intervalRemaining: { fontSize: 15, fontWeight: '800', color: Colors.teal },
  intervalTarget: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  intervalStatus: { fontSize: 12, fontWeight: '700' },
  actions: { padding: 16, gap: 12 },
  ozzieBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ozzieBtnText: { fontSize: 14, fontWeight: '700', color: Colors.teal },
  controlRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  primaryBtnDisabled: { opacity: 0.45 },
  warmupHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: -4 },
  warmupWrap: { flex: 1, padding: 24, gap: 14 },
  warmupHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warmupTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  warmupSubtitle: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 6 },
  warmupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  checkboxMark: { color: '#000', fontSize: 14, fontWeight: '800' },
  warmupDrillName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  warmupDrillDuration: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  skipWarmupText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  endBtn: {
    flex: 1,
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
