import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { fetchWorkoutRecap } from '@/services/workouts';
import { formatDuration } from '@/store/workoutStore';
import { ozzieSpeak } from '@/services/ozzie-audio';
import { shareWorkout } from '@/services/activity';

export default function WorkoutRecapScreen() {
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'shared'>('idle');

  const { data, isLoading, error } = useQuery({
    queryKey: ['workout-recap', workoutId, userId],
    queryFn: () => fetchWorkoutRecap(userId!, workoutId!),
    enabled: Boolean(userId && workoutId),
  });

  async function handleShare() {
    if (!userId || !workoutId || shareState !== 'idle') return;
    setShareState('sharing');
    try {
      await shareWorkout(userId, workoutId);
      setShareState('shared');
    } catch {
      setShareState('idle');
      Alert.alert('Could not share workout', 'Please try again.');
    }
  }

  useEffect(() => {
    if (data?.ozzieDebrief) {
      ozzieSpeak(data.ozzieDebrief, 'ambient');
    }
  }, [data?.ozzieDebrief]);

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
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sessionType = data.workout.sessionType;
  const isRun = sessionType === 'run';
  const isEndurance = sessionType === 'swim' || sessionType === 'bike' || sessionType === 'cross';
  const distanceMiles =
    data.workout.totalDistanceKm != null
      ? Math.round(data.workout.totalDistanceKm * 0.621371 * 10) / 10
      : null;

  const SESSION_LABELS: Record<string, { title: string; badgeStyle: object; stat: string }> = {
    run:   { title: 'Run Recap',  badgeStyle: styles.badgeRun,  stat: distanceMiles != null ? `${distanceMiles} mi` : '' },
    lift:  { title: 'Lift Recap', badgeStyle: styles.badgeLift, stat: '' },
    swim:  { title: 'Swim Recap', badgeStyle: styles.badgeBlue, stat: '' },
    bike:  { title: 'Bike Recap', badgeStyle: styles.badgeGreen, stat: '' },
    cross: { title: 'Cross Training Recap', badgeStyle: styles.badgeLift, stat: '' },
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

        {isRun ? (
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
        ) : isEndurance ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SESSION SUMMARY</Text>
            <View style={styles.enduranceRow}>
              <Text style={styles.enduranceStatLabel}>Duration</Text>
              <Text style={styles.enduranceStat}>{formatDuration(data.workout.totalDurationS)}</Text>
            </View>
            <View style={styles.enduranceRow}>
              <Text style={styles.enduranceStatLabel}>Session Type</Text>
              <Text style={styles.enduranceStat}>{sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}</Text>
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
                  {exercise.sets.length} sets · {exercise.volumeLbs.toLocaleString()} lbs volume
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.shareBtn, shareState === 'shared' && styles.shareBtnDone]}
          onPress={handleShare}
          disabled={shareState !== 'idle'}
          accessibilityRole="button"
          accessibilityLabel={shareState === 'shared' ? 'Shared with friends' : 'Share workout with friends'}
        >
          <Text style={styles.shareBtnText}>
            {shareState === 'shared' ? '✓ Shared with friends' : shareState === 'sharing' ? 'Sharing…' : 'Share with friends'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Done, return to home"
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
  badgeBlue: { color: '#3B82F6' },
  badgeGreen: { color: '#4ADE80' },
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
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, gap: 10 },
  shareBtn: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnDone: { borderColor: Colors.teal },
  shareBtnText: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
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
