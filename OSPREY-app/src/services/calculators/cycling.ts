import { Range } from './types';

/** Coggan 7-zone power model as watts, derived from FTP (docs/coaching/cycling.md §2). */
export interface CyclingPowerZones {
  ftpWatts: number;
  z1ActiveRecovery: Range;
  z2Endurance: Range;
  z3Tempo: Range;
  z4Threshold: Range;
  z5Vo2Max: Range;
  z6Anaerobic: Range;
  z7Neuromuscular: Range;
  sweetSpot: Range;
}

export function cyclingPowerZones(ftpWatts: number): CyclingPowerZones {
  const pct = (p: number) => Math.round(ftpWatts * (p / 100));
  return {
    ftpWatts,
    z1ActiveRecovery: { min: null, max: pct(55) },
    z2Endurance: { min: pct(56), max: pct(75) },
    z3Tempo: { min: pct(76), max: pct(90) },
    z4Threshold: { min: pct(91), max: pct(105) },
    z5Vo2Max: { min: pct(106), max: pct(120) },
    z6Anaerobic: { min: pct(121), max: pct(150) },
    z7Neuromuscular: { min: pct(151), max: null },
    sweetSpot: { min: pct(88), max: pct(94) },
  };
}

export type CyclingRideDuration = 'short_steady' | 'long_or_hard' | 'very_long_or_racing';

/** In-ride carbs g/hr by duration/intensity (docs/coaching/cycling.md §6). */
export function cyclingInRideCarbGPerHour(duration: CyclingRideDuration): Range {
  switch (duration) {
    case 'short_steady':
      return { min: 30, max: 60 };
    case 'long_or_hard':
      return { min: 60, max: 90 };
    case 'very_long_or_racing':
      return { min: 90, max: 120 };
  }
}
