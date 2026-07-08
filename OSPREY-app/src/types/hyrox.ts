import type { HyroxStationWeights } from '@/services/calculators/hyrox';

export type HyroxStationId =
  | 'skierg'
  | 'sled_push'
  | 'sled_pull'
  | 'burpee_broad_jump'
  | 'rowing'
  | 'farmers_carry'
  | 'sandbag_lunges'
  | 'wall_balls';

export interface HyroxStationDef {
  id: HyroxStationId;
  label: string;
  icon: string;
  target: (weights: HyroxStationWeights) => string;
}

/** The 8 stations, in official race order (docs/coaching/hyrox.md §2) — each preceded by a 1km run. */
export const HYROX_STATIONS: HyroxStationDef[] = [
  { id: 'skierg',            label: 'SkiErg',            icon: '⛷️', target: () => '1000m' },
  { id: 'sled_push',         label: 'Sled Push',         icon: '🛷', target: (w) => `50m · ${w.sledPushKg}kg` },
  { id: 'sled_pull',         label: 'Sled Pull',         icon: '🪢', target: (w) => `50m · ${w.sledPullKg}kg` },
  { id: 'burpee_broad_jump', label: 'Burpee Broad Jump', icon: '🐸', target: () => '80m' },
  { id: 'rowing',            label: 'Rowing',            icon: '🚣', target: () => '1000m' },
  { id: 'farmers_carry',     label: 'Farmers Carry',     icon: '🧳', target: (w) => `200m · ${w.farmersCarryPerHandKg}kg/hand` },
  { id: 'sandbag_lunges',    label: 'Sandbag Lunges',    icon: '🎒', target: (w) => `100m · ${w.sandbagLungesKg}kg` },
  { id: 'wall_balls',        label: 'Wall Balls',        icon: '🏐', target: (w) => `100 reps · ${w.wallBallKg}kg` },
];

/** Shared run-segment icon — every run between stations is identical (1km, no target weight). */
export const HYROX_RUN_ICON = '🏃';

export type HyroxSegmentType = 'run' | 'station';

export interface HyroxSegment {
  type: HyroxSegmentType;
  /** 1-8 — which run or which station this is. */
  index: number;
  stationId?: HyroxStationId; // set only when type === 'station'
  startedAtMs: number;
  completedAtMs: number | null;
}

/** Builds the 16-segment sequence: run(1), station(1), run(2), station(2), ... run(8), station(8). */
export function buildHyroxSegments(): HyroxSegment[] {
  const segments: HyroxSegment[] = [];
  for (let i = 0; i < HYROX_STATIONS.length; i++) {
    segments.push({ type: 'run', index: i + 1, startedAtMs: 0, completedAtMs: null });
    segments.push({
      type: 'station',
      index: i + 1,
      stationId: HYROX_STATIONS[i].id,
      startedAtMs: 0,
      completedAtMs: null,
    });
  }
  return segments;
}

export interface HyroxSplitEntry {
  index: number;
  durationS: number;
}

export interface HyroxStationSplitEntry extends HyroxSplitEntry {
  stationId: HyroxStationId;
}

export interface HyroxSplits {
  runs: HyroxSplitEntry[];
  stations: HyroxStationSplitEntry[];
  roxzoneS: HyroxSplitEntry[];
}

/**
 * Derives run/station durations and roxzone (transition) gaps from the raw
 * segment timestamps — the athlete only ever taps "Mark Complete" on a run
 * or a station, never on a separate roxzone timer, so transition time falls
 * out of the gaps between consecutive segments' timestamps for free.
 */
export function deriveHyroxSplits(segments: HyroxSegment[]): HyroxSplits {
  const runs: HyroxSplitEntry[] = [];
  const stations: HyroxStationSplitEntry[] = [];
  const roxzoneS: HyroxSplitEntry[] = [];

  segments.forEach((segment, i) => {
    if (segment.completedAtMs == null) return;
    const durationS = Math.round((segment.completedAtMs - segment.startedAtMs) / 1000);
    if (segment.type === 'run') {
      runs.push({ index: segment.index, durationS });
    } else if (segment.stationId) {
      stations.push({ index: segment.index, stationId: segment.stationId, durationS });
    }

    const next = segments[i + 1];
    if (next && next.startedAtMs > 0) {
      roxzoneS.push({
        index: i + 1,
        durationS: Math.round((next.startedAtMs - segment.completedAtMs) / 1000),
      });
    }
  });

  return { runs, stations, roxzoneS };
}
