// Ozzie Weekly Plan Generator — AI planning engine v1
//
// Creates a training_plan + training_week + 7 days of training_sessions
// for the current week, based on the user's goals. Idempotent: if an
// active plan with a week covering today already exists, returns it
// instead of creating a duplicate.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { validateAndClamp } from './validate.ts';
import { routeDisciplineDays, type DisciplineDays } from './goals.ts';
import { hrGuidance, type HrZoneInfo, strengthGuidance, hyroxGuidance, crossfitGuidance } from './guidance.ts';
import { enforceBackToBackLongRuns } from './backtoback.ts';
import { zonedDateString, mondayOfWeek, toDateString } from './date.ts';

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

Ultra / ultramarathon guidance: When the goal is ultra, coach for the mountains and long hours, not road-marathon pace. Run by EFFORT and heart rate, not pace — terrain scrambles pace; keep ~80% of running easy (Zone 1-2, conversational). The engine is the long run and the BACK-TO-BACK: place the two longest runs on consecutive days (a big Saturday + big Sunday) to train tired legs — progress time-on-feet, not pace. Program power-hiking on steep climbs and deliberate downhill/descent work (eccentric quad conditioning). Fuel heavily: 60-120 g/hr of carbs on long efforts and drink to thirst (do NOT overdrink). Include eccentric/downhill strength twice a week. Build volume ≤10%/week with a recovery week every 3-4 weeks. If no target race date is set, the plan runs a general base build — encourage the athlete in ozzie_notes to set a race date so the taper can be scheduled.

Rules:
- Produce exactly 7 days, Monday through Sunday. Remaining days (beyond requested training days) are "rest".
- session_type must be one of: run, lift, swim, bike, rowing, cross, rest, race.
- intensity must be one of: easy, moderate, threshold, interval, race, rest. Rest days use "rest".
- For beginners, favor "easy" intensity and avoid back-to-back hard days.
- planned_minutes: a reasonable duration for the session type and level. null for rest days.
- planned_distance_km: for run, race, swim, bike, and rowing sessions — a reasonable distance for the session's duration, intensity, and the athlete's level (e.g. an easy run duration implies roughly a 9-11 min/mile pace, swims are much shorter than runs for the same duration). null for lift, cross, and rest days.
- description: short, e.g. "Easy Run", "Upper Body — Push", "Active Recovery Bike", "Rest Day".
- ozzie_notes: one plain-English sentence explaining why this session is placed here this week, in Ozzie's warm/direct voice.
- lift_prescription: for lift days ONLY. When a STRENGTH block is given (powerlifting), program a competition lift first — name EXACTLY "Back Squat", "Bench Press", or "Deadlift" — as the top working set at the prescribed %1RM load (set "loadKg" to the kg from the STRENGTH block for that lift), sets/reps within the Prilepin caps, then back-off sets, one variation of that day's comp lift (e.g. "Front Squat" for Squat day, "Close-Grip Bench Press" for Bench day, "Sumo Deadlift" for Deadlift day), and 2-3 accessories (e.g. Barbell Row, Pull-Up, Romanian Deadlift, Tricep Pushdown, Face Pull, Plank, Hanging Leg Raise). When NO strength block is given, write the actual strength workout like a real coach: 4-6 exercises, main compound movement first at lower reps, accessories after at higher reps, loadKg null. Choose names ONLY from this exact list, matched to the day's split: Upper Push day = Bench Press, Incline Dumbbell Press, Overhead Press, Lateral Raise, Tricep Pushdown, Chest Dip. Upper Pull day = Pull-Up, Barbell Row, Lat Pulldown, Seated Cable Row, Dumbbell Row, Barbell Curl, Face Pull. Lower/Hips day = Back Squat, Deadlift, Romanian Deadlift, Hip Thrust, Bulgarian Split Squat, Leg Press, Calf Raise. Full-body/core accessory (any split) = Plank, Box Jump, Hanging Leg Raise. Shape: {"exercises": [{"name": string, "sets": number, "reps": string, "loadKg": number|null, "note": string|null}]}, 4-6 exercises, the comp lift first with its loadKg set (loadKg null for every other exercise). Every exercise name — in both branches — must be an exact, unmodified name from the app's exercise library (reuse the exact names given above; never invent, abbreviate, or pluralize a name), and the competition lift must be named EXACTLY "Back Squat", "Bench Press", or "Deadlift". For every non-lift day, set lift_prescription to null.
- interval_prescription: for swim, bike, run, and rowing days with intensity "threshold" or "interval" ONLY, write real structured sets instead of a bare duration: {"segments": [{"reps": number, "distanceM": number|null, "durationS": number|null, "effort": string, "restS": number, "label": string}]}. Exactly one of distanceM/durationS per segment — swim segments use distanceM (e.g. 50/100/200), bike segments use durationS (e.g. 180-600 for 3-10min), run segments use distanceM for track-style reps (200-1600) or durationS for tempo blocks. rowing segments use distanceM (e.g. 250/500/1000) for interval pieces or durationS for steady blocks. effort must be one of: easy, moderate, threshold, hard, max. label is a short human string like "50m hard", "800m @ threshold", or "5min @ threshold". Include a warm-up segment (effort "easy") first and a cool-down segment (effort "easy") last. 3-6 segments total. For easy/moderate days and all other session types, set interval_prescription to null.
- Zone guidance: apply the pace bands (if given) ONLY to the athlete's primary-sport sessions (run/swim/rowing). For bike, cross, and easy-cardio / cross-training sessions — and for ALL cardio when no pace bands are given (e.g. weight-loss or general-fitness plans) — target the HR zones instead. Never pace-clamp a cross-training session.
- Respond ONLY with valid JSON: {"days": [{"dayOffset": 0-6, "session_type": string, "intensity": string, "planned_minutes": number|null, "planned_distance_km": number|null, "description": string, "ozzie_notes": string, "lift_prescription": {"exercises": [{"name": string, "sets": number, "reps": string, "loadKg": number|null, "note": string|null}]}|null, "interval_prescription": {"segments": [{"reps": number, "distanceM": number|null, "durationS": number|null, "effort": string, "restS": number, "label": string}]}|null}]} where dayOffset 0 = Monday.`;

interface GoalsContext {
  primaryGoal: string | null;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  weeklySwimDays?: number;
  weeklyBikeDays?: number;
  weeklyRowDays?: number;
  triathlonDistance?: string | null;
  fitnessLevel: string;
  targetRace: string | null;
}

interface TrainingLoad {
  atl: number;
  ctl: number;
  tsb: number;
}

// Hand-narrowed copy of the app's ZoneSet — Deno edge functions can't import
// '@/...', so these mirror OSPREY-app/src/services/coaching/zones.ts and the
// calculators it wraps (calculators/running.ts, swimming.ts, rowing.ts) field
// for field, including the `.bands` nesting. Keep in sync if those change.
// `Range` allows both bounds to be null because some bands are open-ended
// (e.g. swim z1EasyRecovery.max, rowing an.min).
interface Range {
  min: number | null;
  max: number | null;
}

interface RunningPaceZones {
  thresholdSecPerMile: number;
  easy: Range;
  marathonPace: Range;
  halfMarathonPace: Range;
  tenKPace: Range;
  fiveKPace: Range;
  intervalPace: Range;
}

interface SwimPaceZones {
  cssSecPer100: number;
  z1EasyRecovery: Range;
  z2Aerobic: Range;
  z3Threshold: Range;
  z4Vo2Max: Range;
}

interface RowingZone {
  splitSecPer500: Range;
  strokeRateSpm: Range;
  percentOf2kPower: Range;
}

interface RowingTrainingZones {
  current2kSplitSecPer500: number;
  ut2: RowingZone;
  ut1: RowingZone;
  at: RowingZone;
  tr: RowingZone;
  an: RowingZone;
}

interface CyclingPowerZones {
  ftpWatts: number;
  z1ActiveRecovery: Range; z2Endurance: Range; z3Tempo: Range; z4Threshold: Range;
  z5Vo2Max: Range; z6Anaerobic: Range; z7Neuromuscular: Range; sweetSpot: Range;
}

type ZoneSet =
  | { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones }
  | { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones }
  | { kind: 'rowing'; splitSecPer500: number; bands: RowingTrainingZones }
  | { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones }
  | { kind: 'triathlon'; swim: { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones } | null; bike: { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones } | null; run: { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones } | null };

interface Envelope {
  sport: string;
  phase: string;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number;
  zones: ZoneSet | null;
  hrZones?: HrZoneInfo | null;
  fuel: { dailyCarbGByDayType: { easy: { min: number; max: number }; moderate: { min: number; max: number }; high: { min: number; max: number }; peak: { min: number; max: number } }; proteinG: { min: number; max: number }; longSessionCarbGPerHour: number };
  // Hand-narrowed mirror of StrengthPrescription (OSPREY-app/src/services/coaching/strength.ts).
  // Present only when sport === 'lift' (powerlifting); attempts is non-null only in Peak/Taper.
  strength?: {
    oneRepMaxKg: { squat: number; bench: number; deadlift: number };
    workingPercent1RM: number;
    zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
    prilepin: { repsPerSet: [number, number]; totalReps: [number, number] };
    fatG: { min: number; max: number };
    attempts: {
      squat: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
      bench: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
      deadlift: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
    } | null;
  } | null;
  // Hand-narrowed mirror of HyroxPrescription (OSPREY-app/src/services/coaching/hyrox.ts).
  // Present only when sport === 'hyrox'.
  hyrox?: {
    division: string;
    compromisedRunSplitSecPerKm: { min: number; max: number };
    stationWeights: { sledPushKg: number; sledPullKg: number; farmersCarryPerHandKg: number; sandbagLungesKg: number; wallBallKg: number };
    sodiumMgPerHour: { min: number; max: number };
    caffeineMg: { min: number; max: number };
  } | null;
  // Hand-narrowed mirror of CrossfitPrescription (OSPREY-app/src/services/coaching/crossfit.ts).
  // Present only when sport === 'crossfit'.
  crossfit?: {
    strengthLoadsKg: { backSquat: number; deadlift: number; press: number };
    workingPercent1RM: number;
    zoneName: string;
    energySystems: { system: string; minDurationSec: number; maxDurationSec: number | null; workToRest: string; purpose: string }[];
    benchmark: { name: string; timeDomain: string; athleteFranSec: number | null; franTier: string | null };
  } | null;
}

async function computeTrainingLoad(supabase: ReturnType<typeof createClient>, userId: string): Promise<TrainingLoad> {
  const since = new Date();
  since.setDate(since.getDate() - 84);

  const { data } = await supabase
    .from('workout_logs')
    .select('started_at, tss')
    .eq('user_id', userId)
    .is('deleted_at', null)
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
    .is('deleted_at', null)
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

async function generateWeekDays(goals: GoalsContext, trainingLoad: TrainingLoad, envelope?: Envelope) {
  // Per-kind pace-band guidance, switched on zones.kind. Field paths route
  // through `.bands` to match the app's ZoneSet shape (see the Envelope/zones
  // type above) — kept in sync, this reads exactly what build-envelope.ts sends.
  const z = envelope?.zones;
  const zoneGuidance = !z
    ? ''
    : z.kind === 'run'
      ? ` Run pace bands (sec/mile): easy ${z.bands.easy.min}-${z.bands.easy.max}, threshold ~${z.thresholdSecPerMile}, 10K ${z.bands.tenKPace.min}-${z.bands.tenKPace.max}, 5K/interval ${z.bands.fiveKPace.min}-${z.bands.fiveKPace.max}. Choose distances/durations so implied pace matches the band for each session's intensity.`
      : z.kind === 'swim'
        ? ` Swim CSS ~${z.cssSecPer100} s/100m; easy ${z.bands.z2Aerobic.min}-${z.bands.z2Aerobic.max}, threshold ${z.bands.z3Threshold.min}-${z.bands.z3Threshold.max} s/100m. Choose distances/durations so implied pace matches the band for each session's intensity.`
        : z.kind === 'rowing'
          ? ` Rowing 2k split ~${z.splitSecPer500} s/500m; easy (UT2) ${z.bands.ut2.splitSecPer500.min}-${z.bands.ut2.splitSecPer500.max}, threshold (AT) ${z.bands.at.splitSecPer500.min}-${z.bands.at.splitSecPer500.max} s/500m. Choose piece lengths/rest so implied split matches the band for each session's intensity.`
          : z.kind === 'triathlon'
            ? ` Triathlon — build each discipline to its own zone:` +
              (z.run ? ` Run threshold ~${z.run.thresholdSecPerMile} sec/mi (easy ${z.run.bands.easy.min}-${z.run.bands.easy.max}).` : '') +
              (z.swim ? ` Swim CSS ~${z.swim.cssSecPer100} s/100m (easy ${z.swim.bands.z2Aerobic.min}-${z.swim.bands.z2Aerobic.max}).` : '') +
              (z.bike ? ` Bike power endurance Z2 ${z.bike.bands.z2Endurance.min}-${z.bike.bands.z2Endurance.max}w, threshold Z4 ${z.bike.bands.z4Threshold.min}-${z.bike.bands.z4Threshold.max}w (advice only — do NOT pace-clamp bike).` : ' Bike: no FTP — use the HR zones for rides.')
            : ` Bike power zones (from FTP ~${z.ftpWatts}w): endurance Z2 ${z.bands.z2Endurance.min}-${z.bands.z2Endurance.max}w, threshold Z4 ${z.bands.z4Threshold.min}-${z.bands.z4Threshold.max}w. Advice only — target these watts for rides; do NOT distance/pace-clamp bike sessions.`;

  const envelopeGuidance = envelope
    ? ` COACHING ENVELOPE (hard constraints — stay inside these): phase=${envelope.phase}, week ${envelope.weekNumber}/${envelope.totalWeeks}, target weekly load ≈ ${envelope.targetWeeklyLoad} TSS, at most ${Math.round(envelope.hardSessionShareMax * 100)}% of sessions hard.` +
      zoneGuidance +
      hrGuidance(envelope.hrZones) +
      ` Daily carbs by day: easy ${envelope.fuel.dailyCarbGByDayType.easy.min}-${envelope.fuel.dailyCarbGByDayType.easy.max} g, hard ${envelope.fuel.dailyCarbGByDayType.high.min}-${envelope.fuel.dailyCarbGByDayType.high.max} g, race ${envelope.fuel.dailyCarbGByDayType.peak.min}-${envelope.fuel.dailyCarbGByDayType.peak.max} g; protein ${envelope.fuel.proteinG.min}-${envelope.fuel.proteinG.max} g/day; in-session ~${envelope.fuel.longSessionCarbGPerHour} g/hr.` +
      strengthGuidance(envelope.strength) +
      hyroxGuidance(envelope.hyrox) +
      crossfitGuidance(envelope.crossfit)
    : '';

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
          content: `Build this week's plan for a ${goals.fitnessLevel} athlete. Goal: ${goals.primaryGoal ?? 'general fitness'}${goals.targetRace ? `, target race: ${goals.targetRace}` : ''}. Weekly run days: ${goals.weeklyRunDays}. Weekly lift days: ${goals.weeklyLiftDays}.${goals.weeklySwimDays ? ` Weekly swim days: ${goals.weeklySwimDays}.` : ''}${goals.weeklyBikeDays ? ` Weekly bike days: ${goals.weeklyBikeDays}.` : ''}${goals.weeklyRowDays ? ` Weekly row days: ${goals.weeklyRowDays}.` : ''}${goals.triathlonDistance ? ` triathlonDistance: ${goals.triathlonDistance}.` : ''} trainingLoad: ${JSON.stringify(trainingLoad)}.${envelopeGuidance}`,
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
      exercises: Array<{ name: string; sets: number; reps: string; loadKg: number | null; note: string | null }>;
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
  const { data: tzRow } = await supabase.from('users').select('timezone').eq('id', userId).maybeSingle();
  const timeZone = tzRow?.timezone ?? 'America/Chicago';
  const todayStr = zonedDateString(timeZone);
  const weekStart = mondayOfWeek(todayStr);
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
      // A prior concurrent generation could have created more than one week for
      // this Monday; `.maybeSingle()` throws on 2+ rows and would block plan-gen
      // forever. Deterministically take the earliest instead of crashing.
      .order('created_at', { ascending: true })
      .limit(1)
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
    // ('run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness' | 'triathlon'
    //  | 'swim' | 'rowing' | 'hyrox' — the last three added in 20260714000003).
    const PRIMARY_GOAL_MAP: Record<string, string> = {
      hybrid: 'hybrid',
      run_performance: 'run',
      strength: 'lift',
      weight_loss: 'weight_loss',
      general: 'general_fitness',
      triathlon: 'triathlon',
      swim: 'swim',
      rowing: 'rowing',
      hyrox: 'hyrox',
      cycling: 'cycling',
      ultra: 'ultra',
      crossfit: 'crossfit',
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

      let routed: DisciplineDays;
      // Persisted to user_goals.weekly_run_days as "primary endurance days";
      // the background-regen path re-routes it by primary_goal (Step 8).
      let primaryDaysForStorage: number;

      if (isTriathlon) {
        // Split days roughly evenly across all four disciplines, each
        // guaranteed at least 1 day whenever the weekly total allows it.
        const total = prefs.daysPerWeek;
        const weeklyBikeDays = Math.max(1, Math.round(total * 0.3));
        const weeklySwimDays = Math.max(1, Math.round(total * 0.2));
        const weeklyLiftDays = Math.max(1, Math.round(total * 0.2));
        const weeklyRunDays = Math.max(1, total - weeklyBikeDays - weeklySwimDays - weeklyLiftDays);
        routed = { weeklyRunDays, weeklyLiftDays, weeklySwimDays, weeklyBikeDays, weeklyRowDays: 0 };
        primaryDaysForStorage = weeklyRunDays;
      } else {
        const primaryDays = prefs.daysPerWeek >= 2 ? Math.ceil(prefs.daysPerWeek * 0.6) : 2;
        const liftDays = prefs.daysPerWeek >= 2 ? Math.floor(prefs.daysPerWeek * 0.4) : 1;
        // includeSwim/includeBike surface as one dedicated secondary day each.
        routed = routeDisciplineDays(mappedGoal, primaryDays, liftDays, !!prefs.includeSwim, !!prefs.includeBike);
        primaryDaysForStorage = primaryDays;
      }

      goals = {
        primaryGoal: mappedGoal,
        weeklyRunDays: routed.weeklyRunDays,
        weeklyLiftDays: routed.weeklyLiftDays,
        weeklySwimDays: routed.weeklySwimDays,
        weeklyBikeDays: routed.weeklyBikeDays,
        weeklyRowDays: routed.weeklyRowDays,
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
          weekly_run_days: primaryDaysForStorage,
          weekly_lift_days: goals.weeklyLiftDays,
          fitness_level: goals.fitnessLevel,
          goal_params: (prefs.goalParams as unknown) ?? null,
        },
        { onConflict: 'user_id' },
      );
      if (goalsUpsertError) throw goalsUpsertError;
    } else if (body.raceTarget) {
      // Race plan: attach race metadata to the athlete's existing goal context
      // instead of overwriting it — a race target shouldn't reset a non-runner's
      // sport, lift days, or fitness level to running defaults.
      const race = body.raceTarget;
      const { data: raceGoalsRow } = await supabase
        .from('user_goals')
        .select('primary_goal, weekly_run_days, weekly_lift_days, fitness_level')
        .eq('user_id', userId)
        .maybeSingle();

      const rgGoal = raceGoalsRow?.primary_goal ?? 'run';
      const rgPrimaryDays = raceGoalsRow?.weekly_run_days ?? 4;
      const rgLiftDays = raceGoalsRow?.weekly_lift_days ?? 1;
      const rgRouted = routeDisciplineDays(rgGoal, rgPrimaryDays, rgLiftDays, false, false);

      goals = {
        primaryGoal: rgGoal,
        weeklyRunDays: rgRouted.weeklyRunDays,
        weeklyLiftDays: rgRouted.weeklyLiftDays,
        weeklySwimDays: rgRouted.weeklySwimDays,
        weeklyBikeDays: rgRouted.weeklyBikeDays,
        weeklyRowDays: rgRouted.weeklyRowDays,
        fitnessLevel: raceGoalsRow?.fitness_level ?? 'intermediate',
        targetRace: `${race.raceName} (${race.distance})`,
      };

      const { error: goalsUpsertError } = await supabase.from('user_goals').upsert(
        {
          user_id: userId,
          primary_goal: goals.primaryGoal,
          target_race: goals.targetRace,
          target_date: race.raceDate ?? null,
          total_weeks_planned: race.weeksOut ?? null,
          weekly_run_days: rgPrimaryDays,
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

      const bgGoal = goalsRow?.primary_goal ?? 'hybrid';
      const bgPrimaryDays = goalsRow?.weekly_run_days ?? 3;
      const bgLiftDays = goalsRow?.weekly_lift_days ?? 2;
      const bgRouted = routeDisciplineDays(bgGoal, bgPrimaryDays, bgLiftDays, false, false);

      goals = {
        primaryGoal: bgGoal,
        weeklyRunDays: bgRouted.weeklyRunDays,
        weeklyLiftDays: bgRouted.weeklyLiftDays,
        weeklySwimDays: bgRouted.weeklySwimDays,
        weeklyBikeDays: bgRouted.weeklyBikeDays,
        weeklyRowDays: bgRouted.weeklyRowDays,
        fitnessLevel: goalsRow?.fitness_level ?? 'beginner',
        targetRace: goalsRow?.target_race ?? null,
      };
    }

    // plan_type_enum only has 'run' | 'lift' | 'hybrid' | 'custom' — a swim/bike/row-only
    // plan has no dedicated value, so it must fall to 'custom' rather than mislabeling as 'run'.
    const hasOtherEndurance =
      (goals.weeklySwimDays ?? 0) > 0 || (goals.weeklyBikeDays ?? 0) > 0 || (goals.weeklyRowDays ?? 0) > 0;
    const planType = hasOtherEndurance
      ? 'custom'
      : goals.weeklyLiftDays > 0 && goals.weeklyRunDays > 0
        ? 'hybrid'
        : goals.weeklyLiftDays > 0
          ? 'lift'
          : 'run';

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

      // Force-rebuild reuses this week row instead of inserting a new one, so
      // the regenerated sessions can reflect a changed envelope (e.g. race
      // target updated mid-plan) while the week header silently goes stale.
      // Refresh it the same way the insert branch below seeds a new week — but
      // only when an envelope was actually supplied; otherwise leave the reused
      // week's existing values untouched (unchanged, backward-compatible
      // behavior for background/no-envelope regenerations).
      const envelopeForWeek = body.envelope as Envelope | undefined;
      if (envelopeForWeek) {
        const { error: weekUpdateError } = await supabase
          .from('training_weeks')
          .update({
            week_number: envelopeForWeek.weekNumber,
            focus: envelopeForWeek.phase,
            tss_target: envelopeForWeek.targetWeeklyLoad,
          })
          .eq('id', weekId);
        if (weekUpdateError) throw weekUpdateError;
      }

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

      if (planError) {
        // 23505 = the one-active-plan-per-user unique index: a concurrent
        // generation already created the active plan. Reuse the week it made
        // for this Monday instead of creating a duplicate.
        if ((planError as { code?: string }).code === '23505') {
          const { data: racedWeek } = await supabase
            .from('training_weeks')
            .select('id, training_plans!inner(user_id, status)')
            .eq('start_date', weekStartStr)
            .eq('training_plans.user_id', userId)
            .eq('training_plans.status', 'active')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (racedWeek) {
            return new Response(
              JSON.stringify({ created: false, weekId: racedWeek.id, rescheduled: [] }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          }
        }
        throw planError;
      }
      if (!plan) throw new Error('Failed to create plan');
      planId = plan.id as string;

      const { data: week, error: weekError } = await supabase
        .from('training_weeks')
        .insert({
          plan_id: planId,
          week_number: (body.envelope as Envelope | undefined)?.weekNumber ?? 1,
          start_date: weekStartStr,
          focus: (body.envelope as Envelope | undefined)?.phase ?? 'Base building',
          tss_target: (body.envelope as Envelope | undefined)?.targetWeeklyLoad ?? null,
        })
        .select('id')
        .single();

      if (weekError || !week) throw weekError ?? new Error('Failed to create week');
      weekId = week.id as string;
    }

    const days = await generateWeekDays(goals, trainingLoad, (body.envelope as Envelope | undefined));

    const envelope = body.envelope as Envelope | undefined;
    const clamped = envelope
      ? validateAndClamp(days as never, envelope as never)
      : { days, changed: [] as string[] };
    if (clamped.changed.length) console.log('envelope clamp', clamped.changed);
    const finalDays = enforceBackToBackLongRuns(clamped.days as never, goals.primaryGoal ?? '') as typeof clamped.days;

    const sessionRows = finalDays.map((day) => {
      const sessionDate = new Date(weekStart);
      sessionDate.setUTCDate(weekStart.getUTCDate() + day.dayOffset);
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
        fuel: (day as { fuel?: unknown }).fuel ?? null,
        lift_prescription: day.session_type === 'lift' ? day.lift_prescription ?? null : null,
        interval_prescription:
          day.session_type === 'swim' ||
          day.session_type === 'bike' ||
          day.session_type === 'run' ||
          day.session_type === 'rowing'
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
