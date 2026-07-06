export type SportType = 'run' | 'lift' | 'swim' | 'bike' | 'cross' | 'race';

export interface RecentWorkoutRow {
  id: string;
  sessionType: string;
  startedAt: string;
  durationMinutes: number;
  distanceMiles: number | null;
}

/** One week's training volume, broken down by sport, in hours. */
export interface WeeklySportPoint {
  weekStartIso: string;
  label: string;
  hoursBySport: Partial<Record<SportType, number>>;
  totalHours: number;
}

/** Totals across the whole displayed window (matches weeklySportVolume's span). */
export interface SportPeriodTotal {
  sessionType: SportType;
  hours: number;
  /** null for sports without a meaningful distance metric (lift). */
  miles: number | null;
}

export interface StatsData {
  totalWorkouts30d: number;
  totalMiles30d: number;
  totalMinutes30d: number;
  weeklySportVolume: WeeklySportPoint[];
  sportTotalsPeriod: SportPeriodTotal[];
  recentWorkouts: RecentWorkoutRow[];
}
