import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';
import { useDisplayZones } from '@/hooks/useDisplayZones';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import type { HrZoneInfo } from '@/services/coaching/envelope';
import type { ZoneSet } from '@/services/coaching/zones';
import type { UnitSystem } from '@/services/units';
import {
  paceMi,
  paceRangeMi,
  swim100,
  swim100Range,
  rowing500Range,
  intRange,
} from '@/services/pace-format';

interface ZoneRow {
  label: string;
  value: string;
  tone: 'aerobic' | 'threshold';
}

/** Builds the card's rows by switching on the resolved ZoneSet's kind, falling
 * back to HR bands when there are no pace/power zones at all (weight_loss,
 * general, or cycling with no self-reported FTP). Triathlon is compact —
 * one row per discipline showing just its threshold anchor, not a full
 * easy+threshold pair per discipline. */
function rowsForZones(zones: ZoneSet | null, hrZones: HrZoneInfo, units: UnitSystem): ZoneRow[] {
  if (!zones) {
    return [
      { label: 'Easy', value: intRange(hrZones.bands.z2Endurance, 'bpm'), tone: 'aerobic' },
      { label: 'Threshold', value: intRange(hrZones.bands.z4Threshold, 'bpm'), tone: 'threshold' },
    ];
  }
  switch (zones.kind) {
    case 'run':
      return [
        { label: 'Easy', value: paceRangeMi(zones.bands.easy, units), tone: 'aerobic' },
        { label: 'Threshold', value: `~${paceMi(zones.thresholdSecPerMile, units)}`, tone: 'threshold' },
      ];
    case 'swim':
      return [
        { label: 'Aerobic', value: swim100Range(zones.bands.z2Aerobic, units), tone: 'aerobic' },
        { label: 'Threshold', value: swim100Range(zones.bands.z3Threshold, units), tone: 'threshold' },
      ];
    case 'rowing':
      return [
        { label: 'UT2', value: rowing500Range(zones.bands.ut2.splitSecPer500), tone: 'aerobic' },
        { label: 'AT', value: rowing500Range(zones.bands.at.splitSecPer500), tone: 'threshold' },
      ];
    case 'cycling':
      return [
        { label: 'Endurance', value: intRange(zones.bands.z2Endurance, 'w'), tone: 'aerobic' },
        { label: 'Threshold', value: intRange(zones.bands.z4Threshold, 'w'), tone: 'threshold' },
      ];
    case 'triathlon': {
      const rows: ZoneRow[] = [];
      if (zones.run) {
        rows.push({ label: 'Run', value: `~${paceMi(zones.run.thresholdSecPerMile, units)}`, tone: 'threshold' });
      }
      if (zones.swim) {
        rows.push({ label: 'Swim', value: `~${swim100(zones.swim.cssSecPer100, units)}`, tone: 'threshold' });
      }
      if (zones.bike) {
        rows.push({ label: 'Bike', value: `~${Math.round(zones.bike.ftpWatts)} w`, tone: 'threshold' });
      }
      return rows;
    }
    default:
      return [];
  }
}

/** Compact "Your zones" card for the plan-preview — renders nothing while the
 * hook is loading, for a `lift` goal, or on any read error (useDisplayZones
 * returns null in all three cases; there's no way to tell them apart here,
 * which is fine — "no card" is the correct display for all three). */
export function ZonesCard(): JSX.Element | null {
  const display = useDisplayZones();
  const { units } = useUnitPreference();

  if (!display) return null;
  const rows = rowsForZones(display.zones, display.hrZones, units);
  if (rows.length === 0) return null;
  const isEstimated = display.confidence === 'estimated';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>YOUR ZONES</Text>
        {isEstimated ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>Estimated</Text>
          </View>
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
        <Text style={styles.nudge}>
          Estimated from your experience level — log a few efforts and these sharpen automatically.
        </Text>
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
