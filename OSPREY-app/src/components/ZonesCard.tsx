import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';
import { useDisplayZones } from '@/hooks/useDisplayZones';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { rowsForZones } from '@/services/coaching/zone-rows';
import { blueprintSport } from '@/services/coaching/zones';
import type { PrimaryGoalEnum } from '@/services/coaching/goal-map';

/** Compact "Your zones" card for the plan-preview — renders nothing while the
 * hook is loading, for a `lift` goal, or on any read error (useDisplayZones
 * returns null in all three cases; there's no way to tell them apart here,
 * which is fine — "no card" is the correct display for all three). */
export function ZonesCard(): JSX.Element | null {
  const display = useDisplayZones();
  const { data: goal } = useTrainingGoal();
  const { units } = useUnitPreference();
  const router = useRouter();

  if (!display) return null;
  const rows = rowsForZones(display.zones, display.hrZones, units);
  if (rows.length === 0) return null;
  const isEstimated = display.confidence === 'estimated';

  // useTrainingGoal() types primaryGoal via the onboarding-only PrimaryGoal union, which
  // omits 'triathlon' (see @/types/onboarding vs. the superset PrimaryGoalEnum documented
  // in goal-map.ts) even though user_goals.primary_goal really can hold it. Widen to the
  // proper superset here rather than casting to a bare string — same pattern used in
  // app/(tabs)/settings.tsx and app/training-baseline.tsx.
  const primaryGoal = (goal?.primaryGoal ?? null) as PrimaryGoalEnum | null;
  // "Estimated" can be true for goals with no pace/power anchor at all (weight_loss /
  // general_fitness fall back to an estimated-max-HR band) — training-baseline.tsx has
  // nothing to show those goals. Only offer the tap when it leads somewhere real; this
  // mirrors the exact condition Settings uses to hide its own "Training Baseline" row.
  const canSetBaseline = blueprintSport(primaryGoal ?? '') != null || primaryGoal === 'triathlon';

  function goToBaseline() {
    router.push('/training-baseline');
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>YOUR ZONES</Text>
        {isEstimated ? (
          canSetBaseline ? (
            <TouchableOpacity
              style={styles.tag}
              onPress={goToBaseline}
              accessibilityRole="button"
              accessibilityLabel="Estimated zones — tap to set your real training baseline"
            >
              <Text style={styles.tagText}>Estimated</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.tag}>
              <Text style={styles.tagText}>Estimated</Text>
            </View>
          )
        ) : null}
      </View>

      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={styles.rowLeft}>
              <View
                style={[styles.dot, { backgroundColor: row.tone === 'aerobic' ? Colors.green : Colors.amber }]}
              />
              <Text style={styles.rowLabel}>{row.label}</Text>
            </View>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {isEstimated ? (
        canSetBaseline ? (
          <TouchableOpacity onPress={goToBaseline} accessibilityRole="button" accessibilityLabel="Set your real training baseline">
            <Text style={styles.nudge}>
              Estimated from your experience level — log a few efforts and these sharpen automatically.
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.nudge}>
            Estimated from your experience level — log a few efforts and these sharpen automatically.
          </Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.accent,
    letterSpacing: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  tag: {
    backgroundColor: Theme.panel,
    borderRadius: Radius.card,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 11, fontWeight: '700', color: Theme.accent },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { fontSize: 13, fontWeight: '600', color: Theme.textSoft },
  rowValue: { fontSize: 14, fontWeight: '800', color: Theme.text },
  nudge: { fontSize: 11, color: Theme.textMut, lineHeight: 16 },
});
