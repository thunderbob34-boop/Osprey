// supabase/functions/ozzie-daily-brief/types.ts
// Shared, dependency-free types for the daily brief. Kept out of index.ts so the
// pure template path (template.ts) and its tests can import them without pulling
// in index.ts's supabase-js / network code.

export interface BriefContext {
  displayName: string;
  experienceTier: string;
  recovery: { score: number; recommendation: string; hrvMs: number | null; sleepHours: number | null } | null;
  load: { atl: number | null; ctl: number | null; tsb: number | null } | null;
  todaySession: {
    sessionType: string;
    intensity: string;
    plannedMinutes: number | null;
    plannedDistanceKm: number | null;
    description: string | null;
  } | null;
  recentWorkoutCount7d: number;
  workoutCountPrior7d: number;
  primaryGoal: string | null;
  workoutTimeConsistency: { hour: number; count: number } | null;
  foodLogCount14d: number;
  recentMemories: Array<{ summary: string; occurredOn: string }>;
}

export type RestRecommendation = 'train' | 'easy' | 'rest';
