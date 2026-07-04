import { format } from 'date-fns';
import { supabase } from '@/services/supabase';

export type SwappableSessionType = 'run' | 'lift' | 'cross' | 'rest';

export interface RaceGoal {
  targetRace: string | null;
  targetDate: string | null;
  totalWeeksPlanned: number | null;
}

/** Race-target metadata, persisted independently of the weekly plan/week rows. */
export async function fetchRaceGoal(userId: string): Promise<RaceGoal | null> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('target_race, target_date, total_weeks_planned')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.target_race || !data.target_date) return null;

  return {
    targetRace: data.target_race,
    targetDate: data.target_date,
    totalWeeksPlanned: data.total_weeks_planned,
  };
}

export type RacePhaseName = 'Base' | 'Build' | 'Peak' | 'Taper';

export interface RacePhaseInfo {
  weeksRemaining: number;
  currentWeekNumber: number;
  totalWeeks: number;
  phase: RacePhaseName;
}

/**
 * Standard endurance periodization split by percentage of the full plan:
 * Base 0-40%, Build 40-75%, Peak 75-90%, Taper 90-100%.
 */
export function computeRacePhase(goal: RaceGoal): RacePhaseInfo | null {
  if (!goal.targetDate || !goal.totalWeeksPlanned) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const raceDate = new Date(goal.targetDate);
  if (isNaN(raceDate.getTime())) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / msPerWeek));
  const totalWeeks = goal.totalWeeksPlanned;
  const currentWeekNumber = Math.min(totalWeeks, Math.max(1, totalWeeks - weeksRemaining + 1));
  const progress = currentWeekNumber / totalWeeks;

  let phase: RacePhaseName;
  if (progress <= 0.4) phase = 'Base';
  else if (progress <= 0.75) phase = 'Build';
  else if (progress <= 0.9) phase = 'Peak';
  else phase = 'Taper';

  return { weeksRemaining, currentWeekNumber, totalWeeks, phase };
}

export interface WeekSession {
  session_date: string;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string;
}

/** The active plan's current week (Monday-start), sessions in date order. */
export async function fetchCurrentWeekSessions(userId: string): Promise<WeekSession[]> {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diff);
  // Local date, not UTC — toISOString() shifts the week-start to the wrong
  // calendar day for any user not in (or near) UTC.
  const weekStartStr = format(monday, 'yyyy-MM-dd');

  const { data: week, error: weekError } = await supabase
    .from('training_weeks')
    .select('id, training_plans!inner(user_id, status)')
    .eq('start_date', weekStartStr)
    .eq('training_plans.user_id', userId)
    .eq('training_plans.status', 'active')
    .maybeSingle();

  if (weekError) throw weekError;
  if (!week) return [];

  const { data: sessions, error: sessionsError } = await supabase
    .from('training_sessions')
    .select('session_date, session_type, intensity, planned_minutes, planned_distance_km, description')
    .eq('week_id', week.id)
    .order('session_date', { ascending: true });

  if (sessionsError) throw sessionsError;
  return (sessions ?? []) as WeekSession[];
}

const SWAP_DESCRIPTIONS: Record<SwappableSessionType, string> = {
  run: 'Easy Run',
  lift: 'Strength Session',
  cross: 'Cross Training',
  rest: 'Rest Day',
};

const SWAP_INTENSITY: Record<SwappableSessionType, string> = {
  run: 'easy',
  lift: 'easy',
  cross: 'easy',
  rest: 'rest',
};

export async function swapTodaySession(
  userId: string,
  sessionId: string,
  newType: SwappableSessionType,
): Promise<void> {
  const { data: original, error: fetchError } = await supabase
    .from('training_sessions')
    .select('session_type, intensity, planned_minutes, planned_distance_km, description')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !original) throw fetchError ?? new Error('Session not found');

  const { error: updateError } = await supabase
    .from('training_sessions')
    .update({
      session_type: newType,
      intensity: SWAP_INTENSITY[newType],
      description: SWAP_DESCRIPTIONS[newType],
      planned_distance_km: newType === 'run' ? original.planned_distance_km : null,
      planned_minutes: newType === 'rest' ? null : original.planned_minutes ?? 30,
      ozzie_notes: "Swapped to fit today better — same training effect, different shape.",
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (updateError) throw updateError;

  await supabase.from('plan_adjustments').insert({
    user_id: userId,
    session_id: sessionId,
    triggered_by: 'user_request',
    original_json: { session_type: original.session_type, description: original.description },
    adjusted_json: { session_type: newType, description: SWAP_DESCRIPTIONS[newType] },
    ozzie_reason: `You swapped today's session from ${original.session_type} to ${newType}.`,
  });
}

/**
 * Shrinks today's session to fit the minutes the user actually has,
 * preserving the training stimulus at a lower volume rather than
 * skipping the session entirely ("minimum effective dose").
 */
export async function compressTodaySession(
  userId: string,
  sessionId: string,
  availableMinutes: number,
): Promise<void> {
  const { data: original, error: fetchError } = await supabase
    .from('training_sessions')
    .select('session_type, planned_minutes, planned_distance_km, description')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !original) throw fetchError ?? new Error('Session not found');

  const originalMinutes = original.planned_minutes ?? 30;
  const ratio = Math.min(1, availableMinutes / originalMinutes);
  const newDistanceKm =
    original.planned_distance_km != null
      ? Math.round(original.planned_distance_km * ratio * 100) / 100
      : null;

  const { error: updateError } = await supabase
    .from('training_sessions')
    .update({
      planned_minutes: availableMinutes,
      planned_distance_km: newDistanceKm,
      ozzie_notes: `Compressed to fit ${availableMinutes} minutes — same effort, less volume. Quality over quantity today.`,
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (updateError) throw updateError;

  await supabase.from('plan_adjustments').insert({
    user_id: userId,
    session_id: sessionId,
    triggered_by: 'user_request',
    original_json: { planned_minutes: originalMinutes, planned_distance_km: original.planned_distance_km },
    adjusted_json: { planned_minutes: availableMinutes, planned_distance_km: newDistanceKm },
    ozzie_reason: `You compressed today's ${original.session_type} from ${originalMinutes} to ${availableMinutes} minutes.`,
  });
}
