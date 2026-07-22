import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';
import { useDisplayZones } from '@/hooks/useDisplayZones';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { rowsForZones } from '@/services/coaching/zone-rows';

/** Compact "Your zones" card for the plan-preview — renders nothing while the
 * hook is loading, for a `lift` goal, or on any read error (useDisplayZones
 * returns null in all three cases; there's no way to tell them apart here,
 * which is fine — "no card" is the correct display for all three). */
export function ZonesCard(): JSX.Element | null {
  const display = useDisplayZones();
  const { units } = useUnitPreference();
  const router = useRouter();

  if (!display) return null;
  const rows = rowsForZones(display.zones, display.hrZones, units);
  if (rows.length === 0) return null;
  const isEstimated = display.confidence === 'estimated';

  function goToBaseline() {
    router.push('/training-baseline');
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>YOUR ZONES</Text>
        {isEstimated ? (
          <TouchableOpacity
            style={styles.tag}
            onPress={goToBaseline}
            accessibilityRole="button"
            accessibilityLabel="Estimated zones — tap to set your real training baseline"
          >
            <Text style={styles.tagText}>Estimated</Text>
          </TouchableOpacity>
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
        <TouchableOpacity onPress={goToBaseline} accessibilityRole="button" accessibilityLabel="Set your real training baseline">
          <Text style={styles.nudge}>
            Estimated from your experience level — log a few efforts and these sharpen automatically.
          </Text>
        </TouchableOpacity>
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
