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
import MapView, { Polyline } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useRunTracking } from '@/hooks/useRunTracking';
import {
  useWorkoutStore,
  getElapsedSeconds,
  formatDuration,
  formatPace,
  metersToMiles,
} from '@/store/workoutStore';
import { useAuthStore } from '@/store/authStore';
import { saveRunWorkout } from '@/services/workouts';
import { ozzieSpeak, ozzieStop } from '@/services/ozzie-audio';
import { generateWarmup, type WarmupDrill } from '@/services/warmup';
import {
  checkCues,
  makeCoachingState,
  type CoachingState,
} from '@/services/coaching-engine';
import { useSubscription } from '@/hooks/useSubscription';
import AskOzzieButton from '@/components/AskOzzieButton';

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
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const reset = useWorkoutStore((s) => s.reset);

  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [warmingUp, setWarmingUp] = useState(true);
  const [warmupDrills] = useState<WarmupDrill[]>(() => generateWarmup('run'));
  const [checkedDrills, setCheckedDrills] = useState<Set<number>>(new Set());
  const coachingStateRef = useRef<CoachingState>(makeCoachingState());
  const speakingRef = useRef(false);
  const { isPlus } = useSubscription();

  useRunTracking(status === 'active');

  useEffect(() => {
    return () => {
      ozzieStop();
    };
  }, []);

  function handleStartAfterWarmup() {
    setWarmingUp(false);
    startWorkout('run', params.sessionId ?? null);
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
      speakingRef.current = true;
      ozzieSpeak(cue.text, 'workout').finally(() => {
        speakingRef.current = false;
      });
    }
  }, [elapsed, isPlus, status, distanceMeters, heartRate, startedAt, pausedAt, accumulatedPauseMs]);

  const miles = metersToMiles(distanceMeters);
  const pace = miles > 0 ? formatPace(elapsed / miles) : '--:--';
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
    const cues = [
      'Nice work. Hold that pace.',
      'Looking strong. Stay relaxed through the shoulders.',
      'One mile at a time — you’ve got this.',
    ];
    const cue = cues[Math.floor(Math.random() * cues.length)];
    await ozzieSpeak(cue, 'workout');
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
      { text: 'Discard & Exit', style: 'destructive', onPress: () => { reset(); router.replace('/(tabs)'); } },
      { text: 'End & Save', onPress: handleEndWorkout },
    ]);
  }

  if (warmingUp) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.warmupWrap}>
          <Text style={styles.warmupTitle}>🔥 Warm Up First</Text>
          <Text style={styles.warmupSubtitle}>
            A few minutes here cuts injury risk and makes the first mile feel better.
          </Text>
          {warmupDrills.map((drill, i) => (
            <TouchableOpacity
              key={drill.name}
              style={styles.warmupRow}
              onPress={() => toggleDrill(i)}
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
            style={[styles.primaryBtn, { flex: undefined, marginTop: 8 }]}
            onPress={handleStartAfterWarmup}
          >
            <Text style={styles.primaryBtnText}>Start Run →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleStartAfterWarmup}>
            <Text style={styles.skipWarmupText}>Skip warm-up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView style={styles.map} region={region} showsUserLocation>
          {coordinates.length > 1 ? (
            <Polyline coordinates={coordinates} strokeColor={Colors.teal} strokeWidth={4} />
          ) : null}
        </MapView>
        <View style={styles.mapOverlay}>
          <Text style={styles.sessionLabel}>RUN IN PROGRESS</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatBlock label="DISTANCE" value={`${miles.toFixed(2)} mi`} />
        <StatBlock label="PACE" value={pace} accent />
        <StatBlock label="TIME" value={formatDuration(elapsed)} />
        <StatBlock label="HR" value={heartRate ? `${heartRate}` : '--'} />
      </View>

      {status === 'paused' ? (
        <View style={styles.pausedBanner}>
          <Text style={styles.pausedText}>Paused — Ozzie says take a breath, then resume when ready.</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.ozzieRow}>
          <TouchableOpacity style={[styles.ozzieBtn, { flex: 1 }]} onPress={handleOzzieCue}>
            <Text style={styles.ozzieBtnText}>🦅 Ozzie Cue</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AskOzzieButton
              getContext={() => ({
                sessionType: 'run',
                elapsedS: elapsed,
                distanceKm: distanceMeters / 1000,
                paceMinPerMi: miles > 0 ? elapsed / 60 / miles : null,
                avgHeartRate: heartRate,
              })}
            />
          </View>
        </View>

        <View style={styles.controlRow}>
          {status === 'paused' ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={resumeWorkout}>
              <Text style={styles.primaryBtnText}>▶ Resume</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondaryBtn} onPress={pauseWorkout}>
              <Text style={styles.secondaryBtnText}>⏸ Pause</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.endBtn} onPress={confirmEnd} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Colors.red} />
            ) : (
              <Text style={styles.endBtnText}>End & Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
  map: { flex: 1 },
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
  actions: { padding: 16, gap: 12 },
  ozzieRow: { flexDirection: 'row', gap: 10 },
  ozzieBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
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
  warmupWrap: { flex: 1, padding: 24, gap: 14 },
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
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endBtnText: { fontSize: 14, fontWeight: '700', color: Colors.red },
});
