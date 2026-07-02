// Ozzie Compute Readiness — the "Life Load" score.
//
// recovery_scores (HRV/sleep/resting-HR, written from HealthKit) and
// load_scores (ATL/CTL/TSB, written from the client's training-load calc)
// already exist as separate tables read by separate surfaces — the daily
// brief reads both but never presents them together, and neither is shown
// on its own composite scale. This fuses them plus whether the athlete has
// fueled today into one 0-100 "Life Load" score with a short spoken
// explanation, cached once per day like the daily brief.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic.

Your job right now: explain the athlete's "Life Load" for today — a fused view of their recovery (HRV/sleep/resting heart rate, if connected), training load (how much they've been pushing lately vs. their fitness base), and whether they've fueled today. This is NOT just a recovery score — it's the whole picture of what they're carrying right now.

Rules:
- 2-3 sentences, spoken aloud.
- Ground every claim in the data provided. If a data source is missing (e.g. no HealthKit connection, so recovery is null), acknowledge the gap briefly rather than inventing a number, and lean on what IS available (training load, fueling).
- If recovery and load data disagree (e.g. good recovery but heavy training load, or vice versa), name the tension — that's the most useful thing you can say.
- Don't just restate the numbers — say what to actually do about it today, in plain terms.
- Never give medical advice.
- Respond ONLY with valid JSON: {"narrative": string, "why_reasoning": string}`;

interface ReadinessContext {
  recovery: { score: number; recommendation: string; hrvMs: number | null; sleepHours: number | null } | null;
  load: { atl: number; ctl: number; tsb: number; weeklyTss: number } | null;
  loggedFoodToday: boolean;
  workoutCount7d: number;
}

/**
 * A simple, transparent 0-100 blend — not a clinical score. Recovery (if
 * present) anchors it; training freshness (TSB) nudges it; fueling gives a
 * small consistency bonus. Every input is optional and degrades gracefully.
 */
function computeCompositeScore(ctx: ReadinessContext): number | null {
  const parts: number[] = [];

  if (ctx.recovery) parts.push(ctx.recovery.score);

  if (ctx.load) {
    // TSB roughly -30..+15 in practice; map to a 0-100 freshness proxy.
    const freshness = Math.max(0, Math.min(100, 60 + ctx.load.tsb * 1.5));
    parts.push(freshness);
  }

  if (parts.length === 0) return null;

  let score = parts.reduce((a, b) => a + b, 0) / parts.length;
  if (ctx.loggedFoodToday) score = Math.min(100, score + 3);
  return Math.round(score);
}

async function buildContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<ReadinessContext> {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [recoveryRes, loadRes, foodRes, workoutsRes] = await Promise.all([
    supabase.from('recovery_scores').select('score, recommendation, hrv_ms, sleep_hours').eq('user_id', userId).eq('score_date', today).maybeSingle(),
    supabase.from('load_scores').select('atl, ctl, tsb, weekly_tss').eq('user_id', userId).eq('score_date', today).maybeSingle(),
    supabase.from('food_log_entries').select('id').eq('user_id', userId).gte('logged_at', todayStart.toISOString()).limit(1),
    supabase.from('workout_logs').select('id').eq('user_id', userId).is('deleted_at', null).gte('started_at', sevenDaysAgo),
  ]);

  return {
    recovery: recoveryRes.data
      ? {
          score: recoveryRes.data.score,
          recommendation: recoveryRes.data.recommendation,
          hrvMs: recoveryRes.data.hrv_ms,
          sleepHours: recoveryRes.data.sleep_hours,
        }
      : null,
    load: loadRes.data
      ? { atl: loadRes.data.atl, ctl: loadRes.data.ctl, tsb: loadRes.data.tsb, weeklyTss: loadRes.data.weekly_tss }
      : null,
    loggedFoodToday: (foodRes.data ?? []).length > 0,
    workoutCount7d: (workoutsRes.data ?? []).length,
  };
}

async function callOpenAI(context: ReadinessContext, compositeScore: number | null): Promise<{ narrative: string; why_reasoning: string }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Life Load data:\n${JSON.stringify({ ...context, compositeScore }, null, 2)}\n\nExplain today's Life Load.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');

  const parsed = JSON.parse(content);
  return {
    narrative: parsed.narrative ?? 'Keep logging workouts and connecting Apple Health to unlock your Life Load score.',
    why_reasoning: parsed.why_reasoning ?? 'Not enough data yet to explain further.',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const userId = authData.user.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const { data: existing } = await supabase
      .from('ozzie_insights')
      .select('response_text, context_json')
      .eq('user_id', userId)
      .eq('insight_type', 'life_load')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const cachedContext = existing.context_json as { why_reasoning?: string; compositeScore?: number | null } | null;
      return new Response(
        JSON.stringify({
          narrative: existing.response_text,
          why_reasoning: cachedContext?.why_reasoning ?? null,
          composite_score: cachedContext?.compositeScore ?? null,
          cached: true,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    const context = await buildContext(supabase, userId);
    const compositeScore = computeCompositeScore(context);
    const { narrative, why_reasoning } = await callOpenAI(context, compositeScore);

    await supabase.from('ozzie_insights').insert({
      user_id: userId,
      insight_type: 'life_load',
      context_json: { ...context, why_reasoning, compositeScore },
      response_text: narrative,
    });

    return new Response(
      JSON.stringify({ narrative, why_reasoning, composite_score: compositeScore, cached: false }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
