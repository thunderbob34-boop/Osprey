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

/** Structured strength workout written by Ozzie on plan lift days. */
export interface LiftPrescription {
  exercises: {
    name: string;
    sets: number;
    reps: string;
    note: string | null;
  }[];
}

export type IntervalEffort = 'easy' | 'moderate' | 'threshold' | 'hard' | 'max';

export interface IntervalSegment {
  reps: number;
  distanceM: number | null;
  durationS: number | null;
  effort: IntervalEffort;
  restS: number;
  label: string;
}

/** Structured swim/bike set written by Ozzie on plan interval days. */
export interface IntervalPrescription {
  segments: IntervalSegment[];
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
  splits: { mile: number; pace: string; durationS: number }[];
  exercises: { name: string; sets: LiftSet[]; volumeLbs: number; isPr: boolean }[];
  ozzieDebrief: string;
  hasPr: boolean;
}
