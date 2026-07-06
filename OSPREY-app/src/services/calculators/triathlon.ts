import { Range } from './types';

/** FTP ≈ 95% of 20-minute max power (docs/coaching/triathlon.md §2). */
export function estimateFTPFromTwentyMinPower(twentyMinMaxPowerWatts: number): number {
  return twentyMinMaxPowerWatts * 0.95;
}

export type TriathlonDistance = 'sprint' | 'olympic' | '70.3' | 'ironman';

/** Race fuel g/hr by distance (docs/coaching/triathlon.md §6). Sprint only fuels if it runs past ~75 min. */
export function triathlonRaceCarbGPerHour(
  distance: TriathlonDistance,
  raceDurationMinutes?: number,
): Range {
  switch (distance) {
    case 'sprint':
      return raceDurationMinutes != null && raceDurationMinutes > 75
        ? { min: 30, max: 30 }
        : { min: 0, max: 0 };
    case 'olympic':
      return { min: 30, max: 60 };
    case '70.3':
      return { min: 60, max: 90 };
    case 'ironman':
      return { min: 90, max: 120 };
  }
}

export interface DisciplineHourSplit {
  swimHours: number;
  bikeHours: number;
  runHours: number;
}

/** Default weekly hour split — swim 20% / bike 50% / run 30% (docs/coaching/triathlon.md §2). */
export function disciplineHourSplit(totalWeeklyHours: number): DisciplineHourSplit {
  return {
    swimHours: totalWeeklyHours * 0.2,
    bikeHours: totalWeeklyHours * 0.5,
    runHours: totalWeeklyHours * 0.3,
  };
}
