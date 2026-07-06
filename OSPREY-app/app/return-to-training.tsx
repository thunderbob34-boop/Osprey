import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import {
  dismissRampBanner,
  generateRampPlan,
  type GapReason,
} from '@/services/return-to-training';
import { useTrainingGap } from '@/hooks/useTrainingGap';
import { useAuthStore } from '@/store/authStore';

const REASONS: Array<{ value: GapReason; icon: string; label: string }> = [
  { value: 'illness', icon: '🤒', label: 'Illness' },
  { value: 'injury', icon: '🩹', label: 'Injury' },
  { value: 'travel', icon: '✈️', label: 'Travel' },
  { value: 'life', icon: '🌀', label: 'Life happened' },
];

export default function ReturnToTrainingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gapDays?: string; lastWorkoutAt?: string }>();
  const gapDays = Math.max(14, Number(params.gapDays) || 14);
  const userId = useAuthStore((s) => s.user?.id);
  const { invalidate } = useTrainingGap();

  const [reason, setReason] = useState<GapReason | null>(null);
  const [painFlag, setPainFlag] = useState(false);
  const [building, setBuilding] = useState(false);

  const weeks = Math.floor(gapDays / 7);
  const gapLabel = weeks >= 2 ? `about ${weeks} weeks` : `${gapDays} days`;

  async function handleBuild() {
    if (!reason) {
      Alert.alert('One thing first', 'Pick what kept you away so Ozzie can pace the ramp right.');
      return;
    }
    setBuilding(true);
    try {
      const { sessions } = await generateRampPlan({ gapDays, reason, painFlag });
      // The ramp plan IS the response to this gap — don't keep prompting.
      if (userId && params.lastWorkoutAt) {
        await dismissRampBanner(userId, params.lastWorkoutAt);
      }
      invalidate();
      router.replace({
        pathname: '/plan-preview',
        params: { sessions: JSON.stringify(sessions) },
      });
    } catch (err) {
      Alert.alert(
        'Could not build the ramp',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setBuilding(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Welcome back 👋</Text>
        <Text style={styles.subtitle}>
          You've been away {gapLabel}. That's completely fine — fitness comes back faster than it
          was built. Ozzie will restart you at reduced volume and rebuild from there instead of
          throwing you back into your old week.
        </Text>

        <Text style={styles.sectionLabel}>WHAT KEPT YOU AWAY?</Text>
        <View style={styles.reasonGrid}>
          {REASONS.map((r) => {
            const selected = reason === r.value;
            return (
              <TouchableOpacity
                key={r.value}
                style={[styles.reasonCard, selected && styles.reasonCardSelected]}
                onPress={() => setReason(r.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={r.label}
              >
                <Text style={styles.reasonIcon}>{r.icon}</Text>
                <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.painRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.painTitle}>Any lingering pain or soreness?</Text>
            <Text style={styles.painDesc}>
              If yes, the first ramp week starts even gentler and skips all hard intensity.
            </Text>
          </View>
          <Switch
            value={painFlag}
            onValueChange={setPainFlag}
            trackColor={{ true: Colors.gold }}
            accessibilityLabel="Lingering pain or soreness"
          />
        </View>

        <TouchableOpacity
          style={[styles.buildBtn, building && styles.buildBtnDisabled]}
          onPress={handleBuild}
          disabled={building}
          accessibilityRole="button"
          accessibilityLabel="Build my ramp plan"
        >
          {building ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buildBtnText}>Build My Ramp Week →</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footnote}>
          This replaces this week's plan with a reduced-volume, easy-intensity week. Volume climbs
          back toward normal over the following weeks as your training load rebuilds.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', marginBottom: 8 },
  close: { fontSize: 18, color: Colors.textMuted },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  reasonCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  reasonCardSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.surfaceGold,
  },
  reasonIcon: { fontSize: 24 },
  reasonLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  reasonLabelSelected: { color: Colors.textPrimary },
  painRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
  },
  painTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  painDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
  buildBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  buildBtnDisabled: { opacity: 0.6 },
  buildBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  footnote: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    textAlign: 'center',
  },
});
