import type { ZoneSet } from '@/services/coaching/zones';
import type { UnitSystem } from '@/services/units';
import { paceMi, paceRangeMi, swim100, swim100Range, rowing500Range, intRange } from '@/services/pace-format';

/**
 * The generic zone label for a prescribed intensity. Lives here beside
 * `sessionPaceBand` because the two are always rendered together — Home, the
 * Workout tab, and the in-run target strip all show "Zone 4 · ~7:30/mi".
 */
export function intensityZoneLabel(intensity: string | null | undefined): string | undefined {
  switch (intensity) {
    case 'easy':
      return 'Zone 2';
    case 'moderate':
      return 'Zone 3';
    case 'threshold':
      return 'Zone 4';
    case 'interval':
    case 'race':
      return 'Zone 5';
    default:
      return undefined;
  }
}

/**
 * The athlete's OWN pace band for today's session, to render beside the
 * generic zone label ("Zone 2" → "Zone 2 · 9:00–10:00/mi").
 *
 * Only `easy` and `threshold` map to a single clean band in a ZoneSet.
 * `moderate`/`interval`/`race` deliberately return null rather than a guessed
 * range — the app never invents a number it cannot ground (same rule the
 * triathlon predictor follows when a leg has no logged effort).
 */
export function sessionPaceBand(
  intensity: string | null | undefined,
  zones: ZoneSet | null,
  units: UnitSystem,
): string | null {
  if (!zones) return null;
  if (intensity !== 'easy' && intensity !== 'threshold') return null;

  switch (zones.kind) {
    case 'run':
      return intensity === 'easy'
        ? paceRangeMi(zones.bands.easy, units)
        : `~${paceMi(zones.thresholdSecPerMile, units)}`;
    case 'swim':
      return intensity === 'easy'
        ? swim100Range(zones.bands.z2Aerobic, units)
        : swim100Range(zones.bands.z3Threshold, units);
    case 'rowing':
      return intensity === 'easy'
        ? rowing500Range(zones.bands.ut2.splitSecPer500)
        : rowing500Range(zones.bands.at.splitSecPer500);
    case 'cycling':
      return intensity === 'easy'
        ? intRange(zones.bands.z2Endurance, 'w')
        : intRange(zones.bands.z4Threshold, 'w');
    case 'triathlon':
      // A triathlon session's discipline isn't knowable from intensity alone —
      // the run anchor is the useful default, and null when there isn't one.
      return zones.run ? `~${paceMi(zones.run.thresholdSecPerMile, units)}` : null;
    default:
      return null;
  }
}
