// supabase/functions/ozzie-daily-brief/template.ts
//
// A deterministic, ZERO-LLM daily brief. Same inputs and same output shape as
// the model path — it just assembles the prose from the already-computed data
// instead of generating it. $0, no external vendor, fully private, and the
// habit-tip rule is followed exactly (there's no model to occasionally ignore
// it). The trade: no conversational variety, and it can't judge whether a past
// PR is *relevant* to today the way the model can — so it weaves memories in by
// priority, not by meaning.
//
// Reached via OZZIE_LLM_PROVIDER=template (see index.ts). Pure — no network,
// no env, no Deno APIs — so it's trivially unit-testable.

import type { BriefContext, RestRecommendation } from './types.ts';

type Brief = { insight_text: string; why_reasoning: string; habit_tip: string | null };

export function templateBrief(
  context: BriefContext,
  rest: RestRecommendation,
  /** Intentionally unused — the app's Weather Coach card owns the forecast, so
   *  the brief no longer repeats it (see the note chain below). Kept in the
   *  signature so this stays call-compatible with the LLM path's generateBrief. */
  _weather: string | null,
  schedule: string | null,
): Brief {
  const name = context.displayName || 'there';
  const session = describeSession(context.todaySession, context.units);

  // ── Core line, driven by the (already-computed) rest recommendation ──
  let core: string;
  if (rest === 'rest') {
    core = `Rest day, ${name} — and that's the plan, not a missed one. Recovery is where the work actually sinks in, so keep it light today and you'll come back sharper.`;
  } else if (rest === 'easy') {
    core = session
      ? `Easy does it today, ${name}. ${capitalize(session)} is on deck — hold the effort back and let this week settle in.`
      : `Easy does it today, ${name} — an active-recovery kind of day. Move a little, keep it gentle, nothing that leaves a mark.`;
  } else {
    core = session
      ? `Green light today, ${name} — ${session}. You're in a good spot to put in real work.`
      : `Green light today, ${name}. Nothing's locked on the calendar, so make it count with whatever fits your day.`;
  }

  // ── One contextual note, chosen by priority (weather → schedule → trend →
  //    memory). The model would pick by relevance; the template picks by rank. ──
  // Weather is deliberately NOT surfaced here. The app renders a dedicated
  // Weather Coach card right below this note, and duplicating the forecast
  // turned the brief into a multi-day data dump ("today: high 96F, rain 19%;
  // tomorrow: ...") that buried the coaching and broke this brief's own
  // 2-3-sentence rule. The card owns weather; the brief stays a brief.
  const note =
    scheduleNote(schedule) ??
    trendNote(context) ??
    memoryNote(context);

  const insight_text = note ? `${core} ${note}` : core;

  return {
    insight_text,
    why_reasoning: buildWhy(context, rest),
    habit_tip: buildHabitTip(context),
  };
}

// ── The "why" — grounded strictly in the numbers we have ──
function buildWhy(context: BriefContext, rest: RestRecommendation): string {
  const r = context.recovery;
  if (r && Number.isFinite(r.score)) {
    const extras: string[] = [];
    if (r.sleepHours != null) extras.push(`${round1(r.sleepHours)}h sleep`);
    if (r.hrvMs != null) extras.push(`HRV ${Math.round(r.hrvMs)}ms`);
    const tail = extras.length ? ` (${extras.join(', ')})` : '';
    return `Recovery is ${Math.round(r.score)}/100${tail}, which reads as a ${rest === 'rest' ? 'rest' : rest === 'easy' ? 'hold-back' : 'go'} day.`;
  }
  const tsb = context.load?.tsb;
  if (tsb != null && Number.isFinite(tsb)) {
    const feel = tsb <= -10 ? 'carrying real fatigue' : tsb >= 5 ? 'fresh and topped up' : 'right in balance';
    return `Your form (TSB) is ${tsb > 0 ? '+' : ''}${round1(tsb)} — ${feel} — which points to a ${rest} day.`;
  }
  return `No recovery or load data has synced yet today, so this is a general read — keep logging and it sharpens up.`;
}

// ── The habit tip — the exact rule from the spec, deterministic ──
function buildHabitTip(context: BriefContext): string | null {
  const w = context.workoutTimeConsistency;
  if (w && w.count >= 3 && context.foodLogCount14d < 3) {
    return `You train consistently around ${hourLabel(w.hour)} — try logging a meal right after, while you're already in the routine.`;
  }
  return null;
}

// ── Contextual notes ──
// (No weatherNote: the Weather Coach card owns the forecast — see the note
//  chain above for why the brief no longer repeats it.)

function scheduleNote(schedule: string | null): string | null {
  return schedule ? `Calendar-wise: ${schedule}` : null;
}

function trendNote(context: BriefContext): string | null {
  const now = context.recentWorkoutCount7d;
  const prior = context.workoutCountPrior7d;
  if (now === 0 && prior === 0) return null;
  if (now > prior) return `That's ${now} session${plural(now)} this week, up from ${prior} — the consistency is showing.`;
  if (now < prior) return `${prior} last week to ${now} this week — no streak to protect, today's just a clean start.`;
  return `Steady at ${now} session${plural(now)} a week — that repeatability is the real engine.`;
}

function memoryNote(context: BriefContext): string | null {
  const m = context.recentMemories[0];
  return m ? `Still on the board: ${m.summary}.` : null;
}

// ── Small helpers ──
const MILES_PER_KM = 0.621371;

/** Distance in the athlete's own units, so the brief matches the UI's chips. */
function describeDistance(km: number, units: BriefContext['units']): string {
  return units === 'metric'
    ? `${round1(km)} km`
    : `${round1(km * MILES_PER_KM)} mi`;
}

function describeSession(
  s: BriefContext['todaySession'],
  units: BriefContext['units'],
): string | null {
  if (!s) return null;
  const bits: string[] = [];
  if (s.plannedMinutes) bits.push(`${s.plannedMinutes} min`);
  if (s.plannedDistanceKm) bits.push(describeDistance(s.plannedDistanceKm, units));
  const detail = bits.length ? ` (${bits.join(', ')})` : '';
  const intensity = s.intensity && s.intensity !== 'none' ? `${s.intensity} ` : '';
  return `your ${intensity}${s.sessionType}${detail}`;
}

function hourLabel(h: number): string {
  const normalized = ((h % 24) + 24) % 24;
  const hr = normalized % 12 || 12;
  return `${hr}${normalized < 12 ? 'am' : 'pm'}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
