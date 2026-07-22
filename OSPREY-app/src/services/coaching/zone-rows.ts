import type { HrZoneInfo } from './envelope';
import type { ZoneSet } from './zones';
import type { UnitSystem } from '@/services/units';
import { paceMi, paceRangeMi, swim100, swim100Range, rowing500Range, intRange } from '@/services/pace-format';

export interface ZoneRow {
  label: string;
  value: string;
  tone: 'aerobic' | 'threshold';
}

/** Builds a card's rows by switching on the resolved ZoneSet's kind, falling
 * back to HR bands when there are no pace/power zones at all (weight_loss,
 * general, or cycling with no self-reported FTP). Triathlon is compact —
 * one row per discipline showing just its threshold anchor, not a full
 * easy+threshold pair per discipline. Shared by ZonesCard (the athlete's
 * live plan) and the Training Baseline screen (a live preview of an
 * in-progress edit) so both render zones identically. */
export function rowsForZones(zones: ZoneSet | null, hrZones: HrZoneInfo, units: UnitSystem): ZoneRow[] {
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
