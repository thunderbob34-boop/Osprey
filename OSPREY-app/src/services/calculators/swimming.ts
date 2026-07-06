import { Range } from './types';

/** CSS per 100 = (400 time − 200 time) ÷ 2, both in seconds (docs/coaching/swimming.md §2). */
export function computeCSSPer100(time400Sec: number, time200Sec: number): number {
  return (time400Sec - time200Sec) / 2;
}

/** Five zones as offsets (sec/100) from CSS. Z1 and Z5 are open-ended (docs/coaching/swimming.md §2). */
export interface SwimPaceZones {
  cssSecPer100: number;
  z1EasyRecovery: Range;
  z2Aerobic: Range;
  z3Threshold: Range;
  z4Vo2Max: Range;
}

export function swimPaceZones(cssSecPer100: number): SwimPaceZones {
  return {
    cssSecPer100,
    z1EasyRecovery: { min: cssSecPer100 + 8, max: null },
    z2Aerobic: { min: cssSecPer100 + 3, max: cssSecPer100 + 6 },
    z3Threshold: { min: cssSecPer100 - 2, max: cssSecPer100 + 2 },
    z4Vo2Max: { min: cssSecPer100 - 5, max: cssSecPer100 - 2 },
  };
}

/** Meet-day grazing carbs g/hr between swims (docs/coaching/swimming.md §6). */
export function swimMeetDayCarbGPerHour(longDemandingSession: boolean): Range {
  return { min: 25, max: longDemandingSession ? 90 : 60 };
}
