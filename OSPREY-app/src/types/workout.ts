export type WorkoutType = 'run' | 'lift' | 'swim' | 'bike' | 'cross';
export type WorkoutStatus = 'idle' | 'active' | 'paused' | 'saving';

export interface TrackPoint {
  lat: number;
  lon: number;
  recordedAt: string;
  speedMs?: number;
  heartRate?: number;
}

export interface LiftSet {
  setNumber: number;
  reps: number;
  weightLbs: number;
  completed: boolean;
}

export interface LiftExercise {
  exerciseId: string;
  name: string;
  sets: LiftSet[];
}

export interface SavedWorkoutSummary {
  id: string;
  sessionType: WorkoutType;
  totalDistanceKm: number | null;
  totalDurationS: number;
  startedAt: string;
  notes: string | null;
}

export interface WorkoutRecapData {
  workout: SavedWorkoutSummary;
  splits: Array<{ mile: number; pace: string; durationS: number }>;
  exercises: Array<{ name: string; sets: LiftSet[]; volumeLbs: number; isPr: boolean }>;
  ozzieDebrief: string;
  hasPr: boolean;
}
