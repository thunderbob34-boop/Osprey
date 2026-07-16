import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useDisplayZones } from '@/hooks/useDisplayZones';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import type { HrZoneInfo } from '@/services/coaching/envelope';
import type { ZoneSet } from '@/services/coaching/zones';
import { formatMinSec, type Range } from '@/services/calculators/types';
import type { UnitSystem } from '@/services/units';

// Canonical mile↔km ratio (matches useDisplayZones.ts / services/units.ts).
const MILES_PER_KM = 0.621371;
// 100 yd = 91.44 m — swim pace/100yd is *faster* (fewer seconds) than /100m
// because the pool distance is shorter, so this factor is < 1.
const YD_PER_100M = 0.9144;

/**
 * sec/mile (a pace — inverse of distance) → "M:SS/mi", or "M:SS/km" when metric.
 * Converting a *pace* from mile-denominated to km-denominated multiplies by
 * MILES_PER_KM (mirrors kmToMiles's direction, not milesToKm's) — a pace gets
 * FASTER (fewer seconds) per the shorter unit. Sanity check against a real
 * anchor.ts tier value: 450 sec/mi ("intermediate", 7:30/mi) is a 12.875 km/h
 * pace, i.e. 4:40/km — 450 * 0.621371 = 279.6s = 4:40. (450 / 0.621371 would
 * give a nonsensical 12:04/km — more than 2.5× too slow — so this helper
 * multiplies, it does not divide.)
 */
function paceMi(sec: number, units: UnitSystem): string {
  const value = units === 'metric' ? sec * MILES_PER_KM : sec;
  return `${formatMinSec(value)}/${units === 'metric' ? 'km' : 'mi'}`;
}

function paceRangeMi(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  const factor = units === 'metric' ? MILES_PER_KM : 1;
  const suffix = units === 'metric' ? '/km' : '/mi';
  return `${formatMinSec(range.min * factor)}–${formatMinSec(range.max * factor)}${suffix}`;
}

/** sec/100m → "M:SS/100m" (metric) or "M:SS/100yd" (imperial, scaled by YD_PER_100M). */
function swim100(sec: number, units: UnitSystem): string {
  const value = units === 'metric' ? sec : sec * YD_PER_100M;
  return `${formatMinSec(value)}/100${units === 'metric' ? 'm' : 'yd'}`;
}

function swim100Range(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  const factor = units === 'metric' ? 1 : YD_PER_100M;
  const suffix = units === 'metric' ? '/100m' : '/100yd';
  return `${formatMinSec(range.min * factor)}–${formatMinSec(range.max * factor)}${suffix}`;
}

/** sec/500m — rowing splits are unit-agnostic (Concept2 ergs always read meters). */
function rowing500Range(range: Range): string {
  if (range.min == null || range.max == null) return '—';
  return `${formatMinSec(range.min)}–${formatMinSec(range.max)}/500m`;
}

/** Integer ranges for watts / bpm — neither needs a unit conversion. */
function intRange(range: Range, unit: string): string {
  if (range.min == null || range.max == null) return '—';
  return `${Math.round(range.min)}–${Math.round(range.max)} ${unit}`;
}

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
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.teal, letterSpacing: 1 },
  tag: {
    backgroundColor: Colors.goldDim,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 11, fontWeight: '700', color: Colors.gold },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  nudge: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
});
