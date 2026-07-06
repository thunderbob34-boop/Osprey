import { Range, formatMinSec } from './types';

/** Running's own day-type table (docs/coaching/running.md §6) — top tier is race-week carb-load, not a volume peak. */
export type RunningDayType = 'easy' | 'moderate' | 'high' | 'raceWeek';

export const RUNNING_DAILY_CARB_G_PER_KG: Record<RunningDayType, Range> = {
  easy: { min: 3, max: 5 },
  moderate: { min: 5, max: 7 },
  high: { min: 8, max: 10 },
  raceWeek: { min: 8, max: 12 },
};

export function runningDailyCarbGrams(dayType: RunningDayType, bodyWeightKg: number): Range {
  const perKg = RUNNING_DAILY_CARB_G_PER_KG[dayType];
  return {
    min: perKg.min != null ? perKg.min * bodyWeightKg : null,
    max: perKg.max != null ? perKg.max * bodyWeightKg : null,
  };
}

/** Daniels E/M/T/I zones plus HMP/10K/5K goal paces, all as offsets (sec/mile) from threshold (T). */
export interface RunningPaceZones {
  thresholdSecPerMile: number;
  easy: Range;
  marathonPace: Range;
  halfMarathonPace: Range;
  tenKPace: Range;
  fiveKPace: Range;
  intervalPace: Range;
}

export function runningPaceZones(thresholdSecPerMile: number): RunningPaceZones {
  const t = thresholdSecPerMile;
  return {
    thresholdSecPerMile: t,
    easy: { min: t + 60, max: t + 120 },
    marathonPace: { min: t + 15, max: t + 30 },
    halfMarathonPace: { min: t + 5, max: t + 15 },
    tenKPace: { min: t - 15, max: t - 5 },
    fiveKPace: { min: t - 30, max: t - 20 },
    intervalPace: { min: t - 20, max: t - 10 },
  };
}

export function formatRunningPace(secPerMile: number): string {
  return `${formatMinSec(secPerMile)}/mi`;
}

export type RunningRaceDistance = 'marathon' | 'half' | '10k' | '5k';

/**
 * In-race carbs g/hr. Marathon always fuels; half only fuels if the race
 * will run 90+ minutes; 10K/5K need no mid-race fuel (docs/coaching/running.md §6).
 */
export function runningRaceFuelGPerHour(
  distance: RunningRaceDistance,
  estimatedDurationMinutes?: number,
): Range {
  switch (distance) {
    case 'marathon':
      return { min: 60, max: 90 };
    case 'half':
      return estimatedDurationMinutes != null && estimatedDurationMinutes >= 90
        ? { min: 30, max: 60 }
        : { min: 0, max: 0 };
    case '10k':
    case '5k':
      return { min: 0, max: 0 };
  }
}

export interface TimeTrialHRSample {
  tSec: number;
  hr: number;
}

/** LTHR = avg HR over the last 20 min of a 30-min time trial (docs/coaching/triathlon.md §2). */
export function computeLTHR(samples: TimeTrialHRSample[]): number {
  if (samples.length === 0) throw new Error('No HR samples provided');
  const endSec = Math.max(...samples.map((s) => s.tSec));
  const windowStartSec = endSec - 20 * 60;
  const windowSamples = samples.filter((s) => s.tSec >= windowStartSec);
  const sum = windowSamples.reduce((acc, s) => acc + s.hr, 0);
  return Math.round(sum / windowSamples.length);
}
