import { buildHyroxSegments, deriveHyroxSplits, HYROX_STATIONS, type HyroxSegment } from '@/types/hyrox';

describe('buildHyroxSegments', () => {
  it('builds 16 segments alternating run/station, matching HYROX_STATIONS order', () => {
    const segments = buildHyroxSegments();
    expect(segments).toHaveLength(16);
    HYROX_STATIONS.forEach((station, i) => {
      expect(segments[i * 2]).toMatchObject({ type: 'run', index: i + 1 });
      expect(segments[i * 2 + 1]).toMatchObject({ type: 'station', index: i + 1, stationId: station.id });
    });
  });

  it('starts every segment unstamped', () => {
    const segments = buildHyroxSegments();
    expect(segments.every((s) => s.completedAtMs === null)).toBe(true);
  });
});

describe('deriveHyroxSplits', () => {
  // Simulates a full race: each segment takes exactly the duration listed,
  // with a fixed 10s roxzone gap between every consecutive segment.
  function simulateFullRace(): HyroxSegment[] {
    const segments = buildHyroxSegments();
    const ROXZONE_S = 10;
    let clockMs = 0;
    return segments.map((seg, i) => {
      const durationS = seg.type === 'run' ? 240 : 90; // 4min runs, 90s stations
      const startedAtMs = clockMs;
      const completedAtMs = startedAtMs + durationS * 1000;
      clockMs = completedAtMs + (i < segments.length - 1 ? ROXZONE_S * 1000 : 0);
      return { ...seg, startedAtMs, completedAtMs };
    });
  }

  it('derives 8 run splits, 8 station splits, and 15 roxzone gaps from a full race', () => {
    const { runs, stations, roxzoneS } = deriveHyroxSplits(simulateFullRace());
    expect(runs).toHaveLength(8);
    expect(stations).toHaveLength(8);
    expect(roxzoneS).toHaveLength(15);
  });

  it('assigns the correct duration and station id to each split', () => {
    const { runs, stations } = deriveHyroxSplits(simulateFullRace());
    expect(runs[0]).toEqual({ index: 1, durationS: 240 });
    expect(stations[0]).toEqual({ index: 1, stationId: 'skierg', durationS: 90 });
    expect(stations[7]).toEqual({ index: 8, stationId: 'wall_balls', durationS: 90 });
  });

  it('derives the fixed roxzone gap between every consecutive segment', () => {
    const { roxzoneS } = deriveHyroxSplits(simulateFullRace());
    expect(roxzoneS.every((r) => r.durationS === 10)).toBe(true);
  });

  it('produces no roxzone entry after the final station (finish line, not a transition)', () => {
    const { roxzoneS } = deriveHyroxSplits(simulateFullRace());
    // 15 gaps span 16 segments (indices 1-15 between segment pairs); nothing
    // is derived past the 16th segment's completion.
    expect(roxzoneS[roxzoneS.length - 1].index).toBe(15);
  });

  it('only derives entries for segments actually completed so far', () => {
    const segments = buildHyroxSegments();
    segments[0] = { ...segments[0], startedAtMs: 0, completedAtMs: 240_000 }; // run 1 done
    segments[1] = { ...segments[1], startedAtMs: 250_000 }; // station 1 in progress, not complete
    const { runs, stations, roxzoneS } = deriveHyroxSplits(segments);
    expect(runs).toEqual([{ index: 1, durationS: 240 }]);
    expect(stations).toHaveLength(0);
    expect(roxzoneS).toEqual([{ index: 1, durationS: 10 }]);
  });
});
