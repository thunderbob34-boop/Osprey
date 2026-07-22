import { View, Text, StyleSheet } from 'react-native';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { intensityZoneLabel, sessionPaceBand } from '@/services/session-pace';
import { kmToMiles } from '@/services/units';
import type { SessionTarget } from '@/services/workouts';
import type { ZoneSet } from '@/services/coaching/zones';

interface Props {
  target: SessionTarget;
  /** The athlete's own zones, for the pace band beside the zone label. */
  zones: ZoneSet | null;
}

/**
 * What the engine prescribed, shown while the athlete is actually doing it.
 *
 * The in-run screens only ever rendered `interval_prescription`, so on any
 * session without one — easy, long, moderate and recovery runs, i.e. most of
 * a plan — the athlete started a workout and the target vanished, one tap
 * after Home had shown them "40 min · 4.3 mi · Zone 4 · ~7:30/mi".
 */
export default function SessionTargetStrip({ target, zones }: Props) {
  const zone = intensityZoneLabel(target.intensity);
  // Imperial regardless of the athlete's unit preference: the run screen's live
  // readouts are miles-and-min/mi throughout (see workoutStore's metersToMiles
  // and formatPace), and a km target above a mi readout is worse than either
  // unit consistently. Converting the whole screen is its own change.
  const band = sessionPaceBand(target.intensity, zones, 'imperial');

  const parts = [
    target.plannedMinutes ? `${target.plannedMinutes} min` : null,
    target.plannedDistanceKm != null ? `${kmToMiles(target.plannedDistanceKm).toFixed(1)} mi` : null,
    zone && band ? `${zone} · ${band}` : zone,
  ].filter(Boolean);

  // Nothing prescribed worth stating — say nothing rather than render an
  // empty "TARGET" label.
  if (parts.length === 0) return null;

  return (
    <View style={styles.strip}>
      <Text style={styles.label}>TARGET</Text>
      <Text style={styles.value} numberOfLines={2}>
        {target.description ? `${target.description} · ` : ''}
        {parts.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Theme.panel,
    borderTopWidth: BorderWidth.card,
    borderTopColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: Theme.accent,
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Theme.text,
  },
});
