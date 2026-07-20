import { supabase } from '@/services/supabase';
import { invalidateTodayDailyBrief } from '@/services/daily-summary';
import { localDateString, parseLocalDate } from '@/utils/date';
import type { IntervalPrescription, LiftPrescription } from '@/types/workout';

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
export function computeRacePhase(goal: RaceGoal, now: Date = new Date()): RacePhaseInfo | null {
  if (!goal.targetDate || !goal.totalWeeksPlanned) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // Parse the target date at LOCAL midnight so it matches `today` — `new Date(str)`
  // would parse YYYY-MM-DD as UTC and flip phase boundaries in offset zones.
  const raceDate = parseLocalDate(goal.targetDate);
  if (isNaN(raceDate.getTime())) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / msPerWeek));
  const totalWeeks = goal.totalWeeksPlanned;
  const currentWeekNumber = Math.min(totalWeeks, Math.max(1, totalWeeks - weeksRemaining + 1));
  const progress = currentWeekNumber / totalWeeks;

  // Taper is the blueprint's final block (docs/coaching/_index.md:19), scaled to
  // plan length: ~3 weeks for a full build, fewer for short plans. Drive it by
  // weeksRemaining so it's always the true final N weeks, not a fixed % that
  // under-tapers long plans (audit-reports/2026-07-10-audit.md:44).
  const taperWeeks = totalWeeks <= 6 ? 1 : totalWeeks <= 10 ? 2 : 3;

  let phase: RacePhaseName;
  if (weeksRemaining <= taperWeeks) phase = 'Taper';
  else if (progress <= 0.4) phase = 'Base';
  else if (progress <= 0.75) phase = 'Build';
  else phase = 'Peak';

  return { weeksRemaining, currentWeekNumber, totalWeeks, phase };
}

export interface WeekSession {
  id: string;
  session_date: string;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string;
  ozzie_notes: string | null;
  lift_prescription: LiftPrescription | null;
  interval_prescription: IntervalPrescription | null;
}

function isValidLiftPrescription(value: unknown): value is LiftPrescription {
  const exercises = (value as { exercises?: unknown } | null)?.exercises;
  return Array.isArray(exercises) && exercises.length > 0;
}

function isValidIntervalPrescription(value: unknown): value is IntervalPrescription {
  const segments = (value as { segments?: unknown } | null)?.segments;
  return Array.isArray(segments) && segments.length > 0;
}

/** Monday-start date (YYYY-MM-DD) of the current calendar week. */
export function currentWeekStartDate(now: Date = new Date()): string {
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diff);
  return localDateString(monday);
}

/** The active plan's current week (Monday-start), sessions in date order. */
export async function fetchCurrentWeekSessions(userId: string): Promise<WeekSession[]> {
  const weekStartStr = currentWeekStartDate();

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
    .select(
      'id, session_date, session_type, intensity, planned_minutes, planned_distance_km, description, ozzie_notes, lift_prescription, interval_prescription',
    )
    .eq('week_id', week.id)
    .order('session_date', { ascending: true });

  if (sessionsError) throw sessionsError;
  return (sessions ?? []).map((row) => ({
    ...row,
    lift_prescription: isValidLiftPrescription(row.lift_prescription) ? row.lift_prescription : null,
    interval_prescription: isValidIntervalPrescription(row.interval_prescription)
      ? row.interval_prescription
      : null,
  })) as WeekSession[];
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

// Plain-language labels for Ozzie's voice — session_type is an internal
// enum ('cross', 'rest') that shouldn't leak into what the athlete reads.
const SESSION_TYPE_SPOKEN_LABEL: Record<string, string> = {
  run: 'run',
  lift: 'lift session',
  cross: 'cross training',
  rest: 'rest day',
  swim: 'swim',
  bike: 'bike ride',
  rowing: 'row',
  hyrox: 'HYROX session',
  race: 'race',
};

function spokenSessionType(type: string): string {
  return SESSION_TYPE_SPOKEN_LABEL[type] ?? type;
}

export async function swapTodaySession(
  userId: string,
  sessionId: string,
  newType: SwappableSessionType,
  triggeredBy: string = 'user_request',
): Promise<void> {
  const { data: original, error: fetchError } = await supabase
    .from('training_sessions')
    .select('session_type, intensity, planned_minutes, planned_distance_km, description')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !original) throw fetchError ?? new Error('Session not found');

  const ozzieNotes =
    triggeredBy === 'trend_deload'
      ? 'De-loaded ahead of a projected load spike — same training effect, lower risk this week.'
      : 'Swapped to fit today better — same training effect, different shape.';

  const { error: updateError } = await supabase
    .from('training_sessions')
    .update({
      session_type: newType,
      intensity: SWAP_INTENSITY[newType],
      description: SWAP_DESCRIPTIONS[newType],
      planned_distance_km: newType === 'run' ? original.planned_distance_km : null,
      planned_minutes: newType === 'rest' ? null : original.planned_minutes ?? 30,
      ozzie_notes: ozzieNotes,
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (updateError) throw updateError;

  const ozzieReason =
    triggeredBy === 'trend_deload'
      ? `Ozzie de-loaded this session from ${spokenSessionType(original.session_type)} to ${spokenSessionType(newType)} — training load was climbing toward the danger zone.`
      : `You swapped today's session from ${spokenSessionType(original.session_type)} to ${spokenSessionType(newType)}.`;

  await supabase.from('plan_adjustments').insert({
    user_id: userId,
    session_id: sessionId,
    triggered_by: triggeredBy,
    original_json: { session_type: original.session_type, description: original.description },
    adjusted_json: { session_type: newType, description: SWAP_DESCRIPTIONS[newType] },
    ozzie_reason: ozzieReason,
  });

  // Otherwise today's cached daily brief (which describes the pre-swap
  // session) keeps outranking the ozzie_notes we just set above.
  await invalidateTodayDailyBrief(userId).catch(() => undefined);
}

const INDOOR_SUFFIX: Record<string, string> = {
  run: 'Treadmill',
  bike: 'Trainer',
  cross: 'Indoor',
};

/**
 * Weather-triggered swap: keeps the session type and volume intact but
 * marks it as an indoor equivalent (treadmill run, trainer ride, etc.)
 * instead of changing the training stimulus like swapTodaySession does.
 */
export async function moveSessionIndoors(userId: string, sessionId: string): Promise<void> {
  const { data: original, error: fetchError } = await supabase
    .from('training_sessions')
    .select('session_type, description')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !original) throw fetchError ?? new Error('Session not found');

  const suffix = INDOOR_SUFFIX[original.session_type] ?? 'Indoor';
  const baseDescription = (original.description ?? '').replace(/\s*\(Indoor.*\)$/i, '');

  const { error: updateError } = await supabase
    .from('training_sessions')
    .update({
      description: `${baseDescription} (${suffix})`,
      ozzie_notes: 'Moved indoors ahead of tough weather — same session, safer conditions.',
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (updateError) throw updateError;

  await invalidateTodayDailyBrief(userId).catch(() => undefined);
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
    ozzie_reason: `You compressed today's ${spokenSessionType(original.session_type)} from ${originalMinutes} to ${availableMinutes} minutes.`,
  });

  await invalidateTodayDailyBrief(userId).catch(() => undefined);
}
