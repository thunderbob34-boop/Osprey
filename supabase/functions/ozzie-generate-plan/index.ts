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

Triathlon / multisport guidance: When the goal is triathlon (or the user is training for a multisport event), balance all four disciplines across the week rather than defaulting to the hybrid run+lift split — use the given weekly swim/bike/run/lift day counts as hard targets, not suggestions. Include at least one "brick" session every 1-2 weeks: a bike session immediately followed by a short run in the same day's description (e.g. "Bike 45min + Run 10min Brick") — mark it session_type "bike" with the run noted in ozzie_notes since a session can only have one type. If a triathlonDistance is given ("sprint", "olympic", "half", "full"), scale session lengths accordingly: sprint = short/sharp (20-40min swims, 45-75min bikes, 20-40min runs), olympic = moderate (30-50min swims, 60-90min bikes, 30-50min runs), half = builds toward longer steady efforts (45-75min swims, 90-150min bikes, 45-75min runs), full = longest steady-state emphasis (60-90min swims, 2-4hr long bike, 60-100min long run) — never assign full-distance volume to a beginner in week one; ramp gradually. If the user has never done a triathlon before (fitnessLevel beginner + triathlonDistance sprint), treat this as "intro to multisport": keep every session approachable, favor completion over pace, and use ozzie_notes to explain WHY brick sessions and multisport pacing matter, not just what to do. For open-water-eligible swim sessions (outdoor season, not a pool-only context), mention sighting/drafting technique once in ozzie_notes.

Rules:
- Produce exactly 7 days, Monday through Sunday. Remaining days (beyond requested training days) are "rest".
- session_type must be one of: run, lift, swim, bike, cross, rest, race.
- intensity must be one of: easy, moderate, threshold, interval, race, rest. Rest days use "rest".
- For beginners, favor "easy" intensity and avoid back-to-back hard days.
- planned_minutes: a reasonable duration for the session type and level. null for rest days.
- planned_distance_km: for run, race, swim, and bike sessions — a reasonable distance for the session's duration, intensity, and the athlete's level (e.g. an easy run duration implies roughly a 9-11 min/mile pace, swims are much shorter than runs for the same duration). null for lift, cross, and rest days.
- description: short, e.g. "Easy Run", "Upper Body — Push", "Active Recovery Bike", "Rest Day".
- ozzie_notes: one plain-English sentence explaining why this session is placed here this week, in Ozzie's warm/direct voice.
- lift_prescription: for lift days ONLY, write the actual strength workout like a real coach: {"exercises": [{"name": string, "sets": number (2-5), "reps": string (e.g. "5" or "8-12"), "note": string|null}]} with 4-6 exercises. Main compound movement first at lower reps, accessories after at higher reps. Choose names ONLY from this exact list, matched to the day's split: Upper Push day = Bench Press, Incline Dumbbell Press, Overhead Press, Lateral Raise, Tricep Pushdown, Chest Dip. Upper Pull day = Pull-Up, Barbell Row, Lat Pulldown, Seated Cable Row, Dumbbell Row, Barbell Curl, Face Pull. Lower/Hips day = Back Squat, Deadlift, Romanian Deadlift, Hip Thrust, Bulgarian Split Squat, Leg Press, Calf Raise. Full-body/core accessory (any split) = Plank, Box Jump, Hanging Leg Raise. Use "note" for form or effort cues ("2 reps in reserve", "pause at the bottom"). For every non-lift day, set lift_prescription to null.
- interval_prescription: for swim, bike, and run days with intensity "threshold" or "interval" ONLY, write real structured sets instead of a bare duration: {"segments": [{"reps": number, "distanceM": number|null, "durationS": number|null, "effort": string, "restS": number, "label": string}]}. Exactly one of distanceM/durationS per segment — swim segments use distanceM (e.g. 50/100/200), bike segments use durationS (e.g. 180-600 for 3-10min), run segments use distanceM for track-style reps (200-1600) or durationS for tempo blocks. effort must be one of: easy, moderate, threshold, hard, max. label is a short human string like "50m hard", "800m @ threshold", or "5min @ threshold". Include a warm-up segment (effort "easy") first and a cool-down segment (effort "easy") last. 3-6 segments total. For easy/moderate days and all other session types, set interval_prescription to null.
- Respond ONLY with valid JSON: {"days": [{"dayOffset": 0-6, "session_type": string, "intensity": string, "planned_minutes": number|null, "planned_distance_km": number|null, "description": string, "ozzie_notes": string, "lift_prescription": {"exercises": [{"name": string, "sets": number, "reps": string, "note": string|null}]}|null, "interval_prescription": {"segments": [{"reps": number, "distanceM": number|null, "durationS": number|null, "effort": string, "restS": number, "label": string}]}|null}]} where dayOffset 0 = Monday.`;

interface GoalsContext {
  primaryGoal: string | null;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  weeklySwimDays?: number;
  weeklyBikeDays?: number;
  triathlonDistance?: string | null;
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
          content: `Build this week's plan for a ${goals.fitnessLevel} athlete. Goal: ${goals.primaryGoal ?? 'general fitness'}${goals.targetRace ? `, target race: ${goals.targetRace}` : ''}. Weekly run days: ${goals.weeklyRunDays}. Weekly lift days: ${goals.weeklyLiftDays}.${goals.weeklySwimDays ? ` Weekly swim days: ${goals.weeklySwimDays}.` : ''}${goals.weeklyBikeDays ? ` Weekly bike days: ${goals.weeklyBikeDays}.` : ''}${goals.triathlonDistance ? ` triathlonDistance: ${goals.triathlonDistance}.` : ''} trainingLoad: ${JSON.stringify(trainingLoad)}.`,
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
    lift_prescription: {
      exercises: Array<{ name: string; sets: number; reps: string; note: string | null }>;
    } | null;
    interval_prescription: {
      segments: Array<{
        reps: number;
        distanceM: number | null;
        durationS: number | null;
        effort: string;
        restS: number;
        label: string;
      }>;
    } | null;
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
    // ('run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness' | 'triathlon').
    const PRIMARY_GOAL_MAP: Record<string, string> = {
      hybrid: 'hybrid',
      run_performance: 'run',
      strength: 'lift',
      weight_loss: 'weight_loss',
      general: 'general_fitness',
      triathlon: 'triathlon',
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
      const mappedGoal = PRIMARY_GOAL_MAP[prefs.primaryGoal] ?? 'hybrid';
      const isTriathlon = mappedGoal === 'triathlon';

      let weeklyRunDays: number;
      let weeklyLiftDays: number;
      let weeklySwimDays: number;
      let weeklyBikeDays: number;

      if (isTriathlon) {
        // Split days roughly evenly across all four disciplines, each
        // guaranteed at least 1 day whenever the weekly total allows it.
        const total = prefs.daysPerWeek;
        weeklyBikeDays = Math.max(1, Math.round(total * 0.3));
        weeklySwimDays = Math.max(1, Math.round(total * 0.2));
        weeklyLiftDays = Math.max(1, Math.round(total * 0.2));
        weeklyRunDays = Math.max(1, total - weeklyBikeDays - weeklySwimDays - weeklyLiftDays);
      } else {
        weeklyRunDays = prefs.daysPerWeek >= 2 ? Math.ceil(prefs.daysPerWeek * 0.6) : 2;
        weeklyLiftDays = prefs.daysPerWeek >= 2 ? Math.floor(prefs.daysPerWeek * 0.4) : 1;
        // includeSwim/includeBike previously had no effect on the generated
        // plan — surface them as one dedicated day each when checked.
        weeklySwimDays = prefs.includeSwim ? 1 : 0;
        weeklyBikeDays = prefs.includeBike ? 1 : 0;
      }

      goals = {
        primaryGoal: mappedGoal,
        weeklyRunDays,
        weeklyLiftDays,
        weeklySwimDays,
        weeklyBikeDays,
        triathlonDistance: isTriathlon ? prefs.triathlonDistance ?? 'sprint' : null,
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
        lift_prescription: day.session_type === 'lift' ? day.lift_prescription ?? null : null,
        interval_prescription:
          day.session_type === 'swim' || day.session_type === 'bike' || day.session_type === 'run'
            ? day.interval_prescription ?? null
            : null,
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
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
