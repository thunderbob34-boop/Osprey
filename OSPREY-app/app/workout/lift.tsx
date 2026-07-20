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
import * as Haptics from 'expo-haptics';
import { Theme, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import { Button, Card } from '@/components/ui';
import {
  useWorkoutStore,
  getElapsedSeconds,
  formatDuration,
  isResumableWorkout,
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
import { LIFT_TEMPLATES, getWorkedMuscleGroups, type LiftTemplate } from '@/services/lift-templates';
import MuscleDiagram from '@/components/MuscleDiagram';
import type { LiftExercise } from '@/types/workout';
import { friendlyError } from '@/utils/errorMessage';

export default function LiftWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; origin?: string }>();
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
  const skipRestTimer = useWorkoutStore((s) => s.skipRestTimer);
  const addRestSeconds = useWorkoutStore((s) => s.addRestSeconds);
  const reset = useWorkoutStore((s) => s.reset);

  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordingExercise, setRecordingExercise] = useState<number | null>(null);
  const [parsingVoice, setParsingVoice] = useState(false);
  // A lift session already active/paused in the store means this is a
  // resume after an app kill — skip the template preview and warm-up
  // screens straight to the live lift screen, and skip re-fetching a fresh
  // prescription below, so the resumed sets/completions aren't clobbered.
  // Captured once at mount (a ref, not a live value) — recomputing this from
  // the store on every render and feeding it into the fetch effect's deps
  // would re-fire that effect (and its `reset()` cleanup) the moment
  // startWorkout() flips status to 'active', wiping the workout mid-start.
  const resumingLiftRef = useRef(isResumableWorkout('lift'));
  const [previewing, setPreviewing] = useState(!resumingLiftRef.current);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const originalPrescriptionRef = useRef<LiftExercise[] | null>(null);
  const [warmingUp, setWarmingUp] = useState(!resumingLiftRef.current);
  const [warmupDrills] = useState<WarmupDrill[]>(() => generateWarmup('lift'));
  const [checkedDrills, setCheckedDrills] = useState<Set<number>>(new Set());
  const allDrillsChecked = warmupDrills.length > 0 && checkedDrills.size === warmupDrills.length;
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

  function handleExit() {
    reset();
    // dismissTo dismisses (correct "closing" animation) while walking the
    // stack until it finds this exact route, rather than a bare back(),
    // which has no fallback and proved unreliable elsewhere in this flow.
    router.dismissTo('/(tabs)/workout');
  }

  function handleSelectTemplate(template: LiftTemplate) {
    const matched = template.exerciseNames.flatMap((name) => {
      const match = library.find((e) => e.name.toLowerCase() === name.toLowerCase());
      return match ? [match] : [];
    });
    const next: LiftExercise[] = matched.map((exercise) => {
      const prev = lastSets[exercise.id];
      const reps = prev?.reps ?? 8;
      const weightLbs = prev?.weightLbs ?? 45;
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
    setLiftExercises(next);
    setSelectedTemplateId(template.id);
  }

  function handleSelectOzziePlan() {
    setLiftExercises(originalPrescriptionRef.current ?? []);
    setSelectedTemplateId(null);
  }

  function confirmExit() {
    Alert.alert('End workout?', 'Save your logged sets and see your recap, or discard this session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard & Exit', style: 'destructive', onPress: () => { reset(); router.dismissTo('/(tabs)/workout'); } },
      { text: 'Finish & Save', onPress: handleFinish },
    ]);
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
          const prescribedExercises: LiftExercise[] = plan.map((p) => {
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
          });
          originalPrescriptionRef.current = prescribedExercises;
          if (!resumingLiftRef.current) setLiftExercises(prescribedExercises);
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
        if (!resumingLiftRef.current) setLiftExercises(initial);
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
    const hasLoggedSets = exercise.sets.some((s) => s.completed);
    Alert.alert(
      `Remove ${exercise.name}?`,
      hasLoggedSets ? 'Logged sets for this exercise will be discarded.' : "This will remove it from today's plan.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setLiftExercises(liftExercises.filter((_, i) => i !== exerciseIndex)),
        },
      ],
    );
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'weightLbs',
    value: string,
  ) {
    updateSetFields(exerciseIndex, setIndex, { [field]: value });
  }

  // Applies one or more field updates to a single set in a single pass. A voice
  // log sets both weight and reps; chaining two updateSet() calls would each
  // rebuild from the same render-scoped `liftExercises` snapshot, so the second
  // clobbered the first (the weight update was silently lost).
  function updateSetFields(
    exerciseIndex: number,
    setIndex: number,
    fields: Partial<Record<'reps' | 'weightLbs', string>>,
  ) {
    const numericFields = Object.fromEntries(
      Object.entries(fields).map(([field, value]) => [
        field,
        Number((value ?? '').replace(/[^0-9.]/g, '')) || 0,
      ]),
    );
    const updated = liftExercises.map((exercise, ei) => {
      if (ei !== exerciseIndex) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map((set, si) =>
          si === setIndex ? { ...set, ...numericFields } : set,
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await ozzieSpeak(
        `New PR on ${exercise.name} — ${set.weightLbs} for ${set.reps}! Best set you've ever logged. That's the work.`,
        'workout',
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
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
      Alert.alert('Could not start recording', friendlyError(err, 'Try again.'));
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
      const fields: Partial<Record<'reps' | 'weightLbs', string>> = {};
      if (weightLbs != null) fields.weightLbs = String(weightLbs);
      if (reps != null) fields.reps = String(reps);
      updateSetFields(exerciseIndex, targetIndex, fields);
    } catch (err) {
      Alert.alert('Voice log failed', friendlyError(err, 'Try again.'));
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reset();
      router.replace({ pathname: '/workout/recap', params: { workoutId, origin: params.origin } });
    } catch (err) {
      Alert.alert('Save failed', friendlyError(err, 'Try again.'));
      setSaving(false);
    }
  }

  // Shared between the preview screen and the active workout screen — both
  // let the user add exercises from the full library via the same modal.
  const exercisePickerModal = (
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
            <Ionicons name="close" size={20} color={Theme.textMut} />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.pickerSearch}
          placeholder="Search exercises…"
          placeholderTextColor={Theme.textMut}
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
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (previewing) {
    const workedGroups = getWorkedMuscleGroups(liftExercises.map((e) => e.exerciseId), library);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewHeaderRow}>
          <View style={styles.previewTitleBlock}>
            <Text style={styles.previewEyebrow}>
              {isPrescribed && !selectedTemplateId ? "OZZIE'S PLAN" : 'PLAN YOUR LIFT'}
            </Text>
            <Text style={styles.previewTitle}>
              {isPrescribed && !selectedTemplateId ? "Today's Recommended Lift" : 'Choose a Focus'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleExit}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Exit workout"
          >
            <Ionicons name="close" size={24} color={Theme.textMut} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.previewScroll}>
          <View style={styles.templateChipRow}>
            {isPrescribed ? (
              <TouchableOpacity
                style={[styles.templateChip, !selectedTemplateId && styles.templateChipActive]}
                onPress={handleSelectOzziePlan}
                accessibilityRole="button"
                accessibilityLabel="Use Ozzie's plan"
              >
                <Text style={[styles.templateChipText, !selectedTemplateId && styles.templateChipTextActive]}>
                  Ozzie&apos;s Plan
                </Text>
              </TouchableOpacity>
            ) : null}
            {LIFT_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[styles.templateChip, selectedTemplateId === template.id && styles.templateChipActive]}
                onPress={() => handleSelectTemplate(template)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${template.label} template`}
              >
                <Text
                  style={[
                    styles.templateChipText,
                    selectedTemplateId === template.id && styles.templateChipTextActive,
                  ]}
                >
                  {template.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <MuscleDiagram workedGroups={workedGroups} />

          <Text style={styles.previewSectionLabel}>EXERCISES</Text>
          {liftExercises.length === 0 ? (
            <View style={styles.previewEmptyCard}>
              <Text style={styles.previewEmptyText}>
                No exercises yet — pick a template above or add your own below.
              </Text>
            </View>
          ) : (
            <View style={styles.previewExerciseList}>
              {liftExercises.map((exercise, index) => (
                <View
                  key={exercise.exerciseId}
                  style={[
                    styles.previewExerciseRow,
                    index === liftExercises.length - 1 && styles.previewExerciseRowLast,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewExerciseName}>{exercise.name}</Text>
                    <Text style={styles.previewExerciseMeta}>
                      {exercise.sets.length} × {exercise.sets[0]?.reps ?? 8}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveExercise(index)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${exercise.name}`}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

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
          <Button
            onPress={() => setPreviewing(false)}
            disabled={liftExercises.length === 0}
            accessibilityLabel="Continue to warm-up"
          >
            Continue to Warm-Up →
          </Button>
          {liftExercises.length === 0 ? (
            <Text style={styles.warmupHint}>Add at least one exercise to continue.</Text>
          ) : null}
        </View>

        {exercisePickerModal}
      </SafeAreaView>
    );
  }

  if (warmingUp) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.warmupWrap}>
          <View style={styles.warmupHeaderRow}>
            <View style={styles.warmupTitleRow}>
              <Ionicons name="flame" size={22} color={StatusPalette.warning} />
              <Text style={styles.warmupTitle}>Warm Up First</Text>
            </View>
            <TouchableOpacity
              onPress={handleExit}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Exit workout"
            >
              <Ionicons name="close" size={24} color={Theme.textMut} />
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
          <Button
            onPress={handleStartAfterWarmup}
            disabled={!allDrillsChecked}
            accessibilityLabel="Start lifting"
            style={{ marginTop: 8 }}
          >
            Start Lifting →
          </Button>
          {!allDrillsChecked ? (
            <Text style={styles.warmupHint}>Check off each drill to start lifting.</Text>
          ) : null}
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
            <Ionicons name="close" size={22} color={Theme.textMut} />
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
          <View style={styles.restRow}>
            <Text style={styles.restText}>Rest · {restSecondsLeft}s</Text>
            <View style={styles.restActions}>
              <TouchableOpacity
                onPress={() => addRestSeconds(15)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add 15 seconds to rest"
              >
                <Text style={styles.restActionText}>+15s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={skipRestTimer}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Skip rest"
              >
                <Text style={styles.restActionText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.restCaption}>Shake it out, stay loose — back at it soon.</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {liftExercises.map((exercise, exerciseIndex) => {
          const previous = lastSets[exercise.exerciseId];
          const cue = prescriptionCues[exercise.exerciseId];
          return (
            <Card key={exercise.exerciseId} style={styles.exerciseCard}>
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
                  {/*
                    SKIP: not converted to <Button> — this is an icon+text+spinner
                    button with a bespoke pill layout (minWidth 36, 16px radius) and
                    a non-accent active fill (StatusPalette.danger when recording), none of
                    which the primitive's style prop can express without fighting
                    its own defaults.
                  */}
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
                      <ActivityIndicator color={Theme.accent} size="small" />
                    ) : recordingExercise === exerciseIndex ? (
                      <Text style={styles.micBtnTextActive}>Stop</Text>
                    ) : (
                      <Ionicons name="mic-outline" size={16} color={Theme.accent} />
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
                  <Text style={styles.recordingHint}>Listening… say something like "185 for 10" — tap Stop when done</Text>
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
            </Card>
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
        <Button
          onPress={handleFinish}
          disabled={saving}
          busy={saving}
          accessibilityLabel="Finish workout"
          style={{ height: 52, justifyContent: 'center' }}
        >
          {saving ? (
            <ActivityIndicator color={Theme.ink} />
          ) : (
            <Text style={styles.finishBtnText}>Finish Workout →</Text>
          )}
        </Button>
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
                      plate >= 45 && styles.plateChipHighlight,
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

      {exercisePickerModal}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeBtn: {},
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
  },
  headerTime: { fontSize: 20, fontWeight: '800', color: Theme.text, marginTop: 2 },
  headerStats: { flexDirection: 'row', gap: 16 },
  headerStat: { alignItems: 'center' },
  headerStatValue: { fontSize: 16, fontWeight: '800', color: Theme.accent },
  headerStatLabel: { fontSize: 10, color: Theme.textMut, marginTop: 1 },
  restBanner: {
    backgroundColor: Theme.panel,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  restRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restText: { fontSize: 14, fontWeight: '700', color: Theme.accent },
  restActions: { flexDirection: 'row', gap: 16 },
  restActionText: { fontSize: 13, fontWeight: '700', color: Theme.accent },
  restCaption: { fontSize: 11, color: Theme.textMut, marginTop: 4, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 24 },
  exerciseCard: {},
  exerciseTitleBlock: { flex: 1, gap: 2 },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { fontSize: 16, fontWeight: '800', color: Theme.text, flexShrink: 1 },
  prBadge: {
    backgroundColor: Theme.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: { fontSize: 10, fontWeight: '800', color: Theme.ink, letterSpacing: 0.5 },
  exerciseCue: { fontSize: 12, fontWeight: '600', color: Theme.accent },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  exerciseActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  micBtn: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  micBtnActive: { backgroundColor: StatusPalette.danger, borderColor: StatusPalette.danger },
  micBtnText: { fontSize: 13, fontWeight: '700', color: Theme.accent },
  micBtnTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 14, color: Theme.textMut, fontWeight: '700' },
  recordingHint: { fontSize: 11, color: Theme.textMut, marginBottom: 8, fontStyle: 'italic' },

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
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
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
  setNumber: { fontSize: 13, color: Theme.accent, fontWeight: '800', textAlign: 'center' },
  setNumberBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    // NB: this is the plate-calculator button, applied to EVERY set row — not a
    // "current set" marker (the only per-row state cue is setRowDone's opacity).
    // The accent tint just keeps the chip distinct from the Theme.panel row
    // around it, exactly as the old rgba(0,200,200,0.08) teal did.
    backgroundColor: 'rgba(200,121,58,0.10)',
  },
  setPrevious: { fontSize: 12, color: Theme.textMut, textAlign: 'center', fontWeight: '600' },
  setInput: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: Theme.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  setInputDone: { borderColor: 'transparent', color: Theme.textMut },
  logBtn: {
    // Needs a visible body: the parent is a <Card> (also Theme.panel), so a bare
    // panel fill would leave the row's primary action as a floating ✓ glyph with
    // no tap affordance until it's completed (logBtnDone paints it green).
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingVertical: 8,
    alignItems: 'center',
  },
  logBtnDone: { backgroundColor: StatusPalette.success },
  logBtnText: { fontSize: 13, fontWeight: '800', color: Theme.text },
  addSetBtn: { marginTop: 4, alignSelf: 'flex-start' },
  addSetText: { fontSize: 12, color: Theme.accent, fontWeight: '700' },
  addExerciseBtn: {
    borderWidth: 1.5,
    borderColor: Theme.accent,
    borderStyle: 'dashed',
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExerciseText: { fontSize: 14, fontWeight: '800', color: Theme.accent },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Theme.line },
  finishBtnText: { fontSize: 15, fontWeight: '800', color: Theme.ink },

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
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  plateTitle: { fontSize: 15, fontWeight: '800', color: Theme.text, textAlign: 'center' },
  plateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  plateChip: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Theme.line,
    backgroundColor: Theme.panel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  // Highlights 45+ plates distinctly from the base chip — an accent tint
  // rather than Theme.panel, so the highlight isn't erased by the migration.
  plateChipHighlight: { backgroundColor: 'rgba(200,121,58,0.15)', borderColor: Theme.accent },
  plateChipText: { fontSize: 13, fontWeight: '800', color: Theme.text },
  plateBreakdown: { fontSize: 13, color: Theme.textSoft, textAlign: 'center', lineHeight: 19 },
  plateHint: { fontSize: 11, color: Theme.textMut },

  // Picker modal
  pickerContainer: { flex: 1, backgroundColor: Theme.ink },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 12,
  },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: Theme.text },
  pickerSearch: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Theme.text,
  },
  pickerList: { paddingHorizontal: 20, paddingBottom: 40 },
  pickerGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  pickerRowText: { fontSize: 14, fontWeight: '600', color: Theme.text },
  pickerRowAdd: { fontSize: 18, fontWeight: '800', color: Theme.accent },
  pickerEmpty: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 13,
    color: Theme.textMut,
    lineHeight: 19,
  },

  // Preview (template picker + muscle diagram, before warm-up)
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  previewTitleBlock: { gap: 2 },
  previewEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
  },
  previewTitle: { fontSize: 20, fontWeight: '800', color: Theme.text },
  previewScroll: { padding: 20, gap: 14, paddingBottom: 24 },
  templateChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateChip: {
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Theme.panel,
  },
  templateChipActive: { backgroundColor: Theme.panel, borderColor: Theme.accent },
  templateChipText: { fontSize: 13, fontWeight: '700', color: Theme.textSoft },
  templateChipTextActive: { color: Theme.accent },
  previewSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
    marginTop: 4,
  },
  previewEmptyCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
  },
  previewEmptyText: { fontSize: 13, color: Theme.textMut, lineHeight: 19 },
  previewExerciseList: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  previewExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  previewExerciseRowLast: { borderBottomWidth: 0 },
  previewExerciseName: { fontSize: 14, fontWeight: '700', color: Theme.text },
  previewExerciseMeta: { fontSize: 12, color: Theme.textMut, marginTop: 2 },

  // Warmup
  warmupWrap: { padding: 24, gap: 14, paddingBottom: 48 },
  warmupHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warmupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warmupTitle: { fontSize: 22, fontWeight: '800', color: Theme.text },
  warmupSubtitle: { fontSize: 13, color: Theme.textMut, lineHeight: 18, marginBottom: 6 },
  warmupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Theme.accent, borderColor: Theme.accent },
  checkboxMark: { color: Theme.ink, fontSize: 14, fontWeight: '800' },
  warmupDrillName: { fontSize: 14, fontWeight: '700', color: Theme.text },
  warmupDrillDuration: { fontSize: 12, color: Theme.textMut, marginTop: 2 },
  warmupHint: { fontSize: 12, color: Theme.textMut, textAlign: 'center', marginTop: -4 },
  skipWarmupText: {
    fontSize: 13,
    color: Theme.textMut,
    textAlign: 'center',
    fontWeight: '600',
  },
});
