import { startOfMonth } from 'date-fns';
import { supabase } from '@/services/supabase';
import { invokeGeneratePlan } from '@/services/coaching/build-envelope';
import { fetchWeekTargetKm } from '@/services/workouts';
import { getCachedWeatherBriefSummary } from '@/services/weather-context';
import { getScheduleBriefSummary } from '@/services/schedule-context';
import { localDateString } from '@/utils/date';
import type {
  DailySummaryData,
  DailySummaryViewRow,
  RecoveryRecommendation,
  TodaySessionRow,
} from '@/types/daily-summary';

function todayDateString(): string {
  return localDateString();
}

function normalizeRecommendation(value: string | null): RecoveryRecommendation {
  if (value === 'easy' || value === 'rest') return value;
  return 'train';
}

function recommendationLabel(recommendation: RecoveryRecommendation): string {
  switch (recommendation) {
    case 'train':
      return 'Ready to train';
    case 'easy':
      return 'Take it easy';
    case 'rest':
      return 'Rest today';
  }
}

function intensityToZone(intensity: string): string | undefined {
  switch (intensity) {
    case 'easy':
      return 'Zone 2';
    case 'moderate':
      return 'Zone 3';
    case 'threshold':
      return 'Zone 4';
    case 'interval':
    case 'race':
      return 'Zone 5';
    default:
      return undefined;
  }
}

function formatSessionType(sessionType: string): string {
  switch (sessionType) {
    case 'run':
      return 'Run';
    case 'lift':
      return 'Lift Session';
    case 'cross':
      return 'Cross Training';
    case 'rest':
      return 'Rest Day';
    case 'race':
      return 'Race Day';
    default:
      return sessionType.charAt(0).toUpperCase() + sessionType.slice(1);
  }
}

function loadLabelFromTsb(tsb: number | null): string {
  if (tsb == null) return '—';
  if (tsb > 5) return 'Fresh';
  if (tsb >= -10) return 'Moderate';
  return 'Fatigued';
}

async function fetchDailySummaryRow(userId: string): Promise<DailySummaryViewRow | null> {
  const { data, error } = await supabase
    .from('v_daily_summary')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchTodaySession(userId: string): Promise<TodaySessionRow | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(
      'id, session_type, intensity, planned_minutes, planned_distance_km, description, ozzie_notes',
    )
    .eq('user_id', userId)
    .eq('session_date', todayDateString())
    // A day can hold more than one session; `.maybeSingle()` throws on 2+ rows,
    // crashing Home. Deterministically take the earliest-created one.
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * True if the user has EVER had a training session generated (any date), used
 * only to disambiguate the "no session today" state: a genuinely fresh account
 * that has never had a plan vs. an established athlete whose plan simply has no
 * session scheduled today. Read AFTER invokeGeneratePlan() so a user who just
 * received their very first plan (even if today is a rest day in it) reads
 * `true`, not `false`.
 */
async function fetchHasEverPlanned(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

interface DailyBrief {
  text: string | null;
  whyReasoning: string | null;
  restRecommendation: RecoveryRecommendation | null;
  habitTip: string | null;
}

async function fetchDailyBrief(userId: string): Promise<DailyBrief> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('ozzie_insights')
    .select('response_text, context_json')
    .eq('user_id', userId)
    .eq('insight_type', 'daily_brief')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const ctx = data.context_json as {
      why_reasoning?: string;
      restRecommendation?: RecoveryRecommendation;
      habit_tip?: string | null;
    } | null;
    return {
      text: data.response_text,
      whyReasoning: ctx?.why_reasoning ?? null,
      restRecommendation: ctx?.restRecommendation ?? null,
      habitTip: ctx?.habit_tip ?? null,
    };
  }

  const [weatherSummary, scheduleSummary] = await Promise.all([
    getCachedWeatherBriefSummary(),
    getScheduleBriefSummary(userId),
  ]);
  const { data: generated, error: fnError } = await supabase.functions.invoke<{
    insight_text: string;
    why_reasoning: string;
    rest_recommendation: RecoveryRecommendation | null;
    habit_tip: string | null;
  }>('ozzie-daily-brief', {
    method: 'POST',
    body: {
      ...(weatherSummary ? { weather: weatherSummary } : {}),
      ...(scheduleSummary ? { schedule: scheduleSummary } : {}),
    },
  });

  if (fnError || !generated) {
    return { text: null, whyReasoning: null, restRecommendation: null, habitTip: null };
  }

  return {
    text: generated.insight_text,
    whyReasoning: generated.why_reasoning,
    restRecommendation: generated.rest_recommendation,
    habitTip: generated.habit_tip,
  };
}

/**
 * Clears the cached daily brief so the next fetchDailyBrief() call
 * regenerates fresh text instead of showing stale content. Needed whenever a
 * session is adjusted (swap/compress/move-indoors) — those already write a
 * fresh training_sessions.ozzie_notes, but mapSession() prefers the daily
 * brief's text when one exists.
 *
 * Deliberately NOT date-filtered: the ozzie-daily-brief edge function decides
 * whether a brief already "exists for today" using the *server's* midnight
 * (Deno edge runtime, UTC), while fetchDailyBrief's read here uses the
 * *device's* local midnight. For any user behind UTC, there's a multi-hour
 * evening window where a brief generated in local-today already reads as
 * "yesterday" to the server — the edge function then keeps re-serving it
 * indefinitely since, by its own UTC-day check, one already exists. Since
 * only the single most recent row is ever read (fetchDailyBrief orders by
 * created_at desc, limit 1), deleting every row for this user unconditionally
 * has no downside and sidesteps the timezone mismatch entirely.
 */
export async function invalidateTodayDailyBrief(userId: string): Promise<void> {
  const { error } = await supabase
    .from('ozzie_insights')
    .delete()
    .eq('user_id', userId)
    .eq('insight_type', 'daily_brief');

  if (error) throw error;
}

async function fetchMonthDistanceKm(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('total_distance_km')
    .eq('user_id', userId)
    .gte('started_at', startOfMonth(new Date()).toISOString())
    .is('deleted_at', null);

  if (error) throw error;

  return (data ?? []).reduce((sum, row) => sum + (row.total_distance_km ?? 0), 0);
}

async function fetchHabitStreak(userId: string): Promise<number> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [workoutsRes, prefsRes] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('started_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('started_at', sixtyDaysAgo),
    supabase
      .from('user_preferences')
      .select('streak_forgiveness_days')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const forgivenessDays = prefsRes.data?.streak_forgiveness_days ?? 1;

  const activeDates = new Set(
    (workoutsRes.data ?? []).map((row) => localDateString(new Date(row.started_at))),
  );

  if (activeDates.size === 0) return 0;

  const sortedDates = Array.from(activeDates)
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysBetween = (a: Date, b: Date) => Math.round(Math.abs(a.getTime() - b.getTime()) / 86400000);

  // If the most recent active day is further back than the forgiveness
  // window allows, the streak has already lapsed.
  if (daysBetween(today, sortedDates[0]) > forgivenessDays + 1) return 0;

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i += 1) {
    const gap = daysBetween(sortedDates[i - 1], sortedDates[i]);
    if (gap <= forgivenessDays + 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export function mapSession(
  session: TodaySessionRow | null,
  dailyBrief: DailyBrief,
  hasEverPlanned: boolean,
): DailySummaryData['session'] {
  const fallbackNote =
    dailyBrief.text ??
    "Ozzie is still crunching today's read. Check back after your morning brief.";

  if (!session) {
    if (dailyBrief.restRecommendation === 'rest') {
      return {
        type: 'Rest Day Recommended',
        duration: 'Recovery',
        ozzieNote: fallbackNote,
        whyReasoning: dailyBrief.whyReasoning,
        sessionId: null,
        sessionType: 'rest',
      };
    }

    if (dailyBrief.restRecommendation === 'easy') {
      return {
        type: 'Easy Day Recommended',
        duration: 'Take it easy',
        ozzieNote: fallbackNote,
        whyReasoning: dailyBrief.whyReasoning,
        sessionId: null,
        sessionType: null,
      };
    }

    // No session today and no rest/easy recommendation. This branch serves two
    // very different athletes — split them so neither sees a false promise.
    if (!hasEverPlanned) {
      // Genuinely fresh: no plan has ever been generated. Offer to build one.
      // Matches DailySummaryScreen's own no-plan fallback copy; sessionType
      // stays null so the Home CTA reads "Build My Plan" and routes to the
      // plan builder (not a phantom GPS run — see the 2026-07-21 audit F1/F-A).
      return {
        type: 'No Plan Yet',
        duration: 'Ready when you are',
        ozzieNote:
          "Tell me your sport and goal and I'll build your first week — paces, sessions, and fuel included.",
        whyReasoning: null,
        sessionId: null,
        sessionType: null,
      };
    }

    // Established athlete whose plan simply has nothing scheduled today. Use the
    // real brief if there is one, else an honest open-day line — never the
    // "still crunching" placeholder, which falsely implies a plan is coming.
    return {
      type: 'Nothing Scheduled',
      duration: 'Open day',
      ozzieNote:
        dailyBrief.text ??
        'Nothing on the calendar today — an easy shakeout or full rest both work.',
      whyReasoning: dailyBrief.whyReasoning,
      sessionId: null,
      sessionType: null,
    };
  }

  if (session.session_type === 'rest') {
    return {
      type: 'Rest Day',
      duration: 'Recovery',
      ozzieNote: session.ozzie_notes ?? dailyBrief.text ?? 'Rest up — adaptation happens on recovery days.',
      whyReasoning: dailyBrief.whyReasoning,
      sessionId: session.id,
      sessionType: session.session_type,
    };
  }

  return {
    type: session.description ?? formatSessionType(session.session_type),
    duration: session.planned_minutes ? `${session.planned_minutes} min` : '—',
    distanceKm: session.planned_distance_km,
    zone: intensityToZone(session.intensity),
    intensity: session.intensity,
    ozzieNote: dailyBrief.text ?? session.ozzie_notes ?? fallbackNote,
    whyReasoning: dailyBrief.whyReasoning,
    sessionId: session.id,
    sessionType: session.session_type,
  };
}

function mapDailySummary(
  row: DailySummaryViewRow,
  session: TodaySessionRow | null,
  dailyBrief: DailyBrief,
  monthDistanceKm: number,
  streakDays: number,
  hasEverPlanned: boolean,
  weekTargetKm?: number,
): DailySummaryData {
  const recommendation = normalizeRecommendation(row.recovery_recommendation);

  return {
    userName: row.display_name,
    recovery:
      row.recovery_score != null
        ? {
            score: row.recovery_score,
            recommendation,
            label: recommendationLabel(recommendation),
          }
        : undefined,
    session: mapSession(session, dailyBrief, hasEverPlanned),
    weekDistanceKm: row.week_distance_km ?? 0,
    weekTargetKm,
    habitTip: dailyBrief.habitTip,
    quickStats: {
      streak: streakDays > 0 ? `${streakDays} day streak` : '—',
      monthDistanceKm: monthDistanceKm,
      load: loadLabelFromTsb(row.tsb),
    },
  };
}

export async function fetchDailySummary(userId: string): Promise<DailySummaryData> {
  const [row, monthDistanceKm, weekTargetKm, streakDays] = await Promise.all([
    fetchDailySummaryRow(userId),
    fetchMonthDistanceKm(userId),
    fetchWeekTargetKm(userId),
    fetchHabitStreak(userId),
  ]);

  if (!row) {
    throw new Error('Daily summary not found for this account.');
  }

  // Always run — idempotent. Generates the week's plan if missing, and
  // detects/reschedules any missed sessions earlier in the current week
  // regardless of whether today already has a session planned.
  await invokeGeneratePlan();
  // Both read AFTER generation: fetchTodaySession sees a just-created plan, and
  // hasEverPlanned reads `true` for a user who just received their first plan
  // (even if today is a rest day in it) rather than misclassifying them fresh.
  const [session, hasEverPlanned] = await Promise.all([
    fetchTodaySession(userId),
    fetchHasEverPlanned(userId),
  ]);

  // Fetched after session resolution so the brief's own context query sees
  // the just-generated/rescheduled plan instead of a stale snapshot.
  const dailyBrief = await fetchDailyBrief(userId);

  return mapDailySummary(row, session, dailyBrief, monthDistanceKm, streakDays, hasEverPlanned, weekTargetKm);
}
