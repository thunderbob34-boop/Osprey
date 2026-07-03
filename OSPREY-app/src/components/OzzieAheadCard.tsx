import { useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import {
  computeAnticipations,
  fetchCompletedToday,
  type Anticipation,
  type AnticipationInputs,
} from '@/services/anticipation';
import { recalibrateWeek } from '@/services/plan';
import { ozzieSpeak } from '@/services/ozzie-audio';
import type { SessionData } from '@/types/daily-summary';

interface Props {
  recovery?: { score: number; recommendation: 'train' | 'easy' | 'rest' };
  session?: SessionData;
  fuel?: { lastLoggedMinutesAgo: number | null; recommendation: 'fuel_now' | 'good_timing' | 'recently_fueled' };
  tsb?: number | null;
  weekMiles?: number;
  weekTarget?: number | null;
  onStartSession?: (session: SessionData) => void;
}

/**
 * "Ozzie's already on it" — the proactive card that leads Home. It reads the
 * signals the app already has and states the one thing that matters right now
 * with the action pre-loaded. No questions, no forms.
 */
export default function OzzieAheadCard({
  recovery,
  session,
  fuel,
  tsb,
  weekMiles = 0,
  weekTarget,
  onStartSession,
}: Props) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const completed = useQuery({
    queryKey: ['completed-today', userId],
    queryFn: () => fetchCompletedToday(userId!),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
  });

  const recalibrate = useMutation({
    mutationFn: recalibrateWeek,
    onSuccess: (res) => {
      if (res.recalibrated) {
        if (res.summary) ozzieSpeak(res.summary, 'ambient');
        queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
        queryClient.invalidateQueries({ queryKey: ['calendar-month'] });
        Alert.alert('Done', res.summary ?? 'I retuned the rest of your week around your recovery.');
      } else {
        Alert.alert('Nothing to change', 'Your week already fits where you are right now.');
      }
    },
    onError: (err) => Alert.alert('Could not adjust', err instanceof Error ? err.message : 'Try again.'),
  });

  const inputs: AnticipationInputs = useMemo(
    () => ({
      recovery: recovery ?? null,
      sessionType: session?.sessionType ?? null,
      sessionLabel: session?.type,
      sessionDuration: session?.duration,
      hasSession: Boolean(session?.sessionId),
      completedToday: completed.data ?? false,
      fuel: fuel ?? null,
      tsb: tsb ?? null,
      weekMiles,
      weekTarget: weekTarget ?? null,
    }),
    [recovery, session, completed.data, fuel, tsb, weekMiles, weekTarget],
  );

  const anticipations = useMemo(() => computeAnticipations(inputs), [inputs]);
  const top = anticipations[0];
  // A second, clearly different suggestion shown as a slim follow-on line.
  const secondary = anticipations.find((a) => a.id !== top?.id && a.action !== top?.action && a.priority >= 40);

  if (completed.isLoading || !top) return null;

  function runAction(item: Anticipation) {
    switch (item.action) {
      case 'start_session':
        if (session) onStartSession?.(session);
        break;
      case 'recalibrate':
        recalibrate.mutate();
        break;
      case 'log_fuel':
        router.push('/(tabs)/log');
        break;
      case 'meal_plan':
        router.push('/meal-prep');
        break;
      case 'view_week':
        router.push('/plan-preview');
        break;
      default:
        break;
    }
  }

  const toneStyle =
    top.tone === 'urgent'
      ? { border: Colors.amber, surface: 'rgba(245,166,35,0.10)', accent: Colors.amber }
      : top.tone === 'positive'
        ? { border: Colors.borderTeal, surface: Colors.surfaceTeal, accent: Colors.teal }
        : { border: Colors.border, surface: Colors.bgCard, accent: Colors.teal };

  const busy = recalibrate.isPending;

  return (
    <View style={[styles.card, { borderColor: toneStyle.border, backgroundColor: toneStyle.surface }]}>
      <View style={styles.headRow}>
        <Text style={styles.icon}>{top.icon}</Text>
        <Text style={[styles.eyebrow, { color: toneStyle.accent }]}>OZZIE&apos;S ALREADY ON IT</Text>
      </View>
      <Text style={styles.headline}>{top.headline}</Text>
      <Text style={styles.detail}>{top.detail}</Text>

      {top.actionLabel && top.action !== 'none' ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: toneStyle.accent }]}
          onPress={() => runAction(top)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={top.actionLabel}
        >
          {busy && top.action === 'recalibrate' ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.actionBtnText}>{top.actionLabel} →</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {secondary ? (
        <TouchableOpacity
          style={styles.secondaryRow}
          onPress={() => runAction(secondary)}
          accessibilityRole="button"
          accessibilityLabel={secondary.actionLabel ?? secondary.headline}
        >
          <Text style={styles.secondaryText}>
            {secondary.icon} {secondary.headline} {secondary.actionLabel ? `· ${secondary.actionLabel}` : ''}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  icon: { fontSize: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  headline: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 5, lineHeight: 23 },
  detail: { fontSize: 13.5, color: Colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  actionBtn: {
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  secondaryRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  secondaryText: { fontSize: 12.5, color: Colors.textMuted, fontWeight: '600', lineHeight: 18 },
});
