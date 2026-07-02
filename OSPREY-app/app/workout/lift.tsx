import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import {
  useWorkoutStore,
  getElapsedSeconds,
  formatDuration,
} from '@/store/workoutStore';
import { useAuthStore } from '@/store/authStore';
import { fetchDefaultLiftExercises, fetchLastSetsForExercises, saveLiftWorkout } from '@/services/workouts';
import { ozzieSpeak } from '@/services/ozzie-audio';
import { startVoiceRecording, stopVoiceRecordingAndParse, cancelVoiceRecording } from '@/services/voice-log';
import { generateWarmup, type WarmupDrill } from '@/services/warmup';
import type { LiftExercise } from '@/types/workout';

export default function LiftWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const userId = useAuthStore((s) => s.user?.id);

  const status = useWorkoutStore((s) => s.status);
  const startedAt = useWorkoutStore((s) => s.startedAt);
  const pausedAt = useWorkoutStore((s) => s.pausedAt);
  const accumulatedPauseMs = useWorkoutStore((s) => s.accumulatedPauseMs);
  const liftExercises = useWorkoutStore((s) => s.liftExercises);
  const restSecondsLeft = useWorkoutStore((s) => s.restSecondsLeft);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const setLiftExercises = useWorkoutStore((s) => s.setLiftExercises);
  const logLiftSet = useWorkoutStore((s) => s.logLiftSet);
  const addLiftSet = useWorkoutStore((s) => s.addLiftSet);
  const startRestTimer = useWorkoutStore((s) => s.startRestTimer);
  const tickRestTimer = useWorkoutStore((s) => s.tickRestTimer);
  const reset = useWorkoutStore((s) => s.reset);

  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordingExercise, setRecordingExercise] = useState<number | null>(null);
  const [parsingVoice, setParsingVoice] = useState(false);
  const [warmingUp, setWarmingUp] = useState(true);
  const [warmupDrills] = useState<WarmupDrill[]>(() => generateWarmup('lift'));
  const [checkedDrills, setCheckedDrills] = useState<Set<number>>(new Set());

  function handleStartAfterWarmup() {
    setWarmingUp(false);
    startWorkout('lift', params.sessionId ?? null);
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
    fetchDefaultLiftExercises()
      .then(async (exercises) => {
        const lastSets: Record<string, { reps: number; weightLbs: number }> = userId
          ? await fetchLastSetsForExercises(userId, exercises.map((e) => e.id)).catch(() => ({}))
          : {};

        const initial: LiftExercise[] = exercises.map((exercise) => {
          const last = lastSets[exercise.id];
          const reps = last?.reps ?? 8;
          const weightLbs = last?.weightLbs ?? 135;
          return {
            exerciseId: exercise.id,
            name: exercise.name,
            sets: [
              { setNumber: 1, reps, weightLbs, completed: false },
              { setNumber: 2, reps, weightLbs, completed: false },
              { setNumber: 3, reps, weightLbs, completed: false },
            ],
          };
        });
        setLiftExercises(initial);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));

    return () => reset();
  }, [params.sessionId, startWorkout, setLiftExercises, reset]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(getElapsedSeconds({ startedAt, pausedAt, accumulatedPauseMs, status }));
      tickRestTimer();
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt, pausedAt, accumulatedPauseMs, status, tickRestTimer]);

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'weightLbs',
    value: string,
  ) {
    updateSetFields(exerciseIndex, setIndex, { [field]: Number(value.replace(/[^0-9.]/g, '')) || 0 });
  }

  function updateSetFields(
    exerciseIndex: number,
    setIndex: number,
    fields: Partial<{ reps: number; weightLbs: number }>,
  ) {
    const updated = liftExercises.map((exercise, ei) => {
      if (ei !== exerciseIndex) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map((set, si) =>
          si === setIndex ? { ...set, ...fields } : set,
        ),
      };
    });
    setLiftExercises(updated);
  }

  async function completeSet(exerciseIndex: number, setIndex: number) {
    logLiftSet(exerciseIndex, setIndex);
    startRestTimer(90);
    const exercise = liftExercises[exerciseIndex];
    const set = exercise?.sets[setIndex];
    if (set) {
      await ozzieSpeak(
        `${exercise.name}, set ${set.setNumber}. ${set.reps} at ${set.weightLbs}. Let's go.`,
        'workout',
      );
    }
  }

  async function handleStartVoiceLog(exerciseIndex: number) {
    if (recordingExercise != null) return;
    try {
      const started = await startVoiceRecording();
      if (!started) {
        Alert.alert('Microphone access needed', 'OSPREY needs mic access to log sets by voice.');
        return;
      }
      setRecordingExercise(exerciseIndex);
    } catch (err) {
      Alert.alert('Could not start recording', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleStopVoiceLog(exerciseIndex: number) {
    if (recordingExercise !== exerciseIndex) return;
    setRecordingExercise(null);
    setParsingVoice(true);
    try {
      const { weightLbs, reps, transcript } = await stopVoiceRecordingAndParse();
      if (weightLbs == null && reps == null) {
        Alert.alert("Didn't catch that", `Heard: "${transcript}". Try saying something like "185 for 10".`);
        return;
      }
      const exercise = liftExercises[exerciseIndex];
      const nextSetIndex = exercise.sets.findIndex((s) => !s.completed);
      const targetIndex = nextSetIndex === -1 ? exercise.sets.length - 1 : nextSetIndex;
      const fields: Partial<{ reps: number; weightLbs: number }> = {};
      if (weightLbs != null) fields.weightLbs = weightLbs;
      if (reps != null) fields.reps = reps;
      updateSetFields(exerciseIndex, targetIndex, fields);
    } catch (err) {
      Alert.alert('Voice log failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setParsingVoice(false);
    }
  }

  function handleCancelVoiceLog() {
    cancelVoiceRecording();
    setRecordingExercise(null);
  }

  async function handleFinish() {
    if (!userId || !startedAt) return;
    setSaving(true);
    try {
      const workoutId = await saveLiftWorkout({
        userId,
        sessionId: params.sessionId ?? null,
        startedAt,
        durationS: elapsed,
        exercises: liftExercises,
      });
      reset();
      router.replace({ pathname: '/workout/recap', params: { workoutId } });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      setSaving(false);
    }
  }

  function handleExit() {
    if (status === 'idle') {
      router.back();
      return;
    }
    Alert.alert('Discard workout?', 'Your progress on this session will be lost.', [
      { text: 'Keep Lifting', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          reset();
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Couldn&apos;t load your exercises. Check your connection and try again.</Text>
          <TouchableOpacity style={styles.warmupStartBtn} onPress={() => router.back()}>
            <Text style={styles.finishBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (warmingUp) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.warmupCloseRow}>
          <TouchableOpacity
            onPress={handleExit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close, exit without starting a workout"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.warmupWrap}>
          <Text style={styles.warmupTitle}>🔥 Warm Up First</Text>
          <Text style={styles.warmupSubtitle}>
            Prime the muscles you're about to load before jumping into working sets.
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
          <TouchableOpacity style={styles.warmupStartBtn} onPress={handleStartAfterWarmup}>
            <Text style={styles.finishBtnText}>Start Lifting →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleStartAfterWarmup}>
            <Text style={styles.skipWarmupText}>Skip warm-up</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleExit}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Discard workout and exit"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>LIFT SESSION</Text>
        <Text style={styles.headerTime}>{formatDuration(elapsed)}</Text>
      </View>

      {restSecondsLeft != null ? (
        <View style={styles.restBanner}>
          <Text style={styles.restText}>Rest · {restSecondsLeft}s</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {liftExercises.map((exercise, exerciseIndex) => (
          <View key={exercise.exerciseId} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <TouchableOpacity
                style={[styles.micBtn, recordingExercise === exerciseIndex && styles.micBtnActive]}
                onPress={() =>
                  recordingExercise === exerciseIndex
                    ? handleStopVoiceLog(exerciseIndex)
                    : handleStartVoiceLog(exerciseIndex)
                }
                disabled={parsingVoice || (recordingExercise != null && recordingExercise !== exerciseIndex)}
              >
                {parsingVoice && recordingExercise == null ? (
                  <ActivityIndicator color={Colors.teal} size="small" />
                ) : (
                  <Text style={styles.micBtnText}>
                    {recordingExercise === exerciseIndex ? '⏹ Stop' : '🎤'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {recordingExercise === exerciseIndex ? (
              <TouchableOpacity onPress={handleCancelVoiceLog}>
                <Text style={styles.recordingHint}>Listening... say "weight for reps" — tap Stop when done</Text>
              </TouchableOpacity>
            ) : null}
            {exercise.sets.map((set, setIndex) => (
              <View key={set.setNumber} style={styles.setRow}>
                <Text style={styles.setNumber}>{set.setNumber}</Text>
                <TextInput
                  style={styles.setInput}
                  keyboardType="number-pad"
                  value={String(set.weightLbs)}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'weightLbs', v)}
                />
                <Text style={styles.setUnit}>lbs</Text>
                <TextInput
                  style={styles.setInput}
                  keyboardType="number-pad"
                  value={String(set.reps)}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'reps', v)}
                />
                <Text style={styles.setUnit}>reps</Text>
                <TouchableOpacity
                  style={[styles.logBtn, set.completed && styles.logBtnDone]}
                  onPress={() => completeSet(exerciseIndex, setIndex)}
                  disabled={set.completed}
                >
                  <Text style={styles.logBtnText}>{set.completed ? '✓' : 'Log'}</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addSetBtn} onPress={() => addLiftSet(exerciseIndex)}>
              <Text style={styles.addSetText}>+ Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.finishBtnText}>Finish Workout →</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: Colors.gold, letterSpacing: 1 },
  headerTime: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  warmupCloseRow: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'flex-end' },
  closeBtnText: { fontSize: 20, color: Colors.textMuted, fontWeight: '700' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  restBanner: {
    backgroundColor: Colors.surfaceTeal,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderTeal,
  },
  restText: { fontSize: 14, fontWeight: '700', color: Colors.teal },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
  },
  exerciseName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  micBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  micBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  micBtnText: { fontSize: 13, fontWeight: '700', color: Colors.teal },
  recordingHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 8, fontStyle: 'italic' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  setNumber: { width: 18, fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  setInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  setUnit: { fontSize: 11, color: Colors.textMuted, width: 28 },
  logBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logBtnDone: { backgroundColor: Colors.green },
  logBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  addSetBtn: { marginTop: 4, alignSelf: 'flex-start' },
  addSetText: { fontSize: 12, color: Colors.teal, fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  finishBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  warmupWrap: { padding: 24, gap: 14, paddingBottom: 48 },
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
  warmupStartBtn: {
    marginTop: 8,
    backgroundColor: Colors.teal,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipWarmupText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
  },
});
