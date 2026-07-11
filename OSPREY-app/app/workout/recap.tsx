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
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load workout recap.</Text>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={exitToWorkoutTab}
            accessibilityRole="button"
            accessibilityLabel="Back to workout"
          >
            <Text style={styles.homeBtnText}>Back to Workout</Text>
          </TouchableOpacity>
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

  const SESSION_LABELS: Record<string, { title: string; badgeStyle: object; stat: string }> = {
    run:    { title: 'Run Recap',    badgeStyle: styles.badgeRun,   stat: distanceMiles != null ? `${distanceMiles} mi` : '' },
    lift:   { title: 'Lift Recap',   badgeStyle: styles.badgeLift,  stat: '' },
    swim:   { title: 'Swim Recap',   badgeStyle: styles.badgeBlue,  stat: '' },
    bike:   { title: 'Bike Recap',   badgeStyle: styles.badgeGreen, stat: '' },
    rowing: { title: 'Rowing Recap', badgeStyle: styles.badgeBlue,  stat: distanceMiles != null ? `${distanceMiles} mi` : '' },
    hyrox:  { title: 'Hyrox Recap',  badgeStyle: styles.badgeHyrox, stat: '' },
    cross:  { title: 'Cross Training Recap', badgeStyle: styles.badgeLift, stat: '' },
  };
  const label = SESSION_LABELS[sessionType] ?? SESSION_LABELS.lift;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {data.hasPr ? (
          <View style={styles.prBanner}>
            <Text style={styles.prEmoji}>🏆</Text>
            <Text style={styles.prTitle}>New PR!</Text>
            <Text style={styles.prSub}>Ozzie flagged a personal record in this session.</Text>
          </View>
        ) : null}

        <Text style={[styles.badge, label.badgeStyle]}>
          WORKOUT COMPLETE
        </Text>
        <Text style={styles.title}>{label.title}</Text>
        <Text style={styles.meta}>
          {formatDuration(data.workout.totalDurationS)}
          {label.stat ? ` · ${label.stat}` : ''}
        </Text>

        <View style={styles.ozzieCard}>
          <Text style={styles.ozzieLabel}>Ozzie&apos;s debrief</Text>
          <Text style={styles.ozzieText}>&ldquo;{data.ozzieDebrief}&rdquo;</Text>
        </View>

        {isHyrox ? (
          <View style={styles.card}>
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
          </View>
        ) : showSplits ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>MILE SPLITS</Text>
            {data.splits.map((split) => (
              <View key={split.mile} style={styles.splitRow}>
                <Text style={styles.splitMile}>Mile {split.mile}</Text>
                <Text style={styles.splitPace}>{split.pace}</Text>
                <Text style={styles.splitTime}>{formatDuration(split.durationS)}</Text>
              </View>
            ))}
          </View>
        ) : showSessionSummary ? (
          <View style={styles.card}>
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
          </View>
        ) : (
          <View style={styles.card}>
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
          </View>
        )}

        <View style={styles.shareCard}>
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
                placeholderTextColor={Colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                accessibilityLabel="Share caption, optional"
              />
              {shareError ? <Text style={styles.shareErrorText}>{shareError}</Text> : null}
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShare}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel="Share to activity feed"
                accessibilityState={{ disabled: sharing, busy: sharing }}
              >
                {sharing ? (
                  <ActivityIndicator color={Colors.teal} size="small" />
                ) : (
                  <Text style={styles.shareBtnText}>Share to Activity Feed</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={exitToWorkoutTab}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.homeBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 32 },
  prBanner: {
    backgroundColor: Colors.surfaceGold,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  prEmoji: { fontSize: 36, marginBottom: 6 },
  prTitle: { fontSize: 24, fontWeight: '900', color: Colors.gold },
  prSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  badgeRun: { color: Colors.teal },
  badgeLift: { color: Colors.gold },
  badgeBlue: { color: Colors.blue },
  badgeGreen: { color: Colors.green },
  badgeHyrox: { color: Colors.red },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, marginBottom: 4 },
  meta: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },
  ozzieCard: {
    backgroundColor: Colors.surfaceGold,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  ozzieLabel: { fontSize: 11, fontWeight: '700', color: Colors.gold, marginBottom: 6 },
  ozzieText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, fontStyle: 'italic' },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 12 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  splitMile: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  splitPace: { width: 60, fontSize: 14, color: Colors.teal, fontWeight: '800', textAlign: 'center' },
  splitTime: { width: 60, fontSize: 13, color: Colors.textMuted, textAlign: 'right' },
  exerciseBlock: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  prTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.gold,
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exerciseMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  enduranceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  enduranceStatLabel: { fontSize: 14, color: Colors.textSecondary },
  enduranceStat: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  shareCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    gap: 10,
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  shareErrorText: { fontSize: 12, color: Colors.red },
  shareBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: Colors.teal },
  sharedRow: { alignItems: 'center', paddingVertical: 4 },
  sharedText: { fontSize: 13, fontWeight: '700', color: Colors.green },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  homeBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  errorText: { color: Colors.textMuted, marginBottom: 16 },
});
