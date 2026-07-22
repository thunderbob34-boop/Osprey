import type React from 'react';
import type { ReadinessTone } from '@/constants/theme';
import type { LiftPrescription } from '@/types/workout';

/** One exercise line for the Home session card (name + set×rep summary). */
export interface SessionExercise {
  name: string;
  sets: number;
  reps: string;
}

export type RecoveryRecommendation = 'train' | 'easy' | 'rest';

export interface RecoveryData {
  score: number;
  recommendation: RecoveryRecommendation;
  label: string;
}

export interface SessionData {
  type: string;
  duration: string;
  distanceKm?: number | null;
  zone?: string;
  intensity?: string | null;
  /** For strength sessions: the prescribed lifts (name + sets×reps), shown on
   *  the Home card. Cardio sessions leave this null and show a pace/zone chip. */
  exercises?: SessionExercise[] | null;
  ozzieNote: string;
  whyReasoning?: string | null;
  sessionId?: string | null;
  sessionType?: string | null;
}

export interface FuelStatusData {
  lastLoggedMinutesAgo: number | null;
  recommendation: 'fuel_now' | 'good_timing' | 'recently_fueled';
}

export interface QuickStats {
  streak: string;
  monthDistanceKm: number;
  load: string;
}

export interface DailySummaryViewRow {
  user_id: string;
  display_name: string;
  timezone: string;
  experience_tier: string;
  recovery_score: number | null;
  recovery_recommendation: string | null;
  atl: number | null;
  ctl: number | null;
  tsb: number | null;
  calorie_target: number | null;
  week_distance_km: number | null;
  workouts_last_30d: number | null;
}

export interface TodaySessionRow {
  id: string;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string | null;
  ozzie_notes: string | null;
  lift_prescription: LiftPrescription | null;
}

export interface DailySummaryData {
  userName: string;
  recovery?: RecoveryData;
  session: SessionData;
  weekDistanceKm: number;
  weekTargetKm?: number;
  quickStats: QuickStats;
  habitTip?: string | null;
}

export interface TrainingReadiness {
  tsb: number;
  ctl: number;
  label: string;
  /**
   * Semantic state, NOT a colour. The UI maps this through `ReadinessPalette`
   * (src/constants/theme.ts). This used to be a raw colour string produced by
   * the service, which is how old-system teal survived the design migration
   * and kept rendering on the already-migrated home screen.
   */
  tone: ReadinessTone;
}

export interface DailySummaryProps extends Partial<DailySummaryData> {
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onStartSession?: (session: SessionData) => void;
  onBuildPlan?: () => void;
  onSwapSession?: (newType: 'run' | 'lift' | 'cross' | 'rest') => void;
  onCompressSession?: (availableMinutes: number) => void;
  fuelStatus?: FuelStatusData;
  trainingReadiness?: TrainingReadiness | null;
  onActivityPress?: () => void;
  onOzziePress?: () => void;
  onViewWeekPress?: () => void;
  /** Shown as a tap target on the Body Battery empty state ("no score yet"). */
  onConnectHealthPress?: () => void;
  headerBanner?: React.ReactNode;
  weatherCard?: React.ReactNode;
  hydration?: { ounces: number; targetOz: number };
  onAddHydration?: (ounces: number) => void;
  hydrationEmphasized?: boolean;
}
