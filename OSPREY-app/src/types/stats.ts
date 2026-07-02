export interface WeeklyMileagePoint {
  weekStartIso: string;
  label: string;
  miles: number;
}

export interface RecentWorkoutRow {
  id: string;
  sessionType: string;
  startedAt: string;
  durationMinutes: number;
  distanceMiles: number | null;
}

export interface StatsData {
  totalWorkouts30d: number;
  totalMiles30d: number;
  totalMinutes30d: number;
  weeklyMileage: WeeklyMileagePoint[];
  recentWorkouts: RecentWorkoutRow[];
}
