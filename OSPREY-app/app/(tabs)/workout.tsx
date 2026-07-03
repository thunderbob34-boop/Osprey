import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  View,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { usePlanAdaptation } from '@/hooks/usePlanAdaptation';
import { recalibrateWeek, type RecalibrateResult } from '@/services/plan';
import { ozzieSpeak } from '@/services/ozzie-audio';

type Card = {
  emoji: string;
  title: string;
  desc: string;
  route: string;
  params?: Record<string, string>;
  surface: string;
  border: string;
};

const CARDS: Card[] = [
  {
    emoji: '🏃',
    title: 'Run',
    desc: 'GPS map, live pace, Ozzie mid-run cues',
    route: '/workout/run',
    surface: Colors.surfaceTeal,
    border: Colors.borderTeal,
  },
  {
    emoji: '🏋️',
    title: 'Lift',
    desc: 'Log sets, rest timer, Ozzie encouragement',
    route: '/workout/lift',
    surface: Colors.surfaceGold,
    border: Colors.borderGold,
  },
  {
    emoji: '🏊',
    title: 'Swim',
    desc: 'Timer-based session with Ozzie pool cues',
    route: '/workout/endurance',
    params: { sessionType: 'swim' },
    surface: Colors.surfaceBlue,
    border: Colors.borderBlue,
  },
  {
    emoji: '🚴',
    title: 'Bike',
    desc: 'Track your ride duration, Ozzie keeps cadence',
    route: '/workout/endurance',
    params: { sessionType: 'bike' },
    surface: Colors.surfaceGreen,
    border: Colors.borderGreen,
  },
  {
    emoji: '🔁',
    title: 'Cross Training',
    desc: 'Yoga, rowing, or any active recovery session',
    route: '/workout/endurance',
    params: { sessionType: 'cross' },
    surface: Colors.bgCard,
    border: Colors.border,
  },
];

export default function WorkoutTab() {
  const router = useRouter();
  const alert = usePlanAdaptation();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [result, setResult] = useState<RecalibrateResult | null>(null);

  const recalibrate = useMutation({
    mutationFn: recalibrateWeek,
    onSuccess: (res) => {
      if (!res.recalibrated) {
        Alert.alert(
          'Nothing to recalibrate',
          res.reason === 'week_complete'
            ? "This week's remaining sessions are already done — next week's plan will pick up the new load picture."
            : 'No active plan for this week yet — build one from the Home tab first.',
        );
        return;
      }
      setResult(res);
      setDismissed(true);
      if (res.summary) ozzieSpeak(res.summary, 'ambient');
      // Every surface that shows planned sessions needs the fresh week.
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-month'] });
    },
    onError: (err) => {
      Alert.alert('Recalibration failed', err instanceof Error ? err.message : 'Try again.');
    },
  });

  const bannerBg =
    alert?.severity === 'warning'
      ? 'rgba(245,176,65,0.15)'
      : alert?.severity === 'positive'
        ? 'rgba(0,210,190,0.12)'
        : 'rgba(0,180,170,0.08)';

  const bannerBorder =
    alert?.severity === 'warning'
      ? Colors.amber
      : Colors.teal;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Start a Workout</Text>
        <Text style={styles.subtitle}>
          GPS run, set-by-set lift, or timer-based endurance — everything saves to your training load.
        </Text>

        {alert && !dismissed && (
          <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: bannerBorder }]}>
            <Text style={styles.bannerMessage}>{alert.message}</Text>
            <View style={styles.bannerActions}>
              <TouchableOpacity
                onPress={() => recalibrate.mutate()}
                style={styles.bannerButton}
                disabled={recalibrate.isPending}
                accessibilityRole="button"
                accessibilityLabel="Recalibrate the rest of this week's plan"
              >
                {recalibrate.isPending ? (
                  <View style={styles.bannerLoadingRow}>
                    <ActivityIndicator size="small" color={Colors.teal} />
                    <Text style={[styles.bannerButtonText, { color: Colors.teal }]}>Recalibrating…</Text>
                  </View>
                ) : (
                  <Text style={[styles.bannerButtonText, { color: Colors.teal }]}>Recalibrate →</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDismissed(true)}
                style={styles.bannerDismiss}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Text style={styles.bannerDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {result?.recalibrated ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultLabel}>WEEK RECALIBRATED</Text>
              <TouchableOpacity
                onPress={() => setResult(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Dismiss recalibration summary"
              >
                <Text style={styles.bannerDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
            {result.summary ? <Text style={styles.resultSummary}>&ldquo;{result.summary}&rdquo;</Text> : null}
            {(result.changes ?? [])
              .filter((c) => c.changed)
              .map((c) => (
                <View key={c.date} style={styles.diffRow}>
                  <Text style={styles.diffDate}>{c.date.slice(5)}</Text>
                  <Text style={styles.diffBefore} numberOfLines={1}>
                    {c.before.description ?? c.before.intensity}
                  </Text>
                  <Text style={styles.diffArrow}>→</Text>
                  <Text style={styles.diffAfter} numberOfLines={1}>
                    {c.after.description}
                  </Text>
                </View>
              ))}
            {result.changedCount === 0 ? (
              <Text style={styles.resultSummary}>
                Ozzie looked at the numbers and kept the week as planned.
              </Text>
            ) : null}
          </View>
        ) : null}

        {CARDS.map((card) => (
          <TouchableOpacity
            key={card.title}
            style={[styles.card, { backgroundColor: card.surface, borderColor: card.border }]}
            onPress={() =>
              router.push(card.params ? { pathname: card.route as any, params: card.params } : card.route as any)
            }
          >
            <Text style={styles.cardEmoji}>{card.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.desc}</Text>
            </View>
            <Text style={styles.cardArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  cardEmoji: { fontSize: 28 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  cardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  cardArrow: { fontSize: 20, color: Colors.teal, fontWeight: '700' },
  banner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  bannerMessage: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19, marginBottom: 10 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerButton: {},
  bannerLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerButtonText: { fontSize: 13, fontWeight: '700' },
  bannerDismiss: { padding: 4 },
  bannerDismissText: { fontSize: 13, color: Colors.textMuted },
  resultCard: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  resultLabel: { fontSize: 10, fontWeight: '700', color: Colors.teal, letterSpacing: 1 },
  resultSummary: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 19, marginBottom: 8 },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  diffDate: { fontSize: 11.5, fontWeight: '700', color: Colors.textMuted, width: 42 },
  diffBefore: { flex: 1, fontSize: 12.5, color: Colors.textMuted, textDecorationLine: 'line-through' },
  diffArrow: { fontSize: 12, color: Colors.teal, fontWeight: '700' },
  diffAfter: { flex: 1, fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
});
