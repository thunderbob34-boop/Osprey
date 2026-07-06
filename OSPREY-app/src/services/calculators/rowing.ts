import { Range } from './types';

/** Concept2 power formula: watts = 2.80 / (sec-per-meter)^3. */
export function splitToWatts(splitSecPer500m: number): number {
  const pacePerMeter = splitSecPer500m / 500;
  return 2.8 / Math.pow(pacePerMeter, 3);
}

export function wattsToSplit(watts: number): number {
  return 500 * Math.pow(2.8 / watts, 1 / 3);
}

export interface RowingZone {
  splitSecPer500: Range;
  strokeRateSpm: Range;
  percentOf2kPower: Range;
}

/** UT2/UT1/AT/TR/AN zones as offsets from current 2k split (docs/coaching/rowing.md §2). */
export interface RowingTrainingZones {
  current2kSplitSecPer500: number;
  ut2: RowingZone;
  ut1: RowingZone;
  at: RowingZone;
  tr: RowingZone;
  an: RowingZone;
}

export function rowingTrainingZones(current2kSplitSecPer500: number): RowingTrainingZones {
  const split = current2kSplitSecPer500;
  return {
    current2kSplitSecPer500: split,
    ut2: {
      splitSecPer500: { min: split + 12, max: split + 16 },
      strokeRateSpm: { min: 18, max: 20 },
      percentOf2kPower: { min: 55, max: 65 },
    },
    ut1: {
      splitSecPer500: { min: split + 6, max: split + 10 },
      strokeRateSpm: { min: 22, max: 24 },
      percentOf2kPower: { min: 65, max: 75 },
    },
    at: {
      splitSecPer500: { min: split + 3, max: split + 5 },
      strokeRateSpm: { min: 26, max: 28 },
      percentOf2kPower: { min: 75, max: 85 },
    },
    tr: {
      splitSecPer500: { min: split, max: split + 2 },
      strokeRateSpm: { min: 28, max: 32 },
      percentOf2kPower: { min: 85, max: 95 },
    },
    an: {
      splitSecPer500: { min: null, max: split },
      strokeRateSpm: { min: 34, max: 40 },
      percentOf2kPower: { min: 95, max: 110 },
    },
  };
}
