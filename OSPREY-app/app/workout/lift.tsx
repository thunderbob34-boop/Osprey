import { useEffect, useMemo, useRef, useState } from 'react';
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
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import {
  useWorkoutStore,
  getElapsedSeconds,
  formatDuration,
} from '@/store/workoutStore';
import { useAuthStore } from '@/store/authStore';
import {
  fetchBestSetScores,
  fetchDefaultLiftExercises,
  fetchExerciseLibrary,
  fetchLastSetsForExercises,
  fetchLiftPrescription,
  saveLiftWorkout,
  type LibraryExercise,
} from '@/services/workouts';
import { computePlates, formatPlateBreakdown } from '@/services/plate-math';
import { ozzieSpeak } from '@/services/ozzie-audio';
import { startVoiceRecording, stopVoiceRecordingAndParse, cancelVoiceRecording } from '@/services/voice-log';
import { generateWarmup, type WarmupDrill } from '@/services/warmup';
import { useWatchSync } from '@/hooks/useWatchSync';
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
  const [saving, setSaving] = useState(false);
  const [recordingExercise, setRecordingExercise] = useState<number | null>(null);
  const [parsingVoice, setParsingVoice] = useState(false);
  const [warmingUp, setWarmingUp] = useState(true);
  const [warmupDrills] = useState<WarmupDrill[]>(() => generateWarmup('lift'));
  const [checkedDrills, setCheckedDrills] = useState<Set<number>>(new Set());
  const [lastSets, setLastSets] = useState<Record<string, { reps: number; weightLbs: number }>>({});
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  // Ozzie's prescribed workout for this plan session (exerciseId → coach cue).
  const [isPrescribed, setIsPrescribed] = useState(false);
  const [prescriptionCues, setPrescriptionCues] = useState<Record<string, string>>({});
  // Plate calculator (tap a set number) + live PR detection.
  const [plateModal, setPlateModal] = useState<{ exerciseName: string; weightLbs: number } | null>(null);
  const [prExercises, setPrExercises] = useState<Set<string>>(new Set());
  // Historical best set score (weightLbs × reps) per exercise — mutated as new
  // PRs land this session so only a *bigger* set re-triggers.
  const bestScoresRef = useRef<Record<string, number>>({});

  function handleStartAfterWarmup() {
    setWarmingUp(false);
    startWorkout('lift', params.sessionId ?? null);
  }

  function handleExitWarmup() {
    reset();
    router.back();
  }

  function confirmExit() {
    Alert.alert('End workout?', 'Save your logged sets and see your recap, or discard this session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard & Exit', style: 'destructive', onPress: () => { reset(); router.back(); } },
      { text: 'Finish & Save', onPress: handleFinish },
    ]);
  }

  // Keep a paired Apple Watch's on-wrist view in sync with this lift session,
  // and let "End Workout" on the wrist trigger the same confirm-and-save flow
  // as the in-app button. No heart rate / distance tracked for lifts.
  // Requires a native Watch bridge build + a paired Watch — see
  // src/services/watch-connectivity.ts (no-ops safely otherwise).
  useWatchSync(status === 'saving' ? 'active' : status, elapsed, null, null, confirmExit);

  function toggleDrill(index: number) {
    setCheckedDrills((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  useEffect(() => {
    Promise.all([
      fetchDefaultLiftExercises(),
      fetchExerciseLibrary().catch(() => [] as LibraryExercise[]),
      params.sessionId ? fetchLiftPrescription(params.sessionId).catch(() => null) : Promise.resolve(null),
    ])
      .then(async ([defaults, fullLibrary, prescription]) => {
        setLibrary(fullLibrary);

        // Ozzie's prescription: match each prescribed name to the library so
        // sets save against real exercise ids. Unmatched names are skipped.
        let plan: Array<{ exercise: { id: string; name: string }; sets: number; reps: number; cue: string }> = [];
        if (prescription) {
          plan = prescription.exercises.flatMap((p) => {
            const match = fullLibrary.find((e) => e.name.toLowerCase() === p.name.toLowerCase());
            if (!match) return [];
            const repsNum = parseInt(p.reps, 10) || 8;
            const cue = [`${p.sets}×${p.reps}`, p.note].filter(Boolean).join(' · ');
            return [{ exercise: match, sets: Math.max(1, Math.min(6, p.sets)), reps: repsNum, cue }];
          });
        }
        const usePrescription = plan.length > 0;
        setIsPrescribed(usePrescription);

        const baseExercises = usePrescription ? plan.map((p) => p.exercise) : defaults;
        const last: Record<string, { reps: number; weightLbs: number }> = userId
          ? await fetchLastSetsForExercises(userId, baseExercises.map((e) => e.id)).catch(() => ({}))
          : {};
        setLastSets(last);
        if (userId) {
          bestScoresRef.current = await fetchBestSetScores(
            userId,
            baseExercises.map((e) => e.id),
          ).catch(() => ({}));
        }

        if (usePrescription) {
          setPrescriptionCues(
            Object.fromEntries(plan.map((p) => [p.exercise.id, p.cue])),
          );
          setLiftExercises(
            plan.map((p) => {
              const prev = last[p.exercise.id];
              const weightLbs = prev?.weightLbs ?? 45;
              return {
                exerciseId: p.exercise.id,
                name: p.exercise.name,
                sets: Array.from({ length: p.sets }, (_, i) => ({
                  setNumber: i + 1,
                  reps: p.reps,
                  weightLbs,
                  completed: false,
                })),
              };
            }),
          );
          return;
        }

        const initial: LiftExercise[] = defaults.map((exercise) => {
          const prev = last[exercise.id];
          const reps = prev?.reps ?? 8;
          const weightLbs = prev?.weightLbs ?? 135;
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
      .finally(() => setLoading(false));

    return () => reset();
  }, [params.sessionId, startWorkout, setLiftExercises, reset, userId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(getElapsedSeconds({ startedAt, pausedAt, accumulatedPauseMs, status }));
      tickRestTimer();
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt, pausedAt, accumulatedPauseMs, status, tickRestTimer]);

  const completedSets = liftExercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completed).length,
    0,
  );
  const totalVolume = liftExercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completed).reduce((v, s) => v + s.reps * s.weightLbs, 0),
    0,
  );

  const groupedLibrary = useMemo(() => {
    const inSession = new Set(liftExercises.map((e) => e.exerciseId));
    const q = search.trim().toLowerCase();
    const filtered = library.filter(
      (e) => !inSession.has(e.id) && (!q || e.name.toLowerCase().includes(q)),
    );
    const groups: Array<{ muscleGroup: string; exercises: LibraryExercise[] }> = [];
    for (const exercise of filtered) {
      const group = groups.find((g) => g.muscleGroup === exercise.muscleGroup);
      if (group) group.exercises.push(exercise);
      else groups.push({ muscleGroup: exercise.muscleGroup, exercises: [exercise] });
    }
    return groups;
  }, [library, liftExercises, search]);

  function handleAddExercise(exercise: LibraryExercise) {
    if (userId && bestScoresRef.current[exercise.id] == null) {
      fetchBestSetScores(userId, [exercise.id])
        .then((scores) => Object.assign(bestScoresRef.current, scores))
        .catch(() => undefined);
    }
    const prev = lastSets[exercise.id];
    const reps = prev?.reps ?? 8;
    const weightLbs = prev?.weightLbs ?? 45;
    setLiftExercises([
      ...liftExercises,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        sets: [
          { setNumber: 1, reps, weightLbs, completed: false },
          { setNumber: 2, reps, weightLbs, completed: false },
          { setNumber: 3, reps, weightLbs, completed: false },
        ],
      },
    ]);
    setPickerVisible(false);
    setSearch('');
  }

  function handleRemoveExercise(exerciseIndex: number) {
    const exercise = liftExercises[exerciseIndex];
    Alert.alert(`Remove ${exercise.name}?`, 'Logged sets for this exercise will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setLiftExercises(liftExercises.filter((_, i) => i !== exerciseIndex)),
      },
    ]);
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'weightLbs',
    value: string,
  ) {
    const numeric = Number(value.replace(/[^0-9.]/g, '')) || 0;
    const updated = liftExercises.map((exercise, ei) => {
      if (ei !== exerciseIndex) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map((set, si) =>
          si === setIndex ? { ...set, [field]: numeric } : set,
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
    if (!set) return;

    // Live PR check — same weight×reps score the recap uses, so this
    // celebration always survives to the Finish screen. Only fires when
    // there's real history to beat.
    const score = set.weightLbs * set.reps;
    const previousBest = bestScoresRef.current[exercise.exerciseId];
    if (previousBest != null && previousBest > 0 && score > previousBest) {
      bestScoresRef.current[exercise.exerciseId] = score;
      setPrExercises((prev) => new Set(prev).add(exercise.exerciseId));
      await ozzieSpeak(
        `New PR on ${exercise.name} — ${set.weightLbs} for ${set.reps}! Best set you've ever logged. That's the work.`,
        'workout',
      );
      return;
    }

    await ozzieSpeak(
      `${exercise.name}, set ${set.setNumber}. ${set.reps} at ${set.weightLbs}. Let's go.`,
      'workout',
    );
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
      if (weightLbs != null) updateSet(exerciseIndex, targetIndex, 'weightLbs', String(weightLbs));
      if (reps != null) updateSet(exerciseIndex, targetIndex, 'reps', String(reps));
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (warmingUp) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.warmupWrap}>
          <View style={styles.warmupHeaderRow}>
            <View style={styles.warmupTitleRow}>
              <Ionicons name="flame" size={22} color={Colors.amber} />
              <Text style={styles.warmupTitle}>Warm Up First</Text>
            </View>
            <TouchableOpacity
              onPress={handleExitWarmup}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Exit workout"
            >
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.warmupSubtitle}>
            Prime the muscles you're about to load before jumping into working sets.
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
            style={styles.warmupStartBtn}
            onPress={handleStartAfterWarmup}
            accessibilityRole="button"
            accessibilityLabel="Start lifting"
          >
            <Text style={styles.finishBtnText}>Start Lifting →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleStartAfterWarmup}
            accessibilityRole="button"
            accessibilityLabel="Skip warm-up"
          >
            <Text style={styles.skipWarmupText}>Skip warm-up</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={confirmExit}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="End workout"
          >
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerLabel}>
              {isPrescribed ? "OZZIE'S PLAN · LIFT SESSION" : 'LIFT SESSION'}
            </Text>
            <Text style={styles.headerTime}>{formatDuration(elapsed)}</Text>
          </View>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{completedSets}</Text>
            <Text style={styles.headerStatLabel}>sets</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>
              {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
            </Text>
            <Text style={styles.headerStatLabel}>lbs volume</Text>
          </View>
        </View>
      </View>

      {restSecondsLeft != null ? (
        <View style={styles.restBanner}>
          <Text style={styles.restText}>Rest · {restSecondsLeft}s</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {liftExercises.map((exercise, exerciseIndex) => {
          const previous = lastSets[exercise.exerciseId];
          const cue = prescriptionCues[exercise.exerciseId];
          return (
            <View key={exercise.exerciseId} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseTitleBlock}>
                  <View style={styles.exerciseNameRow}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    {prExercises.has(exercise.exerciseId) ? (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>PR!</Text>
                      </View>
                    ) : null}
                  </View>
                  {cue ? <Text style={styles.exerciseCue}>{cue}</Text> : null}
                </View>
                <View style={styles.exerciseActions}>
                  <TouchableOpacity
                    style={[styles.micBtn, recordingExercise === exerciseIndex && styles.micBtnActive]}
                    onPress={() =>
                      recordingExercise === exerciseIndex
                        ? handleStopVoiceLog(exerciseIndex)
                        : handleStartVoiceLog(exerciseIndex)
                    }
                    disabled={parsingVoice || (recordingExercise != null && recordingExercise !== exerciseIndex)}
                    accessibilityRole="button"
                    accessibilityLabel={recordingExercise === exerciseIndex ? 'Stop voice logging' : `Log ${exercise.name} set by voice`}
                    accessibilityState={{
                      disabled: parsingVoice || (recordingExercise != null && recordingExercise !== exerciseIndex),
                      busy: parsingVoice && recordingExercise == null,
                    }}
                  >
                    {parsingVoice && recordingExercise == null ? (
                      <ActivityIndicator color={Colors.teal} size="small" />
                    ) : recordingExercise === exerciseIndex ? (
                      <Text style={styles.micBtnTextActive}>Stop</Text>
                    ) : (
                      <Ionicons name="mic-outline" size={16} color={Colors.teal} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveExercise(exerciseIndex)}
                    hitSlop={8}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${exercise.name}`}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {recordingExercise === exerciseIndex ? (
                <TouchableOpacity
                  onPress={handleCancelVoiceLog}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel voice recording"
                >
                  <Text style={styles.recordingHint}>Listening... say "weight for reps" — tap Stop when done</Text>
                </TouchableOpacity>
              ) : null}

              {/* Column headers — Hevy-style set table */}
              <View style={styles.setTableHeader}>
                <Text style={[styles.setColLabel, styles.colSet]}>SET</Text>
                <Text style={[styles.setColLabel, styles.colPrev]}>PREVIOUS</Text>
                <Text style={[styles.setColLabel, styles.colInput]}>LBS</Text>
                <Text style={[styles.setColLabel, styles.colInput]}>REPS</Text>
                <Text style={[styles.setColLabel, styles.colCheck]}>✓</Text>
              </View>

              {exercise.sets.map((set, setIndex) => (
                <View
                  key={set.setNumber}
                  style={[styles.setRow, set.completed && styles.setRowDone]}
                >
                  <TouchableOpacity
                    style={[styles.setNumberBtn, styles.colSet]}
                    onPress={() =>
                      setPlateModal({ exerciseName: exercise.name, weightLbs: set.weightLbs })
                    }
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Show plate breakdown for set ${set.setNumber}, ${set.weightLbs} pounds`}
                  >
                    <Text style={styles.setNumber}>{set.setNumber}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.setPrevious, styles.colPrev]}>
                    {previous ? `${previous.weightLbs} × ${previous.reps}` : '—'}
                  </Text>
                  <TextInput
                    style={[styles.setInput, styles.colInput, set.completed && styles.setInputDone]}
                    keyboardType="number-pad"
                    value={String(set.weightLbs)}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'weightLbs', v)}
                    editable={!set.completed}
                    accessibilityLabel={`Set ${set.setNumber} weight in pounds`}
                  />
                  <TextInput
                    style={[styles.setInput, styles.colInput, set.completed && styles.setInputDone]}
                    keyboardType="number-pad"
                    value={String(set.reps)}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'reps', v)}
                    editable={!set.completed}
                    accessibilityLabel={`Set ${set.setNumber} reps`}
                  />
                  <TouchableOpacity
                    style={[styles.logBtn, styles.colCheck, set.completed && styles.logBtnDone]}
                    onPress={() => completeSet(exerciseIndex, setIndex)}
                    disabled={set.completed}
                    accessibilityRole="button"
                    accessibilityLabel={`Complete set ${set.setNumber}`}
                    accessibilityState={{ disabled: set.completed, checked: set.completed }}
                  >
                    <Text style={styles.logBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addLiftSet(exerciseIndex)}
                accessibilityRole="button"
                accessibilityLabel={`Add set to ${exercise.name}`}
              >
                <Text style={styles.addSetText}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addExerciseBtn}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add exercise"
        >
          <Text style={styles.addExerciseText}>+ Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.finishBtn}
          onPress={handleFinish}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.finishBtnText}>Finish Workout →</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Plate calculator ── */}
      <Modal
        visible={plateModal != null}
        animationType="fade"
        transparent
        onRequestClose={() => setPlateModal(null)}
      >
        <TouchableOpacity
          style={styles.plateBackdrop}
          activeOpacity={1}
          onPress={() => setPlateModal(null)}
          accessibilityRole="button"
          accessibilityLabel="Close plate calculator"
        >
          {plateModal ? (
            <View style={styles.plateCard}>
              <Text style={styles.plateTitle}>
                {plateModal.exerciseName} · {plateModal.weightLbs} lbs
              </Text>
              <View style={styles.plateRow}>
                {computePlates(plateModal.weightLbs).perSide.map((plate, i) => (
                  <View
                    key={`${plate}-${i}`}
                    style={[
                      styles.plateChip,
                      plate >= 45 && { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
                    ]}
                  >
                    <Text style={styles.plateChipText}>{plate}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.plateBreakdown}>
                {formatPlateBreakdown(computePlates(plateModal.weightLbs))}
              </Text>
              <Text style={styles.plateHint}>Tap anywhere to close</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Modal>

      {/* ── Exercise picker ── */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add Exercise</Text>
            <TouchableOpacity
              onPress={() => setPickerVisible(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close exercise picker"
            >
              <Text style={styles.pickerClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.pickerSearch}
            placeholder="Search exercises…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            accessibilityLabel="Search exercises"
          />
          <ScrollView contentContainerStyle={styles.pickerList}>
            {groupedLibrary.length === 0 ? (
              <Text style={styles.pickerEmpty}>
                {library.length === 0
                  ? 'Exercise library unavailable — check your connection.'
                  : 'No exercises match your search.'}
              </Text>
            ) : (
              groupedLibrary.map((group) => (
                <View key={group.muscleGroup}>
                  <Text style={styles.pickerGroupLabel}>{group.muscleGroup.toUpperCase()}</Text>
                  {group.exercises.map((exercise) => (
                    <TouchableOpacity
                      key={exercise.id}
                      style={styles.pickerRow}
                      onPress={() => handleAddExercise(exercise)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${exercise.name}`}
                    >
                      <Text style={styles.pickerRowText}>{exercise.name}</Text>
                      <Text style={styles.pickerRowAdd}>+</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeBtn: {},
  headerLabel: { fontSize: 11, fontWeight: '700', color: Colors.gold, letterSpacing: 1 },
  headerTime: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  headerStats: { flexDirection: 'row', gap: 16 },
  headerStat: { alignItems: 'center' },
  headerStatValue: { fontSize: 16, fontWeight: '800', color: Colors.teal },
  headerStatLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  restBanner: {
    backgroundColor: Colors.surfaceTeal,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderTeal,
  },
  restText: { fontSize: 14, fontWeight: '700', color: Colors.teal },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 24 },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
  },
  exerciseTitleBlock: { flex: 1, gap: 2 },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, flexShrink: 1 },
  prBadge: {
    backgroundColor: Colors.gold,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: { fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  exerciseCue: { fontSize: 12, fontWeight: '600', color: Colors.gold },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  exerciseActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  micBtnTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 14, color: Colors.textMuted, fontWeight: '700' },
  recordingHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 8, fontStyle: 'italic' },

  // Set table
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  setColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  colSet: { width: 26 },
  colPrev: { flex: 1.2 },
  colInput: { flex: 1 },
  colCheck: { width: 40 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    borderRadius: 8,
  },
  setRowDone: { opacity: 0.6 },
  setNumber: { fontSize: 13, color: Colors.teal, fontWeight: '800', textAlign: 'center' },
  setNumberBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,200,200,0.08)',
  },
  setPrevious: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', fontWeight: '600' },
  setInput: {
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
  setInputDone: { borderColor: 'transparent', color: Colors.textMuted },
  logBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  logBtnDone: { backgroundColor: Colors.green },
  logBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  addSetBtn: { marginTop: 4, alignSelf: 'flex-start' },
  addSetText: { fontSize: 12, color: Colors.teal, fontWeight: '700' },
  addExerciseBtn: {
    borderWidth: 1.5,
    borderColor: Colors.borderTeal,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExerciseText: { fontSize: 14, fontWeight: '800', color: Colors.teal },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  finishBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },

  // Plate calculator modal
  plateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  plateCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  plateTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  plateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  plateChip: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  plateChipText: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  plateBreakdown: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  plateHint: { fontSize: 11, color: Colors.textMuted },

  // Picker modal
  pickerContainer: { flex: 1, backgroundColor: Colors.bg },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 12,
  },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  pickerClose: { fontSize: 18, color: Colors.textMuted, fontWeight: '700' },
  pickerSearch: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  pickerList: { paddingHorizontal: 20, paddingBottom: 40 },
  pickerGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  pickerRowText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  pickerRowAdd: { fontSize: 18, fontWeight: '800', color: Colors.teal },
  pickerEmpty: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },

  // Warmup
  warmupWrap: { padding: 24, gap: 14, paddingBottom: 48 },
  warmupHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warmupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
