import { startOfDay } from 'date-fns';
import { supabase } from '@/services/supabase';

/**
 * The anticipation engine — the "Jarvis" layer. Instead of asking the athlete
 * how they feel, Ozzie infers the single most important thing right now from
 * signals the app already has (recovery, today's session and whether it's done,
 * fuel timing, training-load freshness, week progress) and surfaces it as one
 * decision with the action already teed up. No input required.
 *
 * Pure and synchronous so it runs instantly and offline; the only async piece
 * is "did today's session already happen", fetched separately.
 */

export type AnticipationAction =
  | 'start_session'
  | 'recalibrate'
  | 'log_fuel'
  | 'meal_plan'
  | 'view_week'
  | 'none';

export type AnticipationTone = 'urgent' | 'positive' | 'neutral';

export interface Anticipation {
  id: string;
  priority: number;
  tone: AnticipationTone;
  icon: string;
  headline: string;
  detail: string;
  actionLabel?: string;
  action: AnticipationAction;
}

export interface AnticipationInputs {
  recovery?: { score: number; recommendation: 'train' | 'easy' | 'rest' } | null;
  sessionType?: string | null;
  sessionLabel?: string; // human label e.g. "Threshold Run"
  sessionDuration?: string; // e.g. "45 min"
  hasSession: boolean;
  completedToday: boolean;
  fuel?: { lastLoggedMinutesAgo: number | null; recommendation: 'fuel_now' | 'good_timing' | 'recently_fueled' } | null;
  tsb?: number | null; // training-load freshness (OSPREY+)
  weekMiles: number;
  weekTarget?: number | null;
}

const REST_TYPES = new Set(['rest', 'off', '', null, undefined]);

function isTrainingDay(sessionType?: string | null): boolean {
  return !!sessionType && !REST_TYPES.has(sessionType);
}

function fuelPhrase(minutesAgo: number | null): string {
  if (minutesAgo == null) return 'No food logged yet today';
  if (minutesAgo < 90) return 'Last meal was under 90 min ago';
  const hours = Math.round(minutesAgo / 60);
  return `${hours}h since your last logged meal`;
}

function prettyType(sessionType?: string | null): string {
  if (!sessionType) return 'session';
  return sessionType.charAt(0).toUpperCase() + sessionType.slice(1);
}

export function computeAnticipations(input: AnticipationInputs): Anticipation[] {
  const out: Anticipation[] = [];
  const training = isTrainingDay(input.sessionType);
  const rec = input.recovery?.recommendation;
  const score = input.recovery?.score;

  // Today's work is already done — stop nudging toward training, pivot to recovery.
  if (input.completedToday) {
    out.push({
      id: 'done',
      priority: 70,
      tone: 'positive',
      icon: '✅',
      headline: "Today's training is in the books.",
      detail: 'The work now is recovery — fuel, hydrate, and get your sleep. I\'ll have tomorrow ready.',
      actionLabel: 'Plan recovery meals',
      action: 'meal_plan',
    });
  }

  // Recovery says rest, but a training session is on the board.
  if (!input.completedToday && training && rec === 'rest') {
    out.push({
      id: 'rest-override',
      priority: 100,
      tone: 'urgent',
      icon: '🛑',
      headline: "I've flagged today for rest.",
      detail:
        score != null
          ? `Recovery's at ${score}. Forcing a hard session now digs a hole — let me ease the week around it.`
          : 'Your recovery is low today. Let me ease the week around it instead of forcing a hard session.',
      actionLabel: 'Ease my week',
      action: 'recalibrate',
    });
  }

  // Recovery down but not rock-bottom — keep it easy.
  if (!input.completedToday && training && rec === 'easy') {
    out.push({
      id: 'go-easy',
      priority: 82,
      tone: 'urgent',
      icon: '🟡',
      headline: 'Keep today easy.',
      detail:
        score != null
          ? `Recovery dipped to ${score}. I can soften the rest of this week so you bounce back faster.`
          : 'Your recovery dipped. I can soften the rest of this week so you bounce back faster.',
      actionLabel: 'Soften the week',
      action: 'recalibrate',
    });
  }

  // Fuel timing — you're about to train and haven't eaten.
  if (!input.completedToday && training && input.fuel?.recommendation === 'fuel_now') {
    out.push({
      id: 'fuel-now',
      priority: 78,
      tone: 'urgent',
      icon: '🍌',
      headline: 'Fuel up before you train.',
      detail: `${fuelPhrase(input.fuel.lastLoggedMinutesAgo)} — grab something with carbs so you don't run on empty.`,
      actionLabel: "See today's meals",
      action: 'meal_plan',
    });
  }

  // Fresh and fit — a green light to push (OSPREY+ TSB signal).
  if (!input.completedToday && training && input.tsb != null && input.tsb > 12 && rec !== 'rest' && rec !== 'easy') {
    out.push({
      id: 'fresh',
      priority: 62,
      tone: 'positive',
      icon: '⚡',
      headline: "You're fresh — green light.",
      detail: `Your form is peaking (TSB +${Math.round(input.tsb)}). Today's a strong day to attack your ${prettyType(input.sessionType).toLowerCase()}.`,
      actionLabel: `Start ${prettyType(input.sessionType)}`,
      action: 'start_session',
    });
  }

  // Default: a session is queued and ready.
  if (!input.completedToday && training && input.hasSession) {
    out.push({
      id: 'ready',
      priority: 50,
      tone: 'neutral',
      icon: '🎯',
      headline: `Today: ${input.sessionLabel ?? prettyType(input.sessionType)}.`,
      detail: input.sessionDuration
        ? `${input.sessionDuration} on the plan. Everything's set — start when you're ready.`
        : "Everything's set — start when you're ready.",
      actionLabel: 'Start now',
      action: 'start_session',
    });
  }

  // Within striking distance of the weekly goal.
  if (input.weekTarget && input.weekTarget > 0) {
    const remaining = input.weekTarget - input.weekMiles;
    if (remaining > 0.3 && remaining <= 6) {
      out.push({
        id: 'week-goal',
        priority: 44,
        tone: 'neutral',
        icon: '🏁',
        headline: "You're closing on your weekly goal.",
        detail: `${remaining.toFixed(1)} mi to go. One solid session gets you there.`,
        actionLabel: 'See the week',
        action: 'view_week',
      });
    }
  }

  // Rest day and recovery is fine — name it as intentional, not a gap.
  if (!input.completedToday && !training && rec !== 'rest') {
    out.push({
      id: 'rest-day',
      priority: 30,
      tone: 'neutral',
      icon: '😌',
      headline: 'Rest day — that\'s the plan.',
      detail: 'Nothing to grind today. Recovery is the work: eat well, move easy, sleep long.',
      actionLabel: 'Plan today\'s meals',
      action: 'meal_plan',
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

/** Did the athlete already complete a workout today (local day)? */
export async function fetchCompletedToday(userId: string): Promise<boolean> {
  const todayStart = startOfDay(new Date()).toISOString();
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .in('status', ['completed', 'partial'])
    .gte('started_at', todayStart)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}
