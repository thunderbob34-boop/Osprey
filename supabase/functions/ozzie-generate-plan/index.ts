// Ozzie Weekly Plan Generator — AI planning engine v1
//
// Creates a training_plan + training_week + 7 days of training_sessions
// for the current week, based on the user's goals. Idempotent: if an
// active plan with a week covering today already exists, returns it
// instead of creating a duplicate.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const PLAN_SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. You design a single week of training based on a user's goals and experience level.

The user is a hybrid athlete whose philosophy is "look like a bodybuilder, function like an athlete." When goal is hybrid:
- Alternate upper/lower strength splits so no muscle group is hit two days in a row.
- Pair run/bike/swim on the same day as strength when the user has more lift days than available days, or place them as standalone active-recovery sessions.
- Include at least one threshold or interval run per week (not two hard days back-to-back).
- Long run goes on Sunday; active recovery (bike or swim, 30-60 min easy) goes on a mid-week day.

Training load guidance: You will receive a 'trainingLoad' object with ATL (7-day fatigue), CTL (42-day fitness), and TSB (freshness = CTL - ATL). When TSB < -20, reduce next week's volume by 10-15% and flag at least one session as 'active_recovery'. When TSB > 15, the user is fresh — consider adding an intensity day. When CTL < 20, the user is early in training — keep volume moderate and don't add intervals.

Rules:
- Produce exactly 7 days, Monday through Sunday. Remaining days (beyond requested training days) are "rest".
- session_type must be one of: run, lift, swim, bike, cross, rest, race.
- intensity must be one of: easy, moderate, threshold, interval, race, rest. Rest days use "rest".
- For beginners, favor "easy" intensity and avoid back-to-back hard days.
- planned_minutes: a reasonable duration for the session type and level. null for rest days.
- planned_distance_km: for run, race, swim, and bike sessions — a reasonable distance for the session's duration, intensity, and the athlete's level (e.g. an easy run duration implies roughly a 9-11 min/mile pace, swims are much shorter than runs for the same duration). null for lift, cross, and rest days.
- description: short, e.g. "Easy Run", "Upper Body — Push", "Active Recovery Bike", "Rest Day".
- ozzie_notes: one plain-English sentence explaining why this session is placed here this week, in Ozzie's warm/direct voice.
- Respond ONLY with valid JSON: {"days": [{"dayOffset": 0-6, "session_type": string, "intensity": string, "planned_minutes": number|null, "planned_distance_km": number|null, "description": string, "ozzie_notes": string}]} where dayOffset 0 = Monday.`;

interface GoalsContext {
  primaryGoal: string | null;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  fitnessLevel: string;
  targetRace: string | null;
}

interface TrainingLoad {
  atl: number;
  ctl: number;
  tsb: number;
}

async function computeTrainingLoad(supabase: ReturnType<typeof createClient>, userId: string): Promise<TrainingLoad> {
  const since = new Date();
  since.setDate(since.getDate() - 84);

  const { data } = await supabase
    .from('workout_logs')
    .select('started_at, tss')
    .eq('user_id', userId)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: true });

  const rows = (data ?? []) as Array<{ started_at: string; tss: number | null }>;

  const tssMap: Record<string, number> = {};
  for (const row of rows) {
    const date = row.started_at.slice(0, 10);
    tssMap[date] = (tssMap[date] ?? 0) + (row.tss ?? 0);
  }

  const alphaAtl = 1 - Math.exp(-1 / 7);
  const alphaCtl = 1 - Math.exp(-1 / 42);
  let atl = 0;
  let ctl = 0;

  for (let i = 0; i < 84; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const tss = tssMap[dateStr] ?? 0;
    atl = atl + alphaAtl * (tss - atl);
    ctl = ctl + alphaCtl * (tss - ctl);
  }

  return {
    atl: Math.round(atl * 10) / 10,
    ctl: Math.round(ctl * 10) / 10,
    tsb: Math.round((ctl - atl) * 10) / 10,
  };
}

function mondayOfThisWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diff);
  return monday;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface RescheduleSwap {
  missedDate: string;
  missedDescription: string;
  newDate: string;
}

async function rescheduleMissedSessions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planId: string,
  weekId: string,
  weekStartStr: string,
  todayStr: string,
): Promise<RescheduleSwap[]> {
  const { data: weekSessions } = await supabase
    .from('training_sessions')
    .select('id, session_date, session_type, intensity, planned_minutes, planned_distance_km, description, ozzie_notes')
    .eq('week_id', weekId)
    .order('session_date', { ascending: true });

  const sessions = weekSessions ?? [];
  if (sessions.length === 0) return [];

  const { data: linkedWorkouts } = await supabase
    .from('workout_logs')
    .select('session_id')
    .in(
      'session_id',
      sessions.map((s) => s.id),
    );

  const completedSessionIds = new Set((linkedWorkouts ?? []).map((w) => w.session_id));

  const missed = sessions.filter(
    (s) => s.session_date < todayStr && s.session_type !== 'rest' && !completedSessionIds.has(s.id),
  );

  if (missed.length === 0) return [];

  // Future or today rest-day slots, not already claimed as a swap target.
  const availableRestSlots = sessions.filter((s) => s.session_date >= todayStr && s.session_type === 'rest');

  const swaps: RescheduleSwap[] = [];

  for (const missedSession of missed) {
    const slot = availableRestSlots.shift();
    if (!slot) break; // no room left this week — leave it missed, plan will naturally regenerate next week

    // Move the missed session's content into the rest slot's date, and
    // turn the missed session's original date into a rest day.
    await supabase
      .from('training_sessions')
      .update({
        session_type: missedSession.session_type,
        intensity: missedSession.intensity,
        planned_minutes: missedSession.planned_minutes,
        planned_distance_km: missedSession.planned_distance_km,
        description: missedSession.description,
        ozzie_notes: missedSession.ozzie_notes,
      })
      .eq('id', slot.id);

    await supabase
      .from('training_sessions')
      .update({
        session_type: 'rest',
        intensity: 'rest',
        planned_minutes: null,
        planned_distance_km: null,
        description: 'Rest Day',
        ozzie_notes: 'Plans changed — this slot opened up after a session moved.',
      })
      .eq('id', missedSession.id);

    swaps.push({
      missedDate: missedSession.session_date,
      missedDescription: missedSession.description ?? missedSession.session_type,
      newDate: slot.session_date,
    });
  }

  if (swaps.length > 0) {
    const reason = await generateRescheduleReason(swaps);
    await supabase.from('plan_adjustments').insert({
      user_id: userId,
      plan_id: planId,
      session_id: null,
      triggered_by: 'missed_session',
      original_json: { missed: missed.map((m) => ({ date: m.session_date, description: m.description })) },
      adjusted_json: { swaps },
      ozzie_reason: reason,
    });
  }

  return swaps;
}

async function generateRescheduleReason(swaps: RescheduleSwap[]): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "You are Ozzie, a warm and direct AI fitness coach. In ONE short sentence, explain to the user that you moved their missed session(s) to a new day this week. Be matter-of-fact and encouraging, not apologetic or alarmed. Respond with plain text only, no JSON.",
        },
        {
          role: 'user',
          content: `Moved sessions: ${swaps.map((s) => `"${s.missedDescription}" from ${s.missedDate} to ${s.newDate}`).join('; ')}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 80,
    }),
  });

  if (!response.ok) return "Looks like a session got missed — I've moved it to an open day this week.";
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "Looks like a session got missed — I've moved it to an open day this week.";
}

// ── Recalibrate: rebuild only the REMAINING days of the current week ─────────
// Triggered by the plan-adaptation banner's "Recalibrate" button. Unlike a
// force rebuild this never touches completed/past days and never deletes
// session rows — remaining sessions are updated in place (same ids), so
// nothing referencing them needs detaching and history stays intact.

const RECALIBRATE_SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app — warm, direct, Kronk-spirited. The athlete's recovery/fatigue picture changed mid-week and they asked you to recalibrate the REST of this week's training.

You are given: the remaining (not yet done) days of the current week with their currently planned sessions, what's already been completed or missed this week, the athlete's training load (ATL = 7-day fatigue, CTL = 42-day fitness, TSB = freshness = CTL - ATL), and their latest recovery score if one exists.

How to adjust:
- TSB < -20 or recovery recommendation "rest": cut remaining volume hard — convert the hardest remaining session to easy or rest, shorten the others 20-30%. Protect one quality session only if TSB is trending better later in the week.
- TSB -10 to -20 or recommendation "easy": soften intensity (threshold/interval → easy/moderate), trim 10-15% of minutes.
- TSB > 15 and recovery is good: the athlete is fresh — you may upgrade ONE easy day to a quality session, never more.
- Never schedule two hard days back-to-back. Never change a day into "race".
- Keep the overall shape sensible: if a long run remains, it stays the longest session.
- A day may also stay exactly as it is — only change what the data justifies.

Output rules:
- Return EXACTLY the same dates you were given — no more, no fewer.
- session_type: run, lift, swim, bike, cross, rest, race. intensity: easy, moderate, threshold, interval, race, rest.
- planned_minutes / planned_distance_km: numbers or null (null for rest; distance null for lift/cross/rest).
- ozzie_notes: one sentence per day, in Ozzie's voice, saying why this day is now what it is.
- summary: 1-2 sentences to show the athlete what you changed overall and why, grounded in the numbers.
- Respond ONLY with valid JSON: {"days": [{"date": "YYYY-MM-DD", "session_type": string, "intensity": string, "planned_minutes": number|null, "planned_distance_km": number|null, "description": string, "ozzie_notes": string}], "summary": string}`;

interface RemainingSession {
  id: string;
  session_date: string;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string | null;
  ozzie_notes: string | null;
}

interface RecalibratedDay {
  date: string;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string;
  ozzie_notes: string;
}

const SESSION_TYPES = new Set(['run', 'lift', 'swim', 'bike', 'cross', 'rest', 'race']);
const INTENSITIES = new Set(['easy', 'moderate', 'threshold', 'interval', 'race', 'rest']);

async function recalibrateRemainingWeek(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Record<string, unknown>> {
  const weekStartStr = toDateString(mondayOfThisWeek());
  const todayStr = toDateString(new Date());

  const { data: week } = await supabase
    .from('training_weeks')
    .select('id, plan_id, training_plans!inner(user_id, status)')
    .eq('start_date', weekStartStr)
    .eq('training_plans.user_id', userId)
    .eq('training_plans.status', 'active')
    .maybeSingle();

  if (!week) return { recalibrated: false, reason: 'no_active_plan' };

  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('id, session_date, session_type, intensity, planned_minutes, planned_distance_km, description, ozzie_notes')
    .eq('week_id', week.id)
    .order('session_date', { ascending: true });

  const all = (sessions ?? []) as RemainingSession[];
  if (all.length === 0) return { recalibrated: false, reason: 'no_active_plan' };

  const { data: linked } = await supabase
    .from('workout_logs')
    .select('session_id')
    .in('session_id', all.map((s) => s.id));
  const completedIds = new Set((linked ?? []).map((w) => w.session_id));

  const remaining = all.filter((s) => s.session_date >= todayStr && !completedIds.has(s.id));
  if (remaining.length === 0) return { recalibrated: false, reason: 'week_complete' };

  const completed = all.filter((s) => completedIds.has(s.id));
  const missed = all.filter(
    (s) => s.session_date < todayStr && s.session_type !== 'rest' && !completedIds.has(s.id),
  );

  const [trainingLoad, recoveryRes] = await Promise.all([
    computeTrainingLoad(supabase, userId),
    supabase
      .from('recovery_scores')
      .select('score, recommendation, hrv_ms, sleep_hours, score_date')
      .eq('user_id', userId)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const userMessage = JSON.stringify(
    {
      remainingDays: remaining.map((s) => ({
        date: s.session_date,
        session_type: s.session_type,
        intensity: s.intensity,
        planned_minutes: s.planned_minutes,
        planned_distance_km: s.planned_distance_km,
        description: s.description,
      })),
      completedThisWeek: completed.map((s) => ({ date: s.session_date, description: s.description })),
      missedThisWeek: missed.map((s) => ({ date: s.session_date, description: s.description })),
      trainingLoad,
      recovery: recoveryRes.data ?? null,
    },
    null,
    2,
  );

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: RECALIBRATE_SYSTEM_PROMPT },
        { role: 'user', content: `Recalibrate the rest of this week:\n${userMessage}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errText}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');
  const parsed = JSON.parse(content) as { days?: RecalibratedDay[]; summary?: string };

  if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
    throw new Error('Recalibration returned no days');
  }

  // Apply only to dates we actually offered, updating rows IN PLACE by id.
  const byDate = new Map(remaining.map((s) => [s.session_date, s]));
  const changes: Array<{
    date: string;
    before: { description: string | null; intensity: string; planned_minutes: number | null };
    after: { description: string; intensity: string; planned_minutes: number | null };
    changed: boolean;
  }> = [];

  for (const day of parsed.days) {
    const target = byDate.get(day.date);
    if (!target) continue; // model invented a date — ignore it
    if (!SESSION_TYPES.has(day.session_type) || !INTENSITIES.has(day.intensity)) continue;

    const changed =
      day.session_type !== target.session_type ||
      day.intensity !== target.intensity ||
      (day.planned_minutes ?? null) !== (target.planned_minutes ?? null) ||
      (day.planned_distance_km ?? null) !== (target.planned_distance_km ?? null);

    changes.push({
      date: day.date,
      before: {
        description: target.description,
        intensity: target.intensity,
        planned_minutes: target.planned_minutes,
      },
      after: {
        description: day.description,
        intensity: day.intensity,
        planned_minutes: day.planned_minutes,
      },
      changed,
    });

    if (changed || day.ozzie_notes) {
      const { error: updateError } = await supabase
        .from('training_sessions')
        .update({
          session_type: day.session_type,
          intensity: day.intensity,
          planned_minutes: day.planned_minutes,
          planned_distance_km: day.planned_distance_km,
          description: day.description,
          ozzie_notes: day.ozzie_notes,
        })
        .eq('id', target.id);
      if (updateError) throw updateError;
    }
  }

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'I retuned the rest of your week around how recovered you are right now.';

  await supabase.from('plan_adjustments').insert({
    user_id: userId,
    plan_id: week.plan_id,
    session_id: null,
    triggered_by: 'user_request',
    original_json: { remaining: remaining.map(({ id: _id, ...rest }) => rest), trainingLoad, recovery: recoveryRes.data ?? null },
    adjusted_json: { days: parsed.days, changes },
    ozzie_reason: summary,
  });

  return {
    recalibrated: true,
    summary,
    tsb: trainingLoad.tsb,
    changes,
    changedCount: changes.filter((c) => c.changed).length,
  };
}

async function generateWeekDays(goals: GoalsContext, trainingLoad: TrainingLoad) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Build this week's plan for a ${goals.fitnessLevel} athlete. Goal: ${goals.primaryGoal ?? 'general fitness'}${goals.targetRace ? `, target race: ${goals.targetRace}` : ''}. Weekly run days: ${goals.weeklyRunDays}. Weekly lift days: ${goals.weeklyLiftDays}. trainingLoad: ${JSON.stringify(trainingLoad)}.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 900,
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
  return parsed.days as Array<{
    dayOffset: number;
    session_type: string;
    intensity: string;
    planned_minutes: number | null;
    planned_distance_km: number | null;
    description: string;
    ozzie_notes: string;
  }>;
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
  const weekStart = mondayOfThisWeek();
  const weekStartStr = toDateString(weekStart);

  try {
    // Parse request body up front so we know whether this is an explicit,
    // user-driven rebuild (preferences / raceTarget with force=true) or the
    // silent background call fired every time the home screen loads.
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    // Mid-week recalibration is its own path: it adjusts only the remaining
    // days of the existing week in place and never creates/deletes anything.
    if (body.recalibrate === true) {
      const result = await recalibrateRemainingWeek(supabase, userId);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const forceRebuild = body.force === true && (Boolean(body.preferences) || Boolean(body.raceTarget));

    // Idempotency: does an active plan already have a week starting this Monday?
    const { data: existingWeek } = await supabase
      .from('training_weeks')
      .select('id, plan_id, training_plans!inner(user_id, status)')
      .eq('start_date', weekStartStr)
      .eq('training_plans.user_id', userId)
      .eq('training_plans.status', 'active')
      .maybeSingle();

    let sessionCountForWeek = 0;
    if (existingWeek) {
      const { count } = await supabase
        .from('training_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('week_id', existingWeek.id);
      sessionCountForWeek = count ?? 0;
    }

    // A week row with zero sessions is an orphaned/partial-failure artifact
    // (e.g. GPT call failed after the plan/week rows were already inserted).
    // Treat it the same as "no plan" instead of blocking regeneration forever.
    const existingWeekIsBroken = existingWeek != null && sessionCountForWeek === 0;

    if (existingWeek && !existingWeekIsBroken && !forceRebuild) {
      const todayStr = toDateString(new Date());
      const swaps = await rescheduleMissedSessions(
        supabase,
        userId,
        existingWeek.plan_id as string,
        existingWeek.id as string,
        weekStartStr,
        todayStr,
      );
      return new Response(JSON.stringify({ created: false, weekId: existingWeek.id, rescheduled: swaps }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Maps preferences.tsx's TrainingGoal values to the DB's primary_goal_enum
    // ('run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness').
    const PRIMARY_GOAL_MAP: Record<string, string> = {
      hybrid: 'hybrid',
      run_performance: 'run',
      strength: 'lift',
      weight_loss: 'weight_loss',
      general: 'general_fitness',
    };

    // Build goals context: explicit preferences/raceTarget from the request
    // body, or fall back to the stored user_goals row for background calls.
    // Race-target plans also persist their metadata to user_goals so the app
    // can show a countdown/phase overview that survives weekly regeneration
    // (each week's training_plans row is otherwise ephemeral).
    let goals: GoalsContext;
    if (body.preferences) {
      // Preferences from plan builder: map fields to goals context
      const prefs = body.preferences;
      goals = {
        primaryGoal: PRIMARY_GOAL_MAP[prefs.primaryGoal] ?? 'hybrid',
        weeklyRunDays: prefs.daysPerWeek >= 2 ? Math.ceil(prefs.daysPerWeek * 0.6) : 2,
        weeklyLiftDays: prefs.daysPerWeek >= 2 ? Math.floor(prefs.daysPerWeek * 0.4) : 1,
        fitnessLevel: prefs.experienceLevel ?? 'beginner',
        targetRace: null,
      };

      const { error: goalsUpsertError } = await supabase.from('user_goals').upsert(
        {
          user_id: userId,
          primary_goal: goals.primaryGoal,
          target_race: null,
          target_date: null,
          total_weeks_planned: null,
          weekly_run_days: goals.weeklyRunDays,
          weekly_lift_days: goals.weeklyLiftDays,
          fitness_level: goals.fitnessLevel,
        },
        { onConflict: 'user_id' },
      );
      if (goalsUpsertError) throw goalsUpsertError;
    } else if (body.raceTarget) {
      // Race plan: map race details to goals context
      const race = body.raceTarget;
      goals = {
        primaryGoal: 'run',
        weeklyRunDays: 4,
        weeklyLiftDays: 1,
        fitnessLevel: 'intermediate',
        targetRace: `${race.raceName} (${race.distance})`,
      };

      const { error: goalsUpsertError } = await supabase.from('user_goals').upsert(
        {
          user_id: userId,
          primary_goal: 'run',
          target_race: goals.targetRace,
          target_date: race.raceDate ?? null,
          total_weeks_planned: race.weeksOut ?? null,
          weekly_run_days: goals.weeklyRunDays,
          weekly_lift_days: goals.weeklyLiftDays,
          fitness_level: goals.fitnessLevel,
        },
        { onConflict: 'user_id' },
      );
      if (goalsUpsertError) throw goalsUpsertError;
    } else {
      // Fallback: try to fetch from user_goals table
      const { data: goalsRow } = await supabase
        .from('user_goals')
        .select('primary_goal, weekly_run_days, weekly_lift_days, fitness_level, target_race')
        .eq('user_id', userId)
        .maybeSingle();

      goals = {
        primaryGoal: goalsRow?.primary_goal ?? 'hybrid',
        weeklyRunDays: goalsRow?.weekly_run_days ?? 3,
        weeklyLiftDays: goalsRow?.weekly_lift_days ?? 2,
        fitnessLevel: goalsRow?.fitness_level ?? 'beginner',
        targetRace: goalsRow?.target_race ?? null,
      };
    }

    const planType = goals.weeklyLiftDays > 0 && goals.weeklyRunDays > 0 ? 'hybrid' : goals.weeklyLiftDays > 0 ? 'lift' : 'run';

    const trainingLoad = await computeTrainingLoad(supabase, userId);

    // Reuse the existing plan/week row when rebuilding (broken week or an
    // explicit force rebuild) instead of creating a duplicate; otherwise
    // create fresh plan + week rows for a brand new week.
    let planId: string;
    let weekId: string;

    if (existingWeek) {
      planId = existingWeek.plan_id as string;
      weekId = existingWeek.id as string;

      const { error: planUpdateError } = await supabase
        .from('training_plans')
        .update({
          name: `${goals.primaryGoal ? goals.primaryGoal.replace(/_/g, ' ') : 'General fitness'} plan`,
          plan_type: planType,
        })
        .eq('id', planId);
      if (planUpdateError) throw planUpdateError;

      // workout_logs.session_id and plan_adjustments.session_id both reference
      // training_sessions(id) with no ON DELETE CASCADE. Any row pointing at a
      // session in this week must be detached (nulled out, not deleted) before
      // the session delete below, or Postgres rejects it with an FK violation.
      const { data: oldSessions } = await supabase
        .from('training_sessions')
        .select('id')
        .eq('week_id', weekId);
      const oldSessionIds = (oldSessions ?? []).map((s) => s.id as string);

      if (oldSessionIds.length > 0) {
        const { error: detachWorkoutsError } = await supabase
          .from('workout_logs')
          .update({ session_id: null })
          .in('session_id', oldSessionIds);
        if (detachWorkoutsError) throw detachWorkoutsError;

        const { error: detachAdjustmentsError } = await supabase
          .from('plan_adjustments')
          .update({ session_id: null })
          .in('session_id', oldSessionIds);
        if (detachAdjustmentsError) throw detachAdjustmentsError;
      }

      const { error: deleteSessionsError } = await supabase
        .from('training_sessions')
        .delete()
        .eq('week_id', weekId);
      if (deleteSessionsError) throw deleteSessionsError;
    } else {
      const { data: plan, error: planError } = await supabase
        .from('training_plans')
        .insert({
          user_id: userId,
          name: `${goals.primaryGoal ? goals.primaryGoal.replace(/_/g, ' ') : 'General fitness'} plan`,
          plan_type: planType,
          start_date: weekStartStr,
          ai_generated: true,
          status: 'active',
        })
        .select('id')
        .single();

      if (planError || !plan) throw planError ?? new Error('Failed to create plan');
      planId = plan.id as string;

      const { data: week, error: weekError } = await supabase
        .from('training_weeks')
        .insert({
          plan_id: planId,
          week_number: 1,
          start_date: weekStartStr,
          focus: 'Base building',
        })
        .select('id')
        .single();

      if (weekError || !week) throw weekError ?? new Error('Failed to create week');
      weekId = week.id as string;
    }

    const days = await generateWeekDays(goals, trainingLoad);

    const sessionRows = days.map((day) => {
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(weekStart.getDate() + day.dayOffset);
      return {
        week_id: weekId,
        user_id: userId,
        session_date: toDateString(sessionDate),
        session_type: day.session_type,
        intensity: day.intensity,
        planned_minutes: day.planned_minutes,
        planned_distance_km: day.planned_distance_km,
        description: day.description,
        ozzie_notes: day.ozzie_notes,
      };
    });

    const { error: sessionsError } = await supabase.from('training_sessions').insert(sessionRows);
    if (sessionsError) throw sessionsError;

    return new Response(JSON.stringify({
      created: true,
      weekId,
      planId,
      sessionCount: sessionRows.length,
      sessions: sessionRows,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Duck-type instead of `instanceof Error` — PostgrestError and other
    // thrown values don't always share the same Error prototype chain across
    // bundled module boundaries, and String(plainObject) silently produces
    // the useless literal "[object Object]" instead of surfacing anything.
    let message: string;
    if (typeof err === 'string') {
      message = err;
    } else if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
      message = (err as { message: string }).message;
    } else {
      try {
        message = JSON.stringify(err);
      } catch {
        message = 'Unknown error';
      }
    }
    console.error('Plan generation error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
