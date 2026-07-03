import type React from 'react';

export type RecoveryRecommendation = 'train' | 'easy' | 'rest';

export interface RecoveryData {
  score: number;
  recommendation: RecoveryRecommendation;
  label: string;
}

export interface SessionData {
  type: string;
  duration: string;
  distance?: string;
  zone?: string;
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
  monthMiles: string;
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
}

export interface DailySummaryData {
  userName: string;
  recovery?: RecoveryData;
  session: SessionData;
  weekMiles: number;
  weekTarget?: number;
  quickStats: QuickStats;
  habitTip?: string | null;
}

export interface TrainingReadiness {
  tsb: number;
  ctl: number;
  label: string;
  color: string;
}

export interface DailySummaryProps extends Partial<DailySummaryData> {
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onStartSession?: (session: SessionData) => void;
  onSwapSession?: (newType: 'run' | 'lift' | 'cross' | 'rest') => void;
  onCompressSession?: (availableMinutes: number) => void;
  fuelStatus?: FuelStatusData;
  trainingReadiness?: TrainingReadiness | null;
  onActivityPress?: () => void;
  onViewWeekPress?: () => void;
  headerBanner?: React.ReactNode;
  weatherCard?: React.ReactNode;
}
