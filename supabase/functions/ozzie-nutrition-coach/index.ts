// Ozzie Nutrition Coach — adaptive daily targets + a short coaching tip
//
// Computes calorie/macro targets adapted to today's training load and the
// user's goal, then asks GPT-4o-mini for a short coaching note comparing
// targets to what's been logged so far today. Targets are cached in
// nutrition_targets (recomputed once per day); the tip is cached in
// ozzie_insights so repeat calls the same day are free.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const OZZIE_SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, slightly goofy, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic.

The user is a hybrid athlete — combining bodybuilding-style strength training with endurance sport (running, cycling, swimming). Their philosophy: "look like a bodybuilder, function like an athlete." Food is fuel for performance, not just body composition. Protein is a non-negotiable priority every meal. Carb timing matters — more carbs around long sessions.

Rules:
- Keep the nutrition tip to 1-2 sentences.
- Ground every claim in the actual data given (target calories/macros, training session today, and what's logged so far). Never invent numbers.
- If the weightTrend has a non-null direction AND its calorieAdjustment is non-zero, the targets were just adjusted because of the scale. Mention this in plain language using weightTrend.note as your guide, so the user understands WHY their numbers changed today. If calorieAdjustment is 0, do not harp on weight.
- If little or nothing has been logged today, gently nudge toward logging rather than guessing how they're doing.
- Never give medical advice, never suggest extreme restriction or disordered eating patterns. This is a fitness app, not a diet app — frame food as fuel for training.
- Respond ONLY with valid JSON matching this shape: {"tip": string}`;

type PrimaryGoal = 'run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness';

// Weekly weight change (kg/wk) computed from recent vs. prior readings, plus
// a plain-language summary and the calorie nudge it produced. `direction` is
// null when there aren't enough readings to trust a trend yet.
interface WeightTrend {
  direction: 'gaining' | 'losing' | 'holding' | null;
  kgPerWeek: number | null;
  latestKg: number | null;
  calorieAdjustment: number;
  note: string;
}

interface NutritionContext {
  displayName: string;
  primaryGoal: PrimaryGoal | null;
  todaySession: { sessionType: string; plannedMinutes: number | null } | null;
  loggedToday: { calories: number; proteinG: number; carbsG: number; fatG: number };
  weightTrend: WeightTrend;
  target: { calories: number; proteinG: number; carbsG: number; fatG: number };
}

interface BodyMetricRow {
  recorded_on: string;
  weight_kg: number | null;
}

/**
 * Estimates weekly weight change from up to ~28 days of readings by comparing
 * the average of the most recent ~7 days against the prior window, then maps
 * the trend against the user's goal into a bounded calorie adjustment so
 * targets self-correct when the scale isn't moving the way the goal wants.
 */
function computeWeightTrend(rows: BodyMetricRow[], primaryGoal: PrimaryGoal | null): WeightTrend {
  const readings = rows
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ date: new Date(r.recorded_on), kg: Number(r.weight_kg) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const none: WeightTrend = {
    direction: null,
    kgPerWeek: null,
    latestKg: readings.length > 0 ? readings[readings.length - 1].kg : null,
    calorieAdjustment: 0,
    note: 'Not enough weigh-ins yet to read a trend — log your weight a few times this week.',
  };

  if (readings.length < 2) return none;

  const latest = readings[readings.length - 1];
  const earliest = readings[0];
  const spanDays = (latest.date.getTime() - earliest.date.getTime()) / 86400000;
  if (spanDays < 4) return none; // too short a window to trust

  // Recent window = last 7 days of data; prior window = everything before it.
  const cutoff = new Date(latest.date.getTime() - 7 * 86400000);
  const recent = readings.filter((r) => r.date >= cutoff);
  const prior = readings.filter((r) => r.date < cutoff);
  const avg = (arr: { kg: number }[]) => arr.reduce((s, r) => s + r.kg, 0) / arr.length;

  let kgPerWeek: number;
  if (prior.length > 0) {
    const recentMid = new Date((cutoff.getTime() + latest.date.getTime()) / 2);
    const priorMid = new Date((earliest.date.getTime() + cutoff.getTime()) / 2);
    const weeks = Math.max(0.5, (recentMid.getTime() - priorMid.getTime()) / (7 * 86400000));
    kgPerWeek = (avg(recent) - avg(prior)) / weeks;
  } else {
    const weeks = Math.max(0.5, spanDays / 7);
    kgPerWeek = (latest.kg - earliest.kg) / weeks;
  }

  const rounded = Math.round(kgPerWeek * 100) / 100;
  const direction: WeightTrend['direction'] =
    rounded > 0.1 ? 'gaining' : rounded < -0.1 ? 'losing' : 'holding';

  // Goal-aware nudge. Bounded to ±200 kcal so a noisy scale can't swing wildly.
  let adjustment = 0;
  let note = '';
  if (primaryGoal === 'weight_loss') {
    if (rounded >= -0.1) {
      adjustment = -200;
      note = 'Weight is holding instead of dropping, so I trimmed calories to get the scale moving again.';
    } else if (rounded < -0.75) {
      adjustment = 150;
      note = 'You\'re dropping fast — I added a few calories back to protect your training and muscle.';
    } else {
      note = 'Losing at a healthy clip — targets are right where they should be.';
    }
  } else if (primaryGoal === 'lift' || primaryGoal === 'hybrid') {
    if (rounded <= 0) {
      adjustment = 150;
      note = 'Not gaining yet, so I bumped calories up to support the muscle you\'re after.';
    } else if (rounded > 0.5) {
      adjustment = -100;
      note = 'Gaining a touch quick — I eased calories back to keep it lean.';
    } else {
      note = 'Lean gain is tracking nicely — holding targets steady.';
    }
  } else {
    // run / general fitness → maintenance
    if (rounded > 0.4) {
      adjustment = -100;
      note = 'Trending up while aiming to maintain — nudged calories down slightly.';
    } else if (rounded < -0.4) {
      adjustment = 100;
      note = 'Drifting down while aiming to maintain — added a little back to hold steady.';
    } else {
      note = 'Weight is steady, which is exactly the goal — no changes needed.';
    }
  }

  return { direction, kgPerWeek: rounded, latestKg: latest.kg, calorieAdjustment: adjustment, note };
}

// Session intensity multipliers for calorie bump (cal/min of planned activity).
// Endurance sessions (swim/bike/run) burn more than strength sessions.
const SESSION_CAL_PER_MIN: Record<string, number> = {
  run:   7,    // ~420 cal/hr moderate run
  swim:  8,    // slightly higher — open water or pool
  bike:  6,    // moderate cycling
  lift:  4,    // strength session
  cross: 5,
  race:  9,    // race effort
  rest:  0,
};

function computeTarget(
  primaryGoal: PrimaryGoal | null,
  todaySession: { sessionType: string; plannedMinutes: number | null } | null,
  weightTrend: WeightTrend,
): { calories: number; proteinG: number; carbsG: number; fatG: number } {
  // Hybrid-athlete baselines (Nick Bare / Man of Iron protocol):
  // 240g protein, ~2740 cal on training days, ~3040 on long days.
  // General / weight-loss goals start lower; pure endurance splits carbs higher.

  let proteinG = 200; // solid base for any active person
  let calories = 2400;

  if (primaryGoal === 'hybrid' || primaryGoal === 'lift') {
    // Bodybuilder-endurance hybrid: high protein, moderate surplus
    proteinG = 240;
    calories = 2740;
  } else if (primaryGoal === 'run') {
    proteinG = 180;
    calories = 2600;
  } else if (primaryGoal === 'weight_loss') {
    proteinG = 200;
    calories = 2100;
  }
  // 'general_fitness' keeps the defaults (200g / 2400)

  // Activity bump based on session type and planned duration
  if (todaySession && todaySession.sessionType !== 'rest') {
    const minutes = todaySession.plannedMinutes ?? 45;
    const ratePerMin = SESSION_CAL_PER_MIN[todaySession.sessionType] ?? 5;
    calories += Math.round(minutes * ratePerMin);
  }

  // Weight-trend correction — self-corrects when the scale doesn't match the goal.
  // Floor protects against unsafe lowballing if multiple negatives stack.
  calories = Math.max(1600, calories + weightTrend.calorieAdjustment);

  // Fat: ~26% of calories; carbs: remainder after protein and fat
  const proteinCals = proteinG * 4;
  const fatG = Math.round((calories * 0.26) / 9);
  const remainingCals = Math.max(0, calories - proteinCals - fatG * 9);
  const carbsG = Math.round(remainingCals / 4);

  return { calories: Math.round(calories), proteinG, carbsG, fatG };
}

async function buildContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<NutritionContext> {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const twentyEightDaysAgo = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

  const [userRes, goalsRes, sessionRes, foodRes, weightRes] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', userId).single(),
    supabase.from('user_goals').select('primary_goal').eq('user_id', userId).maybeSingle(),
    supabase
      .from('training_sessions')
      .select('session_type, planned_minutes')
      .eq('user_id', userId)
      .eq('session_date', today)
      .maybeSingle(),
    supabase
      .from('food_log_entries')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .gte('logged_at', todayStart.toISOString()),
    supabase
      .from('body_metrics')
      .select('recorded_on, weight_kg')
      .eq('user_id', userId)
      .gte('recorded_on', twentyEightDaysAgo)
      .order('recorded_on', { ascending: true }),
  ]);

  const user = userRes.data as { display_name: string } | null;
  const primaryGoal = (goalsRes.data?.primary_goal ?? null) as PrimaryGoal | null;
  const todaySession = sessionRes.data
    ? { sessionType: sessionRes.data.session_type, plannedMinutes: sessionRes.data.planned_minutes }
    : null;
  const weightTrend = computeWeightTrend((weightRes.data ?? []) as BodyMetricRow[], primaryGoal);

  const loggedToday = (foodRes.data ?? []).reduce(
    (acc, row) => ({
      calories: acc.calories + (row.calories ?? 0),
      proteinG: acc.proteinG + (row.protein_g ?? 0),
      carbsG: acc.carbsG + (row.carbs_g ?? 0),
      fatG: acc.fatG + (row.fat_g ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return {
    displayName: user?.display_name ?? 'there',
    primaryGoal,
    todaySession,
    loggedToday,
    weightTrend,
    target: computeTarget(primaryGoal, todaySession, weightTrend),
  };
}

async function callOpenAI(context: NutritionContext): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OZZIE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is today's nutrition data for ${context.displayName} (goal: ${context.primaryGoal ?? 'general fitness'}):\n${JSON.stringify(context, null, 2)}\n\nWrite today's nutrition tip.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 150,
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
  return parsed.tip ?? 'Keep fueling consistently — every logged meal helps me coach you better.';
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
    const context = await buildContext(supabase, userId);

    const { data: existingTarget } = await supabase
      .from('nutrition_targets')
      .select('calories, protein_g, carbs_g, fat_g, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    const targetIsStale =
      !existingTarget || new Date(existingTarget.updated_at) < todayStart;

    const target = targetIsStale ? context.target : {
      calories: existingTarget.calories,
      proteinG: existingTarget.protein_g,
      carbsG: existingTarget.carbs_g,
      fatG: existingTarget.fat_g,
    };

    if (targetIsStale) {
      await supabase.from('nutrition_targets').upsert(
        {
          user_id: userId,
          calories: target.calories,
          protein_g: target.proteinG,
          carbs_g: target.carbsG,
          fat_g: target.fatG,
        },
        { onConflict: 'user_id' },
      );
    }

    const { data: existingTip } = await supabase
      .from('ozzie_insights')
      .select('response_text')
      .eq('user_id', userId)
      .eq('insight_type', 'nutrition_tip')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let tip = existingTip?.response_text ?? null;
    if (!tip) {
      tip = await callOpenAI({ ...context, target });
      await supabase.from('ozzie_insights').insert({
        user_id: userId,
        insight_type: 'nutrition_tip',
        context_json: context,
        response_text: tip,
      });
    }

    return new Response(
      JSON.stringify({
        target,
        loggedToday: context.loggedToday,
        tip,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
