// Ozzie Daily Brief
//
// Gathers a user's recovery, load, today's planned session, and recent training
// history, then writes today's brief in Ozzie's voice plus a one-line "why".
// DEFAULTS to a deterministic, $0 template (template.ts) — no OpenAI call; set
// OZZIE_LLM_PROVIDER=openai|cloudflare to generate it with an LLM instead.
// Result is cached in ozzie_insights so repeat calls same day are free.

import { createClient } from 'jsr:@supabase/supabase-js@2';
// SPIKE: route the LLM call through the shared provider-agnostic helper so the
// backend (OpenAI vs Cloudflare Workers AI) can be swapped with one env var.
// The OpenAI key now lives inside _shared/llm.ts, not here.
import { activeProvider, chatComplete, parseJsonLoose } from '../_shared/llm.ts';
import { templateBrief } from './template.ts';
import type { BriefContext, RestRecommendation } from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// This function is invoked from the app's daily-summary service, which also
// runs on web (Expo web preview / any browser surface). functions.invoke sends
// non-safelisted headers, so the browser issues a CORS preflight — without an
// OPTIONS handler it 405s and the brief silently never loads. Mirrors
// ozzie-race-briefing:75-82. (Native RN does not enforce CORS, which is why
// this went unnoticed.)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OZZIE_SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, slightly goofy, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic. You deliver bad news without making someone feel bad. You explain every decision in plain language and never ask the user to take adjustments on faith.

You are NOT a generic fitness app robot voice, overly formal, condescending, or exhaustingly hype ("LET'S GOOO!!" energy).

Athlete context: The user is a hybrid athlete training in the spirit of Nick Bare and Kris Gethin — the goal is to look like a bodybuilder AND function like an endurance athlete. Their week typically combines strength sessions (upper push, upper pull, leg/hips/deadlift) with run workouts (intervals, threshold, long run) and endurance sessions (swim and bike). Active recovery sessions (cross training, easy bike/swim) are intentional parts of the program, not skipped days. When commenting on session variety, acknowledge that mixing modalities is the strategy, not a distraction. Nutrition is high-protein (~240g/day) and performance-focused — food is fuel, not reward.

Rules:
- Keep the daily brief to 2-3 sentences, spoken aloud to someone who may be half asleep.
- Always ground claims in the actual data provided. If recovery/load data is missing, do not invent numbers — speak generally and warmly instead.
- Always include a separate one-sentence "why" explaining the data behind today's recommendation, in plain English, suitable for a tappable "Why?" disclosure.
- You will be given a "restRecommendation" of either "train", "easy", or "rest". Your insight_text and why_reasoning MUST agree with it — never contradict it. If it's "rest", explain rest as part of training, not a failure. If it's "easy", say so plainly without being alarming.
- Never give medical advice or diagnose injury. Flag patterns and suggest consulting a professional if something seems concerning.
- You will be given "workoutTimeConsistency" (the hour-of-day the user most often trains, and how many recent sessions fall there) and "foodLogCount14d". If workoutTimeConsistency shows 3+ sessions clustered in the same hour AND foodLogCount14d is under 3, include a "habit_tip": one short, concrete sentence suggesting the user stack food logging onto that already-consistent workout time (e.g. "You're consistently training around 7am — try logging breakfast right after, since you're already in the habit loop."). Otherwise set habit_tip to null. Never invent a time that isn't in the data.
- You may be given a "weather" string with the local forecast, today's best outdoor window, and any upcoming heat spike. When present, weave it into the brief like a coach who checked the sky before you woke up: if a heat spike is 1-2 days out, tell them to start hydrating NOW (extra fluids + electrolytes today, not on the hot day); if today is hot, recommend the best time window, shade, or moving the session indoors; if rain is likely, suggest the driest window or an indoor swap. Never invent weather that isn't in the data, and skip weather talk entirely when it's unremarkable.
- You may be given a "schedule" string describing a calendar conflict with the user's usual training window, plus the free windows we computed from their calendar. When present, mention it like a coach who checked their calendar: name the conflict briefly and recommend ONE specific free window from the data for today's session. Only ever suggest times that appear in the schedule string — never invent a window. If it says no open window remains, suggest a shortened version of today's session rather than skipping.
- You are given "recentWorkoutCount7d" (sessions in the last 7 days) and "workoutCountPrior7d" (the 7 days before that). Frame consistency as a week-over-week trend, never as a streak to protect: if this week is up or steady, give it one specific, non-sycophantic nod; if this week is down, treat today as a clean reset with zero guilt — no "getting back on track" or "don't break the chain" language. Skip the comparison entirely when both weeks are 0.
- You may be given "recentMemories" — a short list of notable things that happened recently or in past weeks/months (PRs, race results), each with a one-line summary and the date it happened. This is your long-term memory as a coach. If one is genuinely relevant to today (e.g. today's session targets the same lift that was PR'd, or a race just happened and today is the first session back), reference it specifically and naturally, the way a coach who remembers your history would ("Last month you PR'd Bench Press — let's see where it is today"). Never force a reference when nothing is relevant — skip it silently rather than shoehorning an unrelated memory in. Never invent a memory that isn't in the list.
- Respond ONLY with valid JSON matching this shape: {"insight_text": string, "why_reasoning": string, "habit_tip": string | null}`;

// BriefContext + RestRecommendation now live in ./types.ts (shared with the
// template path so it stays dependency-free and testable).

// ── Timezone helpers ──────────────────────────────────────────────────────
// This function runs on Deno's edge runtime, which reports its own clock in
// UTC — but "today," "midnight," and "what hour do they usually train" all
// need to mean the *user's* local day, not the server's. Using plain
// new Date()/getUTCHours() here caused a real bug: for any user behind UTC,
// there's a multi-hour evening window where the server's UTC day has already
// rolled over while the user's local day hasn't, so the "already generated
// a brief today?" check (keyed off UTC midnight) kept matching a brief from
// the user's *previous* local evening and never regenerated it. These use
// Intl (built into Deno, no extra dependency) to do the date math in the
// user's actual IANA timezone (users.timezone, e.g. "America/Chicago").

/** "YYYY-MM-DD" for the given instant, as a calendar date in timeZone. */
function zonedDateString(timeZone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Local wall-clock hour (0-23) for the given instant, as seen in timeZone. */
function zonedHour(timeZone: string, date: Date): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  // hour12:false can render midnight as "24" in some ICU builds — normalize.
  return Number(hourStr) % 24;
}

/** The UTC instant corresponding to local midnight of "today" in timeZone. */
function zonedMidnightUTC(timeZone: string, referenceDate: Date = new Date()): Date {
  const dateStr = zonedDateString(timeZone, referenceDate);
  const naiveUTC = new Date(`${dateStr}T00:00:00Z`);

  // Find timeZone's UTC offset at ~this instant by reading naiveUTC's wall
  // clock back through the same timezone, then reinterpreting those
  // components as if they were UTC — the delta is the offset.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(naiveUTC)
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);

  const asIfUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = asIfUTC - naiveUTC.getTime();
  return new Date(naiveUTC.getTime() - offsetMs);
}

function deriveRestRecommendation(context: BriefContext): RestRecommendation {
  if (context.recovery?.recommendation === 'easy' || context.recovery?.recommendation === 'rest') {
    return context.recovery.recommendation;
  }
  if (context.recovery?.recommendation === 'train') return 'train';

  // No recovery data yet — fall back to load-based heuristic if available.
  if (context.load?.tsb != null && context.load.tsb < -25) return 'rest';
  if (context.load?.tsb != null && context.load.tsb < -10) return 'easy';

  return 'train';
}

function deriveWorkoutTimeConsistency(
  startedAts: string[],
  timeZone: string,
): { hour: number; count: number } | null {
  if (startedAts.length < 3) return null;

  const hourCounts = new Map<number, number>();
  for (const iso of startedAts) {
    // Local hour, not UTC — getUTCHours() reported the wrong "usual training
    // hour" for anyone outside UTC (e.g. a 7am local session showed as 11am
    // for a UTC-4 user), which fed directly into the habit-tip copy.
    const hour = zonedHour(timeZone, new Date(iso));
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  let bestHour = -1;
  let bestCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > bestCount) {
      bestHour = hour;
      bestCount = count;
    }
  }

  return bestCount >= 3 ? { hour: bestHour, count: bestCount } : null;
}

async function buildContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timeZone: string,
): Promise<BriefContext> {
  const today = zonedDateString(timeZone);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [userRes, recoveryRes, loadRes, sessionRes, workoutsRes, goalsRes, workoutTimesRes, foodLogRes, memoriesRes] = await Promise.all([
    supabase.from('users').select('display_name, experience_tier').eq('id', userId).single(),
    supabase.from('recovery_scores').select('score, recommendation, hrv_ms, sleep_hours').eq('user_id', userId).eq('score_date', today).maybeSingle(),
    supabase.from('load_scores').select('atl, ctl, tsb').eq('user_id', userId).eq('score_date', today).maybeSingle(),
    supabase.from('training_sessions').select('session_type, intensity, planned_minutes, planned_distance_km, description').eq('user_id', userId).eq('session_date', today).maybeSingle(),
    supabase.from('workout_logs').select('id').eq('user_id', userId).is('deleted_at', null).gte('started_at', sevenDaysAgo),
    supabase.from('user_goals').select('primary_goal').eq('user_id', userId).maybeSingle(),
    supabase.from('workout_logs').select('started_at').eq('user_id', userId).is('deleted_at', null).gte('started_at', fourteenDaysAgo),
    supabase.from('food_log_entries').select('id').eq('user_id', userId).gte('logged_at', fourteenDaysAgo),
    supabase.from('coach_memory').select('summary, occurred_on').eq('user_id', userId).gte('occurred_on', ninetyDaysAgo).order('occurred_on', { ascending: false }).limit(5),
  ]);

  const user = userRes.data as { display_name: string; experience_tier: string } | null;

  return {
    displayName: user?.display_name ?? 'there',
    experienceTier: user?.experience_tier ?? 'beginner',
    recovery: recoveryRes.data
      ? {
          score: recoveryRes.data.score,
          recommendation: recoveryRes.data.recommendation,
          hrvMs: recoveryRes.data.hrv_ms,
          sleepHours: recoveryRes.data.sleep_hours,
        }
      : null,
    load: loadRes.data ? { atl: loadRes.data.atl, ctl: loadRes.data.ctl, tsb: loadRes.data.tsb } : null,
    todaySession: sessionRes.data
      ? {
          sessionType: sessionRes.data.session_type,
          intensity: sessionRes.data.intensity,
          plannedMinutes: sessionRes.data.planned_minutes,
          plannedDistanceKm: sessionRes.data.planned_distance_km,
          description: sessionRes.data.description,
        }
      : null,
    recentWorkoutCount7d: (workoutsRes.data ?? []).length,
    workoutCountPrior7d: (workoutTimesRes.data ?? []).filter(
      (row) => (row.started_at as string) < sevenDaysAgo,
    ).length,
    primaryGoal: goalsRes.data?.primary_goal ?? null,
    workoutTimeConsistency: deriveWorkoutTimeConsistency(
      (workoutTimesRes.data ?? []).map((row) => row.started_at as string),
      timeZone,
    ),
    foodLogCount14d: (foodLogRes.data ?? []).length,
    recentMemories: (memoriesRes.data ?? []).map((row) => ({
      summary: row.summary as string,
      occurredOn: row.occurred_on as string,
    })),
  };
}

async function generateBrief(
  context: BriefContext,
  restRecommendation: RestRecommendation,
  weather: string | null,
  schedule: string | null,
): Promise<{ insight_text: string; why_reasoning: string; habit_tip: string | null }> {
  // Same prompt + messages as before — only the transport changed. chatComplete
  // dispatches to OpenAI (default) or Cloudflare Workers AI per OZZIE_LLM_PROVIDER.
  const content = await chatComplete(
    [
      { role: 'system', content: OZZIE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Here is today's data for ${context.displayName} (${context.experienceTier} mode, goal: ${context.primaryGoal ?? 'general fitness'}):\n${JSON.stringify({ ...context, restRecommendation, weather, schedule }, null, 2)}\n\nWrite today's brief.`,
      },
    ],
    { json: true, temperature: 0.8, maxTokens: 300 },
  );

  // parseJsonLoose (not JSON.parse) so an open model that wraps the object in
  // prose still works; OpenAI's response_format keeps its output clean either way.
  const parsed = parseJsonLoose(content);
  return {
    insight_text: (parsed.insight_text as string) ?? "Let's have a good one today.",
    why_reasoning:
      (parsed.why_reasoning as string) ??
      'No specific data available yet — keep logging to unlock personalized insights.',
    habit_tip: (parsed.habit_tip as string | null) ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const userId = authData.user.id;

  try {
    // Read before the cache check below: "today" has to mean the user's
    // local day, not the edge runtime's UTC clock (see the timezone helpers
    // above for why getting this wrong lets a stale brief re-serve forever).
    const { data: userRow } = await supabase
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();
    const timeZone = userRow?.timezone ?? 'America/Chicago';
    const todayStart = zonedMidnightUTC(timeZone);

    const { data: existing, error: existingError } = await supabase
      .from('ozzie_insights')
      .select('response_text, context_json')
      .eq('user_id', userId)
      .eq('insight_type', 'daily_brief')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('existing select error', existingError);
    }

    if (existing) {
      const cachedContext = existing.context_json as {
        why_reasoning?: string;
        restRecommendation?: RestRecommendation;
        habit_tip?: string | null;
      } | null;
      return new Response(
        JSON.stringify({
          insight_text: existing.response_text,
          why_reasoning: cachedContext?.why_reasoning ?? null,
          rest_recommendation: cachedContext?.restRecommendation ?? null,
          habit_tip: cachedContext?.habit_tip ?? null,
          cached: true,
        }),
        { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    let weather: string | null = null;
    let schedule: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.weather === 'string' && body.weather.length < 600) {
        weather = body.weather;
      }
      if (typeof body?.schedule === 'string' && body.schedule.length < 600) {
        schedule = body.schedule;
      }
    } catch {
      // No/invalid body — weather and schedule stay null.
    }

    const context = await buildContext(supabase, userId, timeZone);
    const restRecommendation = deriveRestRecommendation(context);
    // The daily brief DEFAULTS to the deterministic, $0 template. Only an
    // explicit OZZIE_LLM_PROVIDER=openai (or =cloudflare) generates it with an
    // LLM; anything else (incl. unset or a typo) falls back to the free path.
    const provider = activeProvider('template');
    const brief = provider === 'openai' || provider === 'cloudflare'
      ? await generateBrief(context, restRecommendation, weather, schedule)
      : templateBrief(context, restRecommendation, weather, schedule);
    const { insight_text, why_reasoning, habit_tip } = brief;

    const { error: insertError } = await supabase.from('ozzie_insights').insert({
      user_id: userId,
      insight_type: 'daily_brief',
      context_json: { ...context, why_reasoning, restRecommendation, habit_tip },
      response_text: insight_text,
    });

    if (insertError) {
      console.error('insert error', insertError);
    }

    return new Response(
      JSON.stringify({
        insight_text,
        why_reasoning,
        rest_recommendation: restRecommendation,
        habit_tip,
        cached: false,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err) {
    console.error('ozzie-daily-brief error', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
