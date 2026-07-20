import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme, Radius, BorderWidth, EffortPalette, StatusPalette } from '@/constants/theme';
import { Button } from '@/components/ui';
import OzzieAvatar from '@/components/OzzieAvatar';
import { useAuthStore } from '@/store/authStore';
import {
  computeElevationGainM,
  fetchIntervalPrescription,
  saveEnduranceWorkout,
  type EnduranceType,
} from '@/services/workouts';
import { expandIntervalSteps, ozzieCueForStep, totalIntervalDistanceM, type IntervalStep } from '@/services/intervals';
import { OZZIE_VOICE_ENABLED, ozzieSpeak, ozzieStop } from '@/services/ozzie-audio';
import { useCueBanner } from '@/hooks/useCueBanner';
import { ENCOURAGEMENTS } from '@/services/ozzie-cues';
import { formatDuration, isResumableWorkout, useWorkoutStore } from '@/store/workoutStore';
import { useRunTracking } from '@/hooks/useRunTracking';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { pickTrackingMode } from '@/utils/trackingModePicker';
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

// Scheme B (approved design change): sessions are de-colored — every type
// reads as neutral panel/line chrome, differentiated by label + icon only.
// Cross-training's old gold accent is intentionally gone.
const SESSION_META: Record<EnduranceType, { icon: string; label: string }> = {
  swim:   { icon: '🏊', label: 'SWIM' },
  bike:   { icon: '🚴', label: 'BIKE' },
  run:    { icon: '🏃', label: 'RUN' },
  rowing: { icon: '🚣', label: 'ROW' },
  cross:  { icon: '🔁', label: 'CROSS' },
};

interface CrossActivity {
  id: string;
  label: string;
  icon: string;
}

// Rowing moved out to its own EnduranceType/Workout-tab card — it has a
// full coaching blueprint + training-zone calculator, same tier as Swim/Bike.
const CROSS_ACTIVITIES: CrossActivity[] = [
  { id: 'crossfit',   label: 'CrossFit',           icon: '🏋️' },
  { id: 'yoga',       label: 'Yoga',                icon: '🧘' },
  { id: 'hiit',       label: 'HIIT',                icon: '🔥' },
  { id: 'mobility',   label: 'Mobility / Stretch',  icon: '🤸' },
  { id: 'elliptical', label: 'Elliptical',          icon: '🌀' },
  { id: 'stairs',     label: 'Stair Climber',       icon: '🪜' },
  { id: 'hiking',     label: 'Hiking',              icon: '🥾' },
  { id: 'other',      label: 'Other',               icon: '🔁' },
];

// The handful of Cross Training activities where distance is a real metric
// (most — CrossFit, yoga, HIIT, mobility — are tracked purely by time).
const DISTANCE_ACTIVITIES = new Set(['elliptical', 'hiking']);

// The athletic-convention ramp now lives in constants/theme.ts as
// EffortPalette, shared with plan-preview.tsx. It started here as local
// constants and drifted — plan-preview grew its own copy with `moderate` teal
// and `hard`/`max` both red. One source now.
const EFFORT_COLOR: Record<IntervalEffort | 'rest', string> = EffortPalette;

const AUTO_CUE_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function EnduranceWorkoutScreen() {
  const router = useRouter();
  const { sessionType, sessionId, mode } = useLocalSearchParams<{
    sessionType: EnduranceType;
    sessionId?: string;
    mode?: string;
  }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { isPlus } = useSubscription();
  const { units: unitPreference } = useUnitPreference();
  const { cueBannerText, showCueBanner } = useCueBanner();

  const type: EnduranceType = (sessionType ?? 'cross') as EnduranceType;
  const meta = SESSION_META[type] ?? SESSION_META.cross;
  // The only combinations that swap manual/synced distance for live GPS.
  const isOutsideBike = type === 'bike' && mode === 'outside';
  const [hikeMode, setHikeMode] = useState<'outside' | 'stationary' | null>(null);
  const isOutsideHike = type === 'cross' && hikeMode === 'outside';
  const isGpsTracking = isOutsideBike || isOutsideHike;

  const gpsDistanceMeters = useWorkoutStore((s) => s.distanceMeters);
  const gpsTrackPoints = useWorkoutStore((s) => s.trackPoints);
  const startGpsWorkout = useWorkoutStore((s) => s.startWorkout);
  const resetGpsWorkout = useWorkoutStore((s) => s.reset);
  const { permissionStatus: gpsPermission } = useRunTracking(isGpsTracking);

  useEffect(() => {
    // A bike workout already active/paused in the store means this is a
    // resume after an app kill, not a fresh start — calling startWorkout
    // again would reset the very distance/track points being resumed.
    if (isOutsideBike && !isResumableWorkout('bike')) {
      startGpsWorkout('bike', sessionId ?? null);
    }
    // Runs once on mount for an outside-bike session — startWorkout resets
    // the shared store, so re-running it on every render would wipe GPS
    // progress already collected. Outside Hike starts its own GPS tracking
    // from startCrossActivity() instead, once the mode picker resolves —
    // there's no activity picked yet at mount time to know it's a hike.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [wodScore, setWodScore] = useState('');
  const [floorsClimbed, setFloorsClimbed] = useState('');
  const lastAutoCueMs = useRef(0);
  const speakingRef = useRef(false);

  // Most Cross Training activities (CrossFit, yoga, HIIT, mobility) are
  // tracked purely by time — distance only applies to a handful where it's
  // a real metric.
  const showDistance =
    type !== 'cross' || (crossActivity != null && DISTANCE_ACTIVITIES.has(crossActivity.id));
  const badgeMeta = type === 'cross' && crossActivity
    ? { icon: crossActivity.icon, label: crossActivity.label.toUpperCase() }
    : meta;

  // Split per 500m is the metric rowers actually pace against — recomputed
  // from whatever distance is entered so far, not a true continuous live
  // feed (no erg/PM5 hardware integration), hence the on-screen caption.
  const rowingDistanceM =
    type === 'rowing' && distance ? parseFloat(distance) * METERS_PER_UNIT[distanceUnit] : 0;
  const splitPer500 =
    type === 'rowing' && rowingDistanceM > 0 && elapsed > 0 ? (elapsed / rowingDistanceM) * 500 : null;

  function startCrossActivity(activity: CrossActivity) {
    if (activity.id === 'hiking') {
      pickTrackingMode((selectedMode) => {
        setHikeMode(selectedMode);
        if (selectedMode === 'outside') startGpsWorkout('cross', sessionId ?? null);
        setCrossActivity(activity);
        startedAtRef.current = Date.now();
        setSessionStarted(true);
      });
      return;
    }
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
    if (!sessionId || (type !== 'swim' && type !== 'bike' && type !== 'run')) return;
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
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
      if (OZZIE_VOICE_ENABLED) {
        speakingRef.current = true;
        ozzieSpeak(cues[idx], 'workout').finally(() => { speakingRef.current = false; });
      } else {
        showCueBanner(cues[idx]);
      }
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
      const distanceParam = isGpsTracking
        ? gpsDistanceMeters > 0
          ? { value: metersToUnit(gpsDistanceMeters, distanceUnit), unit: distanceUnit }
          : null
        : showDistance && distance && parseFloat(distance) > 0
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
        wodScore: crossActivity?.id === 'crossfit' && wodScore.trim() ? wodScore.trim() : null,
        floorsClimbed: crossActivity?.id === 'stairs' && floorsClimbed ? parseInt(floorsClimbed, 10) : null,
        elevationGainM: isOutsideHike ? computeElevationGainM(gpsTrackPoints) : null,
        trackPoints: isGpsTracking ? gpsTrackPoints : [],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (isGpsTracking) resetGpsWorkout();
      router.replace({ pathname: '/workout/recap', params: { workoutId } });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (isGpsTracking) resetGpsWorkout();
    // dismissTo dismisses (correct "closing" animation) while walking
    // the stack until it finds this exact route, rather than back()'s
    // one-step pop, which can resolve unpredictably.
    router.dismissTo('/(tabs)/workout');
  }

  function confirmEnd() {
    // A near-zero GPS distance almost always means location never tracked
    // (denied permission, no fix yet) — surface that instead of silently
    // saving a 0.00 workout the athlete has no way to explain later.
    if (isGpsTracking && gpsDistanceMeters < 10) {
      Alert.alert(
        'No distance recorded',
        gpsPermission === 'denied'
          ? "Location was off during this session, so distance wasn't tracked. Save it anyway, or discard it?"
          : 'This session has almost no distance recorded. Save it anyway, or discard it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard & Exit', style: 'destructive', onPress: handleDiscard },
          { text: 'Save Anyway', onPress: handleEnd },
        ],
      );
      return;
    }

    Alert.alert('End session?', 'Save this workout and see your recap.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard & Exit', style: 'destructive', onPress: handleDiscard },
      { text: 'End & Save', onPress: handleEnd },
    ]);
  }

  if (type === 'cross' && !sessionStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.pickerCloseBtn}
          onPress={() => router.dismissTo('/(tabs)/workout')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Ionicons name="close" size={22} color={Theme.textMut} />
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
        <View style={[styles.sessionBadge, { borderColor: Theme.line }]}>
          <Text style={styles.sessionIcon}>{badgeMeta.icon}</Text>
          <Text style={[styles.sessionLabel, { color: Theme.accent }]}>
            {hasIntervals
              ? `${badgeMeta.label} · OZZIE'S SET`
              : `${badgeMeta.label}${isGpsTracking ? ' · GPS' : ''} IN PROGRESS`}
          </Text>
        </View>

        {isGpsTracking && gpsPermission === 'denied' ? (
          <TouchableOpacity
            style={styles.gpsDeniedBanner}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Location is off. Open Settings to enable it."
          >
            <Ionicons name="location-outline" size={16} color={Theme.text} />
            <Text style={styles.gpsDeniedText}>
              Location is off — OSPREY can&apos;t track distance. Tap to open Settings.
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.timerBlock}>
          <Text style={styles.timerValue}>{timeStr}</Text>
          <Text style={styles.timerSub}>elapsed</Text>
          {splitPer500 != null ? (
            <>
              <Text style={styles.splitValue}>{formatMMSS(Math.round(splitPer500))} /500m</Text>
              <Text style={styles.splitCaption}>split updates as you enter distance</Text>
            </>
          ) : null}
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

        {!OZZIE_VOICE_ENABLED && cueBannerText ? (
          <View style={styles.cueBanner}>
            <OzzieAvatar size={18} />
            <Text style={styles.cueBannerText}>{cueBannerText}</Text>
          </View>
        ) : null}

        {OZZIE_VOICE_ENABLED ? (
          <TouchableOpacity
            style={styles.ozzieBtn}
            onPress={handleManualCue}
            accessibilityRole="button"
            accessibilityLabel="Get an Ozzie cue"
          >
            <OzzieAvatar size={18} />
            <Text style={styles.ozzieBtnText}>Ozzie Cue</Text>
          </TouchableOpacity>
        ) : null}

        {showDistance ? (
          <View style={styles.distanceCard}>
            <Text style={styles.distanceLabel}>Distance ({distanceUnit})</Text>
            {isGpsTracking ? (
              <Text style={styles.distanceLiveValue}>
                {metersToUnit(gpsDistanceMeters, distanceUnit).toFixed(2)}
              </Text>
            ) : (
              <>
                <View style={styles.distanceInputRow}>
                  <TextInput
                    style={styles.distanceInput}
                    placeholder="0"
                    placeholderTextColor={Theme.textMut}
                    value={distance}
                    onChangeText={setDistance}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Distance in ${distanceUnit}`}
                  />
                </View>
                <Button
                  variant="secondary"
                  onPress={handleSyncHealthKit}
                  disabled={syncing}
                  busy={syncing}
                  accessibilityLabel="Sync distance from Apple Health"
                  style={[styles.syncBtn, syncing && { opacity: 0.6 }]}
                >
                  {syncing ? (
                    <ActivityIndicator color={Theme.accent} size="small" />
                  ) : (
                    <Text style={styles.syncBtnText}>Sync from Apple Health</Text>
                  )}
                </Button>
              </>
            )}
          </View>
        ) : null}

        {crossActivity?.id === 'crossfit' ? (
          <View style={styles.distanceCard}>
            <Text style={styles.distanceLabel}>WOD Score</Text>
            <TextInput
              style={styles.distanceInput}
              placeholder="18:32 or 5 rounds + 12 reps"
              placeholderTextColor={Theme.textMut}
              value={wodScore}
              onChangeText={setWodScore}
              accessibilityLabel="WOD score"
            />
          </View>
        ) : null}

        {crossActivity?.id === 'stairs' ? (
          <View style={styles.distanceCard}>
            <Text style={styles.distanceLabel}>Floors Climbed</Text>
            <TextInput
              style={styles.distanceInput}
              placeholder="0"
              placeholderTextColor={Theme.textMut}
              value={floorsClimbed}
              onChangeText={setFloorsClimbed}
              keyboardType="number-pad"
              accessibilityLabel="Floors climbed"
            />
          </View>
        ) : null}

        <Button
          onPress={confirmEnd}
          disabled={saving}
          busy={saving}
          accessibilityLabel="End and save session"
          style={{ paddingVertical: 16 }}
        >
          {saving ? (
            <ActivityIndicator color={Theme.ink} />
          ) : (
            <Text style={styles.endBtnText}>End & Save</Text>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  content: { flex: 1, padding: 28, justifyContent: 'center', gap: 20 },

  // Pre-start activity picker (cross-training only)
  pickerCloseBtn: { alignSelf: 'flex-end', padding: 16 },
  pickerContent: { flex: 1, padding: 28, paddingTop: 0, justifyContent: 'center', gap: 24 },
  pickerTitle: { fontSize: 26, fontWeight: '900', color: Theme.text, textAlign: 'center' },
  pickerSubtitle: { fontSize: 14, color: Theme.textMut, textAlign: 'center', marginTop: -12 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  activityTile: {
    width: '46%',
    aspectRatio: 1.3,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activityTileIcon: { fontSize: 30 },
  activityTileLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.textSoft,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  sessionBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionIcon: { fontSize: 20 },
  sessionLabel: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1.2,
  },
  timerBlock: { alignItems: 'center', gap: 6, marginVertical: 20 },
  timerValue: { fontSize: 72, fontWeight: '800', color: Theme.text, letterSpacing: -2 },
  timerSub: { fontSize: 12, color: Theme.textMut, fontWeight: '600', letterSpacing: 0.5 },
  splitValue: { fontSize: 20, fontWeight: '800', color: Theme.accent, marginTop: 8 },
  splitCaption: { fontSize: 10, color: Theme.textMut, fontStyle: 'italic' },

  // Interval runner
  intervalCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderRadius: Radius.card,
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
  intervalProgress: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 0.5,
  },
  effortPill: { borderRadius: Radius.card, paddingHorizontal: 8, paddingVertical: 3 },
  effortPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  intervalLabel: { fontSize: 22, fontWeight: '800', color: Theme.text },
  intervalRep: { fontSize: 12, color: Theme.textSoft, fontWeight: '600' },
  intervalCountdown: {
    fontSize: 40,
    fontWeight: '900',
    color: Theme.text,
    marginTop: 6,
    letterSpacing: -1,
  },
  intervalCompleteBtn: {
    marginTop: 8,
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  intervalCompleteBtnText: { fontSize: 14, fontWeight: '800', color: Theme.ink },
  // FUNCTIONAL: green = interval completed (HR-zone "easy" convention doing
  // double duty per the plan's Design Decisions — intentional, not a bug).
  intervalDoneIcon: { fontSize: 32, color: StatusPalette.success, fontWeight: '900' },
  intervalDoneText: { fontSize: 15, fontWeight: '700', color: Theme.text },

  ozzieBtn: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ozzieBtnText: { fontSize: 15, fontWeight: '700', color: Theme.accent },
  cueBanner: {
    backgroundColor: Theme.panel,
    borderRadius: Radius.card,
    padding: 12,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cueBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: Theme.text, lineHeight: 18 },
  gpsDeniedBanner: {
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderRadius: Radius.card,
    padding: 12,
    borderWidth: BorderWidth.card,
    borderColor: 'rgba(255,68,68,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsDeniedText: { flex: 1, fontSize: 12, fontWeight: '600', color: Theme.text, lineHeight: 17 },
  distanceCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  distanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 1,
  },
  distanceInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  distanceInput: {
    flex: 1,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  distanceLiveValue: {
    color: Theme.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  // Only what <Button variant="secondary"> doesn't already provide — its
  // default is a transparent fill with an accent border; this button keeps
  // its pre-existing panel fill / line border and 10px vertical padding.
  syncBtn: {
    backgroundColor: Theme.panel,
    borderColor: Theme.line,
    paddingVertical: 10,
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.accent,
  },
  endBtnText: { fontSize: 15, fontWeight: '800', color: Theme.ink },
});
