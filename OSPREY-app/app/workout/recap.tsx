import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Card, Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { fetchWorkoutRecap } from '@/services/workouts';
import { formatDuration } from '@/store/workoutStore';
import { ozzieSpeak } from '@/services/ozzie-audio';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatWeightKg } from '@/services/units';
import { lbToKg } from '@/services/body-metrics';
import { HYROX_STATIONS } from '@/types/hyrox';
import { shareWorkout } from '@/services/activity';

export default function WorkoutRecapScreen() {
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { units } = useUnitPreference();

  const { data, isLoading, error } = useQuery({
    queryKey: ['workout-recap', workoutId, userId, units],
    queryFn: () => fetchWorkoutRecap(userId!, workoutId!, units),
    enabled: Boolean(userId && workoutId),
  });

  const [caption, setCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function handleShare() {
    if (!userId || !workoutId) return;
    setSharing(true);
    setShareError(null);
    try {
      await shareWorkout(userId, workoutId, caption.trim() || null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setShared(true);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share. Try again.');
    } finally {
      setSharing(false);
    }
  }

  useEffect(() => {
    if (data?.ozzieDebrief) {
      ozzieSpeak(data.ozzieDebrief, 'ambient');
    }
  }, [data?.ozzieDebrief]);

  // dismissTo dismisses (the correct "closing" animation, not a forward
  // transition) while walking the stack until it finds this exact route —
  // more reliable than back(), which just pops one step.
  function exitToWorkoutTab() {
    router.dismissTo('/(tabs)/workout');
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load workout recap.</Text>
          <Button variant="primary" onPress={exitToWorkoutTab} accessibilityLabel="Back to workout">
            Back to Workout
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const sessionType = data.workout.sessionType;
  const isRun = sessionType === 'run';
  const isHyrox = sessionType === 'hyrox' && data.workout.hyroxSplits != null;
  const isEndurance =
    sessionType === 'swim' || sessionType === 'bike' || sessionType === 'cross' || sessionType === 'rowing';
  // A stationary (treadmill) run is sessionType 'run' but has no GPS track
  // points, so there's nothing to build mile splits from — show the same
  // duration/type summary card the other non-GPS session types get instead
  // of an empty "MILE SPLITS" list.
  const showSplits = isRun && data.splits.length > 0;
  const showSessionSummary = isEndurance || (isRun && !showSplits);
  const distanceMiles =
    data.workout.totalDistanceKm != null
      ? Math.round(data.workout.totalDistanceKm * 0.621371 * 10) / 10
      : null;

  const SESSION_LABELS: Record<string, { title: string; stat: string }> = {
    run:    { title: 'Run Recap',    stat: distanceMiles != null ? `${distanceMiles} mi` : '' },
    lift:   { title: 'Lift Recap',   stat: '' },
    swim:   { title: 'Swim Recap',   stat: '' },
    bike:   { title: 'Bike Recap',   stat: '' },
    rowing: { title: 'Rowing Recap', stat: distanceMiles != null ? `${distanceMiles} mi` : '' },
    hyrox:  { title: 'Hyrox Recap',  stat: '' },
    cross:  { title: 'Cross Training Recap', stat: '' },
  };
  const label = SESSION_LABELS[sessionType] ?? SESSION_LABELS.lift;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {data.hasPr ? (
          <Card emphasis style={styles.prBanner}>
            <Text style={styles.prEmoji}>🏆</Text>
            <Text style={styles.prTitle}>New PR!</Text>
            <Text style={styles.prSub}>Ozzie flagged a personal record in this session.</Text>
          </Card>
        ) : null}

        <Text style={styles.badge}>
          WORKOUT COMPLETE
        </Text>
        <Text style={styles.title}>{label.title}</Text>
        <Text style={styles.meta}>
          {formatDuration(data.workout.totalDurationS)}
          {label.stat ? ` · ${label.stat}` : ''}
        </Text>

        <Card emphasis style={styles.ozzieCard}>
          <Text style={styles.ozzieLabel}>Ozzie&apos;s debrief</Text>
          <Text style={styles.ozzieText}>&ldquo;{data.ozzieDebrief}&rdquo;</Text>
        </Card>

        {isHyrox ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>STATION SPLITS</Text>
            {HYROX_STATIONS.map((station, i) => {
              const run = data.workout.hyroxSplits!.runs.find((r) => r.index === i + 1);
              const stationSplit = data.workout.hyroxSplits!.stations.find((s) => s.index === i + 1);
              return (
                <View key={station.id}>
                  <View style={styles.splitRow}>
                    <Text style={styles.splitMile}>Run {i + 1}</Text>
                    <Text style={styles.splitTime}>{run ? formatDuration(run.durationS) : '--'}</Text>
                  </View>
                  <View style={styles.splitRow}>
                    <Text style={styles.splitMile}>{station.label}</Text>
                    <Text style={styles.splitTime}>{stationSplit ? formatDuration(stationSplit.durationS) : '--'}</Text>
                  </View>
                </View>
              );
            })}
            <View style={[styles.enduranceRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.enduranceStatLabel}>Total roxzone (transitions)</Text>
              <Text style={styles.enduranceStat}>
                {formatDuration(data.workout.hyroxSplits!.roxzoneS.reduce((sum, r) => sum + r.durationS, 0))}
              </Text>
            </View>
          </Card>
        ) : showSplits ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>MILE SPLITS</Text>
            {data.splits.map((split) => (
              <View key={split.mile} style={styles.splitRow}>
                <Text style={styles.splitMile}>Mile {split.mile}</Text>
                <Text style={styles.splitPace}>{split.pace}</Text>
                <Text style={styles.splitTime}>{formatDuration(split.durationS)}</Text>
              </View>
            ))}
          </Card>
        ) : showSessionSummary ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>SESSION SUMMARY</Text>
            <View style={styles.enduranceRow}>
              <Text style={styles.enduranceStatLabel}>Duration</Text>
              <Text style={styles.enduranceStat}>{formatDuration(data.workout.totalDurationS)}</Text>
            </View>
            <View style={styles.enduranceRow}>
              <Text style={styles.enduranceStatLabel}>Session Type</Text>
              <Text style={styles.enduranceStat}>
                {data.workout.notes || sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>EXERCISES</Text>
            {data.exercises.map((exercise) => (
              <View key={exercise.name} style={styles.exerciseBlock}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {exercise.isPr ? <Text style={styles.prTag}>PR</Text> : null}
                </View>
                <Text style={styles.exerciseMeta}>
                  {exercise.sets.length} sets · {formatWeightKg(lbToKg(exercise.volumeLbs), units)} volume
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.shareCard}>
          {shared ? (
            <View style={styles.sharedRow}>
              <Text style={styles.sharedText}>✓ Shared to your activity feed</Text>
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>SHARE THIS WORKOUT</Text>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption (optional)"
                placeholderTextColor={Theme.textMut}
                value={caption}
                onChangeText={setCaption}
                accessibilityLabel="Share caption, optional"
              />
              {shareError ? <Text style={styles.shareErrorText}>{shareError}</Text> : null}
              <TouchableOpacity
                style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
                onPress={handleShare}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel="Share to activity feed"
                accessibilityState={{ disabled: sharing, busy: sharing }}
              >
                {sharing ? (
                  <ActivityIndicator color={Theme.ink} size="small" />
                ) : (
                  <Text style={styles.shareBtnText}>Share to Activity Feed</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="primary" onPress={exitToWorkoutTab} accessibilityLabel="Done">
          Done
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 32 },
  prBanner: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  prEmoji: { fontSize: 36, marginBottom: 6 },
  prTitle: { fontSize: 24, fontWeight: '900', color: Theme.accent },
  prSub: { fontSize: 13, color: Theme.textSoft, textAlign: 'center', marginTop: 4 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    color: Theme.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  title: { fontSize: 28, fontWeight: '900', color: Theme.text, marginBottom: 4 },
  meta: { fontSize: 14, color: Theme.textMut, marginBottom: 20 },
  ozzieCard: {
    padding: 16,
    marginBottom: 16,
  },
  ozzieLabel: { fontSize: 11, fontWeight: '700', color: Theme.accent, marginBottom: 6, fontFamily: 'SpaceGrotesk_700Bold' },
  ozzieText: { fontSize: 14, color: Theme.textSoft, lineHeight: 21, fontStyle: 'italic' },
  card: {
    padding: 16,
  },
  cardTitle: { fontSize: 10, fontWeight: '700', color: Theme.textMut, letterSpacing: 1, marginBottom: 12, fontFamily: 'SpaceGrotesk_700Bold' },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  splitMile: { flex: 1, fontSize: 14, color: Theme.text, fontWeight: '600' },
  splitPace: { width: 60, fontSize: 14, color: Theme.accent, fontWeight: '800', textAlign: 'center' },
  splitTime: { width: 60, fontSize: 13, color: Theme.textMut, textAlign: 'right' },
  exerciseBlock: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Theme.line },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { fontSize: 15, fontWeight: '700', color: Theme.text },
  prTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.accent,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.card,
  },
  exerciseMeta: { fontSize: 12, color: Theme.textMut, marginTop: 4 },
  enduranceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  enduranceStatLabel: { fontSize: 14, color: Theme.textSoft },
  enduranceStat: { fontSize: 14, fontWeight: '700', color: Theme.text },
  shareCard: {
    padding: 16,
    marginTop: 16,
    gap: 10,
  },
  captionInput: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.text,
    fontSize: 14,
  },
  shareErrorText: { fontSize: 12, color: Colors.red },
  shareBtn: {
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnDisabled: { opacity: 0.5 },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: Theme.ink },
  sharedRow: { alignItems: 'center', paddingVertical: 4 },
  sharedText: { fontSize: 13, fontWeight: '700', color: Colors.green },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Theme.line },
  errorText: { color: Theme.textMut, marginBottom: 16 },
});
