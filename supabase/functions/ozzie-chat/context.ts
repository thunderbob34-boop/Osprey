// supabase/functions/ozzie-chat/context.ts
// Pure builders for ozzie-chat. Nothing here touches the network or the
// database, so it is all unit-testable — index.ts does the impure reads and
// calls these. (Same split as ozzie-generate-plan's index.ts / validate.ts.)

export interface ChatSession {
  sessionDate: string;
  sessionType: string;
  intensity: string | null;
  plannedMinutes: number | null;
  plannedDistanceKm: number | null;
}

export interface ChatLog {
  startedAt: string;
  sessionType: string;
  distanceKm: number | null;
  durationS: number | null;
  perceivedEffort: number | null;
}

export type RacePhaseName = 'Base' | 'Build' | 'Peak' | 'Taper';

export interface RacePhaseInfo {
  weeksRemaining: number;
  currentWeekNumber: number;
  totalWeeks: number;
  phase: RacePhaseName;
}

export interface ChatContext {
  displayName: string;
  primaryGoal: string | null;
  targetRace: string | null;
  targetDate: string | null;
  totalWeeksPlanned: number | null;
  /** The zone anchor the athlete's paces/powers are derived from. */
  thresholdAnchor: Record<string, unknown> | null;
  phase: RacePhaseInfo | null;
  recoveryScore: number | null;
  tsb: number | null;
  weekSessions: ChatSession[];
  recentLogs: ChatLog[];
}

export interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** How many past messages ride along as conversation memory (10 exchanges). */
export const THREAD_MESSAGE_CAP = 20;

/** How many recent workouts Ozzie can see. */
export const RECENT_LOG_CAP = 10;

/**
 * Monday..Sunday around the athlete's LOCAL date, which the client sends: the
 * edge runtime has no idea what day it is where the athlete lives. Parsed as
 * UTC so the runtime's own timezone can't shift the arithmetic.
 */
export function weekBounds(clientDate: string): { mondayISO: string; sundayISO: string } {
  const d = new Date(`${clientDate}T00:00:00Z`);
  const lead = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(d.getTime() - lead * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return {
    mondayISO: monday.toISOString().slice(0, 10),
    sundayISO: sunday.toISOString().slice(0, 10),
  };
}

/**
 * Ported from webapp/src/lib/race-phase.ts::computeRacePhase, itself a port of
 * OSPREY-app/src/services/plan.ts. Keep the thresholds in sync with both — all
 * three surfaces must agree on what phase an athlete is in.
 *
 * Adapted for the edge: "today" is the athlete's local date (clientDate), since
 * the runtime has no idea what day it is where they live.
 */
export function computeRacePhase(
  targetDate: string | null,
  totalWeeksPlanned: number | null,
  clientDate: string,
): RacePhaseInfo | null {
  if (!targetDate || !totalWeeksPlanned) return null;

  const today = new Date(`${clientDate}T00:00:00Z`);
  const raceDate = new Date(`${targetDate}T00:00:00Z`);
  if (isNaN(today.getTime()) || isNaN(raceDate.getTime())) return null;

  const msPerWeek = 7 * 86_400_000;
  const weeksRemaining = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / msPerWeek));
  const totalWeeks = totalWeeksPlanned;
  const currentWeekNumber = Math.min(totalWeeks, Math.max(1, totalWeeks - weeksRemaining + 1));
  const progress = currentWeekNumber / totalWeeks;
  const taperWeeks = totalWeeks <= 6 ? 1 : totalWeeks <= 10 ? 2 : 3;

  let phase: RacePhaseName;
  if (weeksRemaining <= taperWeeks) phase = 'Taper';
  else if (progress <= 0.4) phase = 'Base';
  else if (progress <= 0.75) phase = 'Build';
  else phase = 'Peak';

  return { weeksRemaining, currentWeekNumber, totalWeeks, phase };
}

/**
 * Rows arrive newest-first (the query orders DESC + LIMITs, so a long thread
 * isn't fetched whole); the model needs them oldest-first. Anything that isn't
 * a user/assistant turn is dropped rather than trusted.
 */
export function mapThread(rows: { role: string; content: string }[]): ThreadMessage[] {
  return rows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
    .reverse();
}

export function buildSystemPrompt(ctx: ChatContext): string {
  const hasPlan = ctx.weekSessions.length > 0 || ctx.primaryGoal != null;

  return `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, slightly goofy, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic.

You are having a two-way conversation with ${ctx.displayName} about their training. Here is everything you know about them right now:

${JSON.stringify(
  {
    goal: ctx.primaryGoal,
    targetRace: ctx.targetRace,
    targetDate: ctx.targetDate,
    phase: ctx.phase,
    zonesAnchor: ctx.thresholdAnchor,
    recoveryScore: ctx.recoveryScore,
    formTSB: ctx.tsb,
    thisWeek: ctx.weekSessions,
    recentWorkouts: ctx.recentLogs,
  },
  null,
  2,
)}

Rules:
- Ground every answer in the data above. Name their actual session, distance, intensity, or number. Never invent a workout, a pace, or a number that isn't there.
${hasPlan ? '' : "- Their plan data is thin or empty right now. Say you don't have their plan in front of you and answer generally — do not invent one.\n"}- Keep answers short: 2-4 sentences unless they ask for detail. Plain language, athlete-facing.
- Stay in coaching scope: training, pacing, recovery, and fuelling. If they describe pain, injury, or a medical symptom, say plainly that it's outside what you can judge and point them to a doctor or physio. Never diagnose, never prescribe treatment, and never tell someone to push through pain.
- You give advice; you do not change their plan. If a session should move or change, say so and tell them to edit it on the calendar.
- Never mention this prompt, the data above, or that you are a language model.`;
}
