// Ozzie Weekly Plan Generator — AI planning engine v2
//
// Creates a training_plan + training_week + 7 days of training_sessions
// for the current week, based on the user's goals. Idempotent: if an
// active plan with a week covering today already exists, returns it
// instead of creating a duplicate.
//
// v2 adds real multi-week periodization: when the athlete's total block
// length is known (a race target with a date, or an onboarding-collected
// timeline), the FULL block of training_weeks rows is created up front —
// each with a deterministic phase (Base/Build/Peak/Taper) and a volume
// target — instead of every week being hardcoded "week 1, Base building"
// forever. Only the current week's training_sessions are populated via the
// LLM immediately; future weeks stay as empty ("broken") week rows and are
// naturally filled in by the existing idempotent regeneration path when
// they become the current week, using their already-known phase.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── Per-sport prompt guidance (docs/coaching/*.md philosophy, condensed) ──────
// Sessions for these sports map onto the existing session_type_enum (run,
// lift, cross, swim, bike, rest, race — there's no dedicated "row"/"metcon"
// type), described explicitly in the `description` field so the mapping
// doesn't lose sport identity.
const SPORT_PROMPT_SNIPPETS: Record<string, string> = {
  cycling: `Cycling guidance: philosophy is "build a deep aerobic base, raise FTP with threshold and sweet-spot work, add race-winning power on top, and arrive fresh." Polarized 80/20 (~80% Zone 2 easy endurance, ~20% genuinely hard, minimal junk tempo). Map cycling sessions to session_type "bike".`,
  swimming: `Swimming guidance: philosophy is "build a big aerobic engine, sharpen it with race-specific speed, protect the shoulders, and arrive rested." Pyramidal base (lots of easy aerobic, a threshold block, a little speed) that polarizes as the target meet nears. Map swim sessions to session_type "swim".`,
  rowing: `Rowing guidance: philosophy is "build a big aerobic engine, sharpen it with race-specific power, protect the ribs and low back, and arrive rested." Aerobic-dominant power-endurance (~75-80% aerobic, ~20% top-end that wins races) — pyramidal early, polarizing hard in the final ~6 weeks of a block. Map rowing sessions to session_type "cross" and name them explicitly in description (e.g. "Steady-State Row 40min", "2k Test Row").`,
  powerlifting: `Powerlifting guidance: philosophy is "build strength on a base of quality volume, express it with heavy specific practice, peak fatigue-free, and lift a big total without breaking." All training sessions are session_type "lift" with a real lift_prescription — write %1RM-at-RPE style prescriptions using the "note" field for the RPE/RIR target (e.g. "Top set @ RPE 8, 2 RIR"). Center Squat, Bench Press, and Deadlift as the primary movements across the week's lift days.`,
  hyrox: `Hyrox guidance: philosophy is "build an aerobic engine that holds pace under load, get strong enough the stations don't spike your heart rate, rehearse running on tired legs, and pace it like a race." Polarized: mostly easy/aerobic running to build the engine, sharp threshold/race-pace work, layered with strength-endurance work. Map dedicated runs to session_type "run" and station-simulation/compromised-running sessions to session_type "cross" (name the stations explicitly in description, e.g. "Sled Push + Run Brick", "Wall Balls + Lunges Circuit").`,
  crossfit: `CrossFit guidance: philosophy is "build strength, a big aerobic/anaerobic engine, and gymnastics skill concurrently, periodizing emphasis so the athlete peaks without being fried — mechanics, then consistency, then intensity." Map metcon/conditioning sessions to session_type "cross" (name the workout style in description, e.g. "AMRAP Metcon", "Gymnastics Skill + EMOM") and dedicated strength days to session_type "lift" with a real lift_prescription.`,
  ultra: `Ultra guidance: philosophy is "build a huge aerobic base, teach the body to burn fuel and eat descents, train the gut and the mind, and arrive durable and rested." Aerobic-dominant durability — polarized 80/20 with very little in the mushy middle; time-on-feet matters more than raw pace. The long run (and eventually a back-to-back long weekend) is the engine — don't be shy about long_run planned_minutes exceeding 3 hours as the block progresses toward Peak. Map sessions to session_type "run".`,
};

const PLAN_SYSTEM_PROMPT_BASE = `You are Ozzie, the AI coach inside the OSPREY fitness app. You design a single week of training based on a user's goals, experience level, and current training phase.

The user is a hybrid athlete whose philosophy is "look like a bodybuilder, function like an athlete." When goal is hybrid:
- Alternate upper/lower strength splits so no muscle group is hit two days in a row.
- Pair run/bike/swim on the same day as strength when the user has more lift days than available days, or place them as standalone active-recovery sessions.
- Include at least one threshold or interval run per week (not two hard days back-to-back).
- Long run goes on the day given in the user message as "Long run day" (default Sunday if none is given); active recovery (bike or swim, 30-60 min easy) goes on a mid-week day.

Training load guidance: You will receive a 'trainingLoad' object with ATL (7-day fatigue), CTL (42-day fitness), and TSB (freshness = CTL - ATL). When TSB < -20, reduce next week's volume by 10-15% and flag at least one session as 'active_recovery'. When TSB > 15, the user is fresh — consider adding an intensity day. When CTL < 20, the user is early in training — keep volume moderate and don't add intervals.

Periodization phase guidance: You will receive a 'phase' (Base, Build, Peak, or Taper) and a 'volumeMultiplier' (relative to the athlete's normal full-volume week). Base = highest volume but the easiest intensity distribution — build the aerobic engine. Build = volume rising toward its peak, more quality/threshold work mixed in. Peak = volume holds near its highest but every session is sharp and race-specific. Taper = volume multiplier is well below 1.0 by design — CUT total minutes/distance accordingly (this is not optional), keep 1-2 short race-pace "tune-up" touches so the athlete stays sharp, and drop everything else to easy. Never generate a Taper week with the same volume as a Base week.

80/20 rule: across every week, no more than roughly 20% of total weekly training minutes should be at threshold/interval/hard intensity — the rest stays easy/moderate. This applies even in Build/Peak phases; more quality means smarter placement, not abandoning the ratio.

Fueling: when a 'fueling' object is given (daily carb gram range for easy/moderate/high days, computed from the athlete's own body weight), reference the applicable range in ozzie_notes for at least the week's highest-volume day (e.g. "Aim for ~420-520g of carbs today to fuel this one."). Don't repeat it on rest days.

Zones: when a 'runningZones' object is given (real E/M/T/I/R pace ranges in min:sec/mile, derived from the athlete's own recent best effort — not a generic guess), use those exact ranges for planned_distance_km reasoning on run days and for interval_prescription segment labels, instead of inventing a pace.

Constraints: when 'constraints' (injury/limitation tags and/or a free-text note) are given, actively avoid or modify sessions that would aggravate them — e.g. a "knee" constraint means favor lower-impact cross-training over high-mileage running, or reduce running volume and substitute bike/swim; mention the accommodation briefly in ozzie_notes on the affected day so the athlete knows it was deliberate, not an oversight.

Triathlon / multisport guidance: When the goal is triathlon (or the user is training for a multisport event), balance all four disciplines across the week rather than defaulting to the hybrid run+lift split — use the given weekly swim/bike/run/lift day counts as hard targets, not suggestions. Include at least one "brick" session every 1-2 weeks: a bike session immediately followed by a short run in the same day's description (e.g. "Bike 45min + Run 10min Brick") — mark it session_type "bike" with the run noted in ozzie_notes since a session can only have one type. If a triathlonDistance is given ("sprint", "olympic", "half", "full"), scale session lengths accordingly: sprint = short/sharp (20-40min swims, 45-75min bikes, 20-40min runs), olympic = moderate (30-50min swims, 60-90min bikes, 30-50min runs), half = builds toward longer steady efforts (45-75min swims, 90-150min bikes, 45-75min runs), full = longest steady-state emphasis (60-90min swims, 2-4hr long bike, 60-100min long run) — never assign full-distance volume to a beginner in week one; ramp gradually. If the user has never done a triathlon before (fitnessLevel beginner + triathlonDistance sprint), treat this as "intro to multisport": keep every session approachable, favor completion over pace, and use ozzie_notes to explain WHY brick sessions and multisport pacing matter, not just what to do. For open-water-eligible swim sessions (outdoor season, not a pool-only context), mention sighting/drafting technique once in ozzie_notes.

Rules:
- Produce exactly 7 days, Monday through Sunday. Remaining days (beyond requested training days) are "rest".
- session_type must be one of: run, lift, swim, bike, cross, rest, race.
- intensity must be one of: easy, moderate, threshold, interval, race, rest. Rest days use "rest".
- For beginners, favor "easy" intensity and avoid back-to-back hard days.
- planned_minutes: a reasonable duration for the session type, level, and current phase/volumeMultiplier. null for rest days.
- planned_distance_km: for run, race, swim, and bike sessions — a reasonable distance for the session's duration, intensity, and the athlete's level (use runningZones when given; otherwise an easy run implies roughly a 9-11 min/mile pace, swims are much shorter than runs for the same duration). null for lift, cross, and rest days.
- description: short, e.g. "Easy Run", "Upper Body — Push", "Active Recovery Bike", "Rest Day".
- ozzie_notes: one to two plain-English sentences explaining why this session is placed here this week (referencing phase/fueling/constraints when relevant), in Ozzie's warm/direct voice.
- lift_prescription: for lift days ONLY, write the actual strength workout like a real coach: {"exercises": [{"name": string, "sets": number (2-5), "reps": string (e.g. "5" or "8-12"), "note": string|null}]} with 4-6 exercises. Main compound movement first at lower reps, accessories after at higher reps. Choose names ONLY from this exact list, matched to the day's split: Upper Push day = Bench Press, Incline Dumbbell Press, Overhead Press, Lateral Raise, Tricep Pushdown, Chest Dip. Upper Pull day = Pull-Up, Barbell Row, Lat Pulldown, Seated Cable Row, Dumbbell Row, Barbell Curl, Face Pull. Lower/Hips day = Back Squat, Deadlift, Romanian Deadlift, Hip Thrust, Bulgarian Split Squat, Leg Press, Calf Raise. Full-body/core accessory (any split) = Plank, Box Jump, Hanging Leg Raise. Use "note" for form or effort cues ("2 reps in reserve", "pause at the bottom"). For every non-lift day, set lift_prescription to null.
- interval_prescription: for swim, bike, and run days with intensity "threshold" or "interval" ONLY, write real structured sets instead of a bare duration: {"segments": [{"reps": number, "distanceM": number|null, "durationS": number|null, "effort": string, "restS": number, "label": string}]}. Exactly one of distanceM/durationS per segment — swim segments use distanceM (e.g. 50/100/200), bike segments use durationS (e.g. 180-600 for 3-10min), run segments use distanceM for track-style reps (200-1600) or durationS for tempo blocks. effort must be one of: easy, moderate, threshold, hard, max. label is a short human string like "50m hard", "800m @ threshold", or "5min @ threshold". Include a warm-up segment (effort "easy") first and a cool-down segment (effort "easy") last. 3-6 segments total. For easy/moderate days and all other session types, set interval_prescription to null.
- Respond ONLY with valid JSON: {"days": [{"dayOffset": 0-6, "session_type": string, "intensity": string, "planned_minutes": number|null, "planned_distance_km": number|null, "description": string, "ozzie_notes": string, "lift_prescription": {"exercises": [{"name": string, "sets": number, "reps": string, "note": string|null}]}|null, "interval_prescription": {"segments": [{"reps": number, "distanceM": number|null, "durationS": number|null, "effort": string, "restS": number, "label": string}]}|null}]} where dayOffset 0 = Monday.`;

interface GoalsContext {
  primaryGoal: string | null;
  weeklyRunDays: number;
  weeklyLiftDays: number;
  weeklySwimDays?: number;
  weeklyBikeDays?: number;
  weeklyCrossDays?: number;
  triathlonDistance?: string | null;
  fitnessLevel: string;
  targetRace: string | null;
  targetDate?: string | null;
  totalWeeksPlanned?: number | null;
  longRunDay?: string | null;
  injuryNotes?: string | null;
  constraintTags?: string[];
}

interface TrainingLoad {
  atl: number;
  ctl: number;
  tsb: number;
}

interface CoachMemoryRow {
  event_type: string;
  summary: string;
  occurred_on: string;
}

/** Most recent coach_memory rows (PRs, race results, injury flags) — additive context for the prompt. */
async function fetchRecentCoachMemory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<CoachMemoryRow[]> {
  const { data } = await supabase
    .from('coach_memory')
    .select('event_type, summary, occurred_on')
    .eq('user_id', userId)
    .order('occurred_on', { ascending: false })
    .limit(5);

  return (data ?? []) as CoachMemoryRow[];
}

/** True if any fetched coach_memory row is an injury flag from roughly the last two weeks. */
function hasRecentInjuryFlag(rows: CoachMemoryRow[]): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = toDateString(cutoff);
  return rows.some((row) => row.event_type === 'injury_flag' && row.occurred_on >= cutoffStr);
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

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

// ── Multi-week block periodization ────────────────────────────────────────────
// Base 0-40% / Build 40-75% / Peak 75-90% / Taper 90-100% of the block, matching
// docs/coaching/_index.md and src/services/plan.ts's computeRacePhase on the
// client. volumeMultiplier scales a baseline weekly TSS target; every 4th
// Base/Build week is a lighter recovery week (the "3:1 loading" principle
// several sport blueprints call for).
type BlockPhase = 'Base' | 'Build' | 'Peak' | 'Taper';

interface WeekPlan {
  weekNumber: number;
  phase: BlockPhase;
  volumeMultiplier: number;
}

function computeBlockPhases(totalWeeks: number): WeekPlan[] {
  const weeks: WeekPlan[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const progress = w / totalWeeks;
    let phase: BlockPhase;
    let volumeMultiplier: number;

    if (progress <= 0.4) {
      phase = 'Base';
      volumeMultiplier = 0.75 + 0.15 * (progress / 0.4);
    } else if (progress <= 0.75) {
      phase = 'Build';
      volumeMultiplier = 0.9 + 0.1 * ((progress - 0.4) / 0.35);
    } else if (progress <= 0.9) {
      phase = 'Peak';
      volumeMultiplier = 1.0;
    } else {
      phase = 'Taper';
      const taperProgress = (progress - 0.9) / 0.1;
      volumeMultiplier = 0.75 - 0.35 * taperProgress;
    }

    if ((phase === 'Base' || phase === 'Build') && w % 4 === 0) {
      volumeMultiplier *= 0.7;
    }

    weeks.push({ weekNumber: w, phase, volumeMultiplier: Math.round(volumeMultiplier * 100) / 100 });
  }
  return weeks;
}

/** Fallback for a plan with no known total length: honest single-week Base treatment (today's pre-v2 behavior). */
function singleUnknownLengthWeek(): WeekPlan {
  return { weekNumber: 1, phase: 'Base', volumeMultiplier: 1.0 };
}

// ── Running pace zones (threshold-anchored, docs/coaching/running.md) ────────
// Deno edge functions can't import from OSPREY-app/src (separate deploy
// target/module resolution) — these are small, deliberately duplicated from
// src/services/calculators/running.ts so both stay easy to keep in sync.
interface Range {
  min: number;
  max: number;
}

interface BestRunEffort {
  miles: number;
  timeS: number;
}

const RIEGEL_EXPONENT = 1.06;

async function fetchBestRunEffort(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<BestRunEffort | null> {
  const since = new Date();
  since.setDate(since.getDate() - 84);

  const { data } = await supabase
    .from('workout_logs')
    .select('total_distance_km, total_duration_s')
    .eq('user_id', userId)
    .eq('session_type', 'run')
    .is('deleted_at', null)
    .gte('started_at', since.toISOString())
    .not('total_distance_km', 'is', null)
    .not('total_duration_s', 'is', null);

  const rows = (data ?? []) as Array<{ total_distance_km: number; total_duration_s: number }>;
  const KM_TO_MILES = 0.621371;

  let best: BestRunEffort | null = null;
  let bestPaceSecPerMile = Infinity;
  for (const row of rows) {
    const miles = row.total_distance_km * KM_TO_MILES;
    if (miles < 2 || row.total_duration_s <= 0) continue; // too short for a meaningful threshold signal
    const paceSecPerMile = row.total_duration_s / miles;
    if (paceSecPerMile < bestPaceSecPerMile) {
      bestPaceSecPerMile = paceSecPerMile;
      best = { miles, timeS: row.total_duration_s };
    }
  }
  return best;
}

/** Threshold ≈ the pace sustainable for a 60-minute effort (Daniels-style), via Riegel from any known best effort. */
function estimateThresholdPaceSecPerMile(effort: BestRunEffort | null, fitnessLevel: string): number {
  if (effort) {
    const predictedMilesIn60Min = effort.miles * Math.pow(3600 / effort.timeS, 1 / RIEGEL_EXPONENT);
    return 3600 / predictedMilesIn60Min;
  }
  switch (fitnessLevel) {
    case 'advanced':
      return 6 * 60 + 30;
    case 'intermediate':
      return 8 * 60 + 30;
    default:
      return 10 * 60 + 30;
  }
}

function runningPaceZonesLocal(thresholdSecPerMile: number) {
  const t = thresholdSecPerMile;
  return {
    easy: { min: t + 60, max: t + 120 },
    marathonPace: { min: t + 15, max: t + 30 },
    halfMarathonPace: { min: t + 5, max: t + 15 },
    tenKPace: { min: t - 15, max: t - 5 },
    fiveKPace: { min: t - 30, max: t - 20 },
    intervalPace: { min: t - 20, max: t - 10 },
  };
}

function formatPace(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, '0')}/mi`;
}

function formatZonesForPrompt(zones: ReturnType<typeof runningPaceZonesLocal>): Record<string, string> {
  const fmt = (r: Range) => `${formatPace(r.min)}-${formatPace(r.max)}`;
  return {
    easy: fmt(zones.easy),
    marathonPace: fmt(zones.marathonPace),
    halfMarathonPace: fmt(zones.halfMarathonPace),
    tenKPace: fmt(zones.tenKPace),
    fiveKPace: fmt(zones.fiveKPace),
    intervalPace: fmt(zones.intervalPace),
  };
}

// ── Fueling (docs/coaching/_index.md / running.md carb-per-kg guidance) ──────
async function fetchLatestBodyWeightKg(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('body_metrics')
    .select('weight_kg')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .order('recorded_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { weight_kg: number } | null)?.weight_kg ?? null;
}

const CARB_G_PER_KG: Record<'easy' | 'moderate' | 'high', Range> = {
  easy: { min: 3, max: 5 },
  moderate: { min: 5, max: 7 },
  high: { min: 8, max: 10 },
};

function dailyCarbGramsLocal(dayType: 'easy' | 'moderate' | 'high', bodyWeightKg: number): Range {
  const perKg = CARB_G_PER_KG[dayType];
  return { min: Math.round(perKg.min * bodyWeightKg), max: Math.round(perKg.max * bodyWeightKg) };
}

// ── Sport → weekly day allocation ─────────────────────────────────────────────
// Centralizes the "how many days of what" split so both the explicit
// preferences flow and the background/regeneration fallback can produce a
// sport-appropriate split from just (sport, totalDaysPerWeek) — rather than
// nonsensically applying a generic run/lift slider split to, say, a
// powerlifter or swimmer.
interface DayAllocation {
  weeklyRunDays: number;
  weeklyLiftDays: number;
  weeklySwimDays: number;
  weeklyBikeDays: number;
  weeklyCrossDays: number;
}

const ZERO_ALLOCATION: DayAllocation = {
  weeklyRunDays: 0,
  weeklyLiftDays: 0,
  weeklySwimDays: 0,
  weeklyBikeDays: 0,
  weeklyCrossDays: 0,
};

/**
 * Splits `total` whole days across categories by relative weight using the
 * largest-remainder method, so the result always sums to EXACTLY `total` —
 * never over or under. An earlier version used independent `Math.max(1, ...)`
 * floors per category, which could sum to more than the athlete's actual
 * available days (e.g. hyrox at 4 days/week producing 5 scheduled days).
 */
function distributeDaysByWeight(total: number, weights: Partial<Record<keyof DayAllocation, number>>): DayAllocation {
  const entries = Object.entries(weights) as Array<[keyof DayAllocation, number]>;
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0 || totalWeight <= 0) return { ...ZERO_ALLOCATION };

  const shares = entries.map(([key, w]) => {
    const exact = (w / totalWeight) * total;
    return { key, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  const result: DayAllocation = { ...ZERO_ALLOCATION };
  for (const s of shares) result[s.key] = s.floor;

  let leftover = total - shares.reduce((sum, s) => sum + s.floor, 0);
  const byRemainderDesc = [...shares].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; leftover > 0 && byRemainderDesc.length > 0; i++, leftover--) {
    result[byRemainderDesc[i % byRemainderDesc.length].key] += 1;
  }
  return result;
}

function computeSportDayAllocation(
  mappedGoal: string,
  totalDaysPerWeek: number,
  triathlonDistance?: string | null,
): DayAllocation {
  const total = Math.max(1, totalDaysPerWeek);
  void triathlonDistance;

  switch (mappedGoal) {
    case 'triathlon':
      return distributeDaysByWeight(total, { weeklyBikeDays: 3, weeklySwimDays: 2, weeklyLiftDays: 2, weeklyRunDays: 3 });
    case 'cycling':
      return distributeDaysByWeight(total, { weeklyBikeDays: 4, weeklyLiftDays: 1 });
    case 'swimming':
      return distributeDaysByWeight(total, { weeklySwimDays: 4, weeklyLiftDays: 1 });
    case 'rowing':
      return distributeDaysByWeight(total, { weeklyCrossDays: 4, weeklyLiftDays: 1 });
    case 'powerlifting':
      return { ...ZERO_ALLOCATION, weeklyLiftDays: total };
    case 'hyrox':
      return distributeDaysByWeight(total, { weeklyRunDays: 4, weeklyCrossDays: 4, weeklyLiftDays: 2 });
    case 'crossfit':
      return distributeDaysByWeight(total, { weeklyCrossDays: 7, weeklyLiftDays: 3 });
    case 'ultra':
      return distributeDaysByWeight(total, { weeklyRunDays: 4, weeklyLiftDays: 1 });
    case 'run':
      return {
        ...ZERO_ALLOCATION,
        weeklyRunDays: total >= 2 ? Math.ceil(total * 0.6) : 2,
        weeklyLiftDays: total >= 2 ? Math.floor(total * 0.4) : 1,
      };
    case 'lift':
      return { ...ZERO_ALLOCATION, weeklyLiftDays: total };
    default:
      // hybrid / weight_loss / general_fitness — the original generic split.
      return {
        ...ZERO_ALLOCATION,
        weeklyRunDays: total >= 2 ? Math.ceil(total * 0.6) : 2,
        weeklyLiftDays: total >= 2 ? Math.floor(total * 0.4) : 1,
      };
  }
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

async function generateWeekDays(
  goals: GoalsContext,
  trainingLoad: TrainingLoad,
  recentMemories: CoachMemoryRow[],
  weekPlan: WeekPlan,
  runningZones: ReturnType<typeof formatZonesForPrompt> | null,
  fueling: { easy: Range; moderate: Range; high: Range } | null,
) {
  const memorySentence =
    recentMemories.length > 0
      ? ` Recent coaching notes: ${recentMemories.map((m) => m.summary).join('; ')}.`
      : '';

  const sportSnippet = goals.primaryGoal ? SPORT_PROMPT_SNIPPETS[goals.primaryGoal] : undefined;

  let systemContent = sportSnippet ? `${PLAN_SYSTEM_PROMPT_BASE}\n\n${sportSnippet}` : PLAN_SYSTEM_PROMPT_BASE;
  if (hasRecentInjuryFlag(recentMemories)) {
    systemContent += `\n\nThis athlete logged an elevated injury-risk flag within the last two weeks. Favor lower-impact, easier sessions for this athlete this week and avoid adding intensity work.`;
  }

  const constraintsSentence =
    goals.constraintTags && goals.constraintTags.length > 0
      ? ` constraints: {tags: ${JSON.stringify(goals.constraintTags)}${goals.injuryNotes ? `, note: ${JSON.stringify(goals.injuryNotes)}` : ''}}.`
      : goals.injuryNotes
        ? ` constraints: {note: ${JSON.stringify(goals.injuryNotes)}}.`
        : '';

  const fuelingSentence = fueling
    ? ` fueling (carbs g/day): {easy: "${fueling.easy.min}-${fueling.easy.max}", moderate: "${fueling.moderate.min}-${fueling.moderate.max}", high: "${fueling.high.min}-${fueling.high.max}"}.`
    : '';

  const zonesSentence = runningZones ? ` runningZones: ${JSON.stringify(runningZones)}.` : '';

  const userContent = `Build week ${weekPlan.weekNumber}${goals.totalWeeksPlanned ? ` of ${goals.totalWeeksPlanned}` : ''} for a ${goals.fitnessLevel} athlete. phase: ${weekPlan.phase}. volumeMultiplier: ${weekPlan.volumeMultiplier}. Goal: ${goals.primaryGoal ?? 'general fitness'}${goals.targetRace ? `, target race: ${goals.targetRace}` : ''}. Weekly run days: ${goals.weeklyRunDays}. Weekly lift days: ${goals.weeklyLiftDays}.${goals.weeklySwimDays ? ` Weekly swim days: ${goals.weeklySwimDays}.` : ''}${goals.weeklyBikeDays ? ` Weekly bike days: ${goals.weeklyBikeDays}.` : ''}${goals.weeklyCrossDays ? ` Weekly cross-training days: ${goals.weeklyCrossDays}.` : ''}${goals.triathlonDistance ? ` triathlonDistance: ${goals.triathlonDistance}.` : ''} Long run day: ${goals.longRunDay ?? 'sunday'}. trainingLoad: ${JSON.stringify(trainingLoad)}.${zonesSentence}${fuelingSentence}${constraintsSentence}${memorySentence}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      // Powerlifting/crossfit/hyrox weeks can have a real lift_prescription
      // (4-6 exercises) on most or all 7 days — bumped from 900/1000 to give
      // those all-lift-heavy sports enough room without truncating mid-JSON.
      max_tokens: 1400,
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
      .select('id, plan_id, week_number, focus, volume_multiplier, training_plans!inner(user_id, status)')
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

    // A week row with zero sessions is either an orphaned/partial-failure
    // artifact (e.g. GPT call failed after the plan/week rows were already
    // inserted), OR — new in v2 — a future week of a pre-created block whose
    // turn has now come. Either way, populate it now instead of blocking
    // regeneration forever.
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

    // Maps preferences.tsx's TrainingGoal values, and the onboarding sport
    // grid, to the DB's primary_goal_enum.
    const PRIMARY_GOAL_MAP: Record<string, string> = {
      hybrid: 'hybrid',
      run_performance: 'run',
      strength: 'lift',
      weight_loss: 'weight_loss',
      general: 'general_fitness',
      triathlon: 'triathlon',
      cycling: 'cycling',
      swimming: 'swimming',
      rowing: 'rowing',
      powerlifting: 'powerlifting',
      hyrox: 'hyrox',
      crossfit: 'crossfit',
      ultra: 'ultra',
    };

    // Build goals context: explicit preferences/raceTarget from the request
    // body, or fall back to the stored user_goals row for background calls.
    // Race-target plans also persist their metadata to user_goals so the app
    // can show a countdown/phase overview that survives weekly regeneration
    // (each week's training_plans row is otherwise ephemeral).
    let goals: GoalsContext;
    if (body.preferences) {
      // Preferences from plan builder: map fields to goals context. Fetch
      // whatever's already stored first so tweaking run/lift days here
      // doesn't silently wipe a race target or injury notes set elsewhere
      // (onboarding, race-event's "Train for This Event").
      const prefs = body.preferences;
      const mappedGoal = PRIMARY_GOAL_MAP[prefs.primaryGoal] ?? 'hybrid';
      const isTriathlon = mappedGoal === 'triathlon';

      const { data: existingGoals } = await supabase
        .from('user_goals')
        .select('target_race, target_date, total_weeks_planned, injury_notes, constraint_tags')
        .eq('user_id', userId)
        .maybeSingle();

      const allocation = computeSportDayAllocation(mappedGoal, prefs.daysPerWeek, prefs.triathlonDistance);
      // includeSwim/includeBike (hybrid-only checkboxes) still layer one
      // dedicated day on top of the sport's own allocation when checked.
      if (!isTriathlon) {
        if (prefs.includeSwim) allocation.weeklySwimDays = Math.max(allocation.weeklySwimDays, 1);
        if (prefs.includeBike) allocation.weeklyBikeDays = Math.max(allocation.weeklyBikeDays, 1);
      }

      goals = {
        primaryGoal: mappedGoal,
        weeklyRunDays: allocation.weeklyRunDays,
        weeklyLiftDays: allocation.weeklyLiftDays,
        weeklySwimDays: allocation.weeklySwimDays,
        weeklyBikeDays: allocation.weeklyBikeDays,
        weeklyCrossDays: allocation.weeklyCrossDays,
        triathlonDistance: isTriathlon ? prefs.triathlonDistance ?? 'sprint' : null,
        fitnessLevel: prefs.experienceLevel ?? 'beginner',
        targetRace: existingGoals?.target_race ?? null,
        targetDate: existingGoals?.target_date ?? null,
        totalWeeksPlanned: existingGoals?.total_weeks_planned ?? null,
        longRunDay: prefs.longRunDay ?? null,
        injuryNotes: existingGoals?.injury_notes ?? null,
        constraintTags: existingGoals?.constraint_tags ?? [],
      };

      const { error: goalsUpsertError } = await supabase.from('user_goals').upsert(
        {
          user_id: userId,
          primary_goal: goals.primaryGoal,
          target_race: goals.targetRace,
          target_date: goals.targetDate,
          total_weeks_planned: goals.totalWeeksPlanned,
          weekly_run_days: goals.weeklyRunDays,
          weekly_lift_days: goals.weeklyLiftDays,
          fitness_level: goals.fitnessLevel,
        },
        { onConflict: 'user_id' },
      );
      if (goalsUpsertError) throw goalsUpsertError;
    } else if (body.raceTarget) {
      // Race plan: map race details to goals context. Seed run/lift days,
      // fitness level, injury notes, and constraints from the athlete's real
      // onboarding profile when one exists, instead of always assuming a
      // 4-run/1-lift intermediate.
      const race = body.raceTarget;
      const { data: existingGoals } = await supabase
        .from('user_goals')
        .select('weekly_run_days, weekly_lift_days, fitness_level, injury_notes, constraint_tags')
        .eq('user_id', userId)
        .maybeSingle();

      goals = {
        primaryGoal: 'run',
        weeklyRunDays: existingGoals?.weekly_run_days ?? 4,
        weeklyLiftDays: existingGoals?.weekly_lift_days ?? 1,
        fitnessLevel: existingGoals?.fitness_level ?? 'intermediate',
        targetRace: `${race.raceName} (${race.distance})`,
        targetDate: race.raceDate ?? null,
        totalWeeksPlanned: race.weeksOut ?? null,
        injuryNotes: existingGoals?.injury_notes ?? null,
        constraintTags: existingGoals?.constraint_tags ?? [],
      };

      const { error: goalsUpsertError } = await supabase.from('user_goals').upsert(
        {
          user_id: userId,
          primary_goal: 'run',
          target_race: goals.targetRace,
          target_date: goals.targetDate,
          total_weeks_planned: goals.totalWeeksPlanned,
          weekly_run_days: goals.weeklyRunDays,
          weekly_lift_days: goals.weeklyLiftDays,
          fitness_level: goals.fitnessLevel,
        },
        { onConflict: 'user_id' },
      );
      if (goalsUpsertError) throw goalsUpsertError;
    } else {
      // Fallback: try to fetch from user_goals table (background silent call).
      const { data: goalsRow } = await supabase
        .from('user_goals')
        .select(
          'primary_goal, weekly_run_days, weekly_lift_days, fitness_level, target_race, target_date, total_weeks_planned, injury_notes, constraint_tags',
        )
        .eq('user_id', userId)
        .maybeSingle();

      const mappedGoal = goalsRow?.primary_goal ?? 'hybrid';
      // For sports whose weekly split can't come from a generic run/lift
      // slider (a swimmer, powerlifter, a triathlete needing swim/bike days
      // too, etc.), recompute a sport-appropriate allocation from the stored
      // total day count rather than trusting whatever a generic run/lift
      // slider happened to store — user_goals has no weekly_swim_days/
      // weekly_bike_days columns, so those would otherwise silently vanish
      // every time a triathlete's plan regenerates in the background.
      const needsSportAllocation = mappedGoal in SPORT_PROMPT_SNIPPETS || mappedGoal === 'triathlon';
      const storedTotalDays = (goalsRow?.weekly_run_days ?? 0) + (goalsRow?.weekly_lift_days ?? 0);
      const allocation = needsSportAllocation
        ? computeSportDayAllocation(mappedGoal, storedTotalDays > 0 ? storedTotalDays : 4)
        : null;

      goals = {
        primaryGoal: mappedGoal,
        weeklyRunDays: allocation ? allocation.weeklyRunDays : goalsRow?.weekly_run_days ?? 3,
        weeklyLiftDays: allocation ? allocation.weeklyLiftDays : goalsRow?.weekly_lift_days ?? 2,
        weeklySwimDays: allocation?.weeklySwimDays,
        weeklyBikeDays: allocation?.weeklyBikeDays,
        weeklyCrossDays: allocation?.weeklyCrossDays,
        fitnessLevel: goalsRow?.fitness_level ?? 'beginner',
        targetRace: goalsRow?.target_race ?? null,
        targetDate: goalsRow?.target_date ?? null,
        totalWeeksPlanned: goalsRow?.total_weeks_planned ?? null,
        injuryNotes: goalsRow?.injury_notes ?? null,
        constraintTags: goalsRow?.constraint_tags ?? [],
      };
    }

    const planType = goals.primaryGoal === 'run' || goals.primaryGoal === 'lift' || goals.primaryGoal === 'hybrid'
      ? (goals.primaryGoal as 'run' | 'lift' | 'hybrid')
      : 'custom';

    const trainingLoad = await computeTrainingLoad(supabase, userId);
    const recentMemories = await fetchRecentCoachMemory(supabase, userId);

    // Reuse the existing plan/week row when rebuilding (broken week or an
    // explicit force rebuild) instead of creating a duplicate; otherwise
    // create fresh plan + week row(s) for a brand new plan.
    let planId: string;
    let weekId: string;
    let weekPlan: WeekPlan;

    if (existingWeek) {
      planId = existingWeek.plan_id as string;
      weekId = existingWeek.id as string;
      // This week's phase/volume were already decided when the block (or this
      // single week) was first created — read them back rather than
      // recomputing, so a Taper week regenerated mid-week stays a Taper week.
      weekPlan = {
        weekNumber: (existingWeek.week_number as number) ?? 1,
        phase: ((existingWeek.focus as string) as BlockPhase) ?? 'Base',
        volumeMultiplier: existingWeek.volume_multiplier ? Number(existingWeek.volume_multiplier) : 1.0,
      };

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

      // Known block length (a dated race target, or an onboarding-collected
      // timeline) → create the WHOLE block of training_weeks rows now, each
      // with its real phase/volume already decided. Only this week's row
      // gets sessions populated below; future weeks stay as empty "broken"
      // rows the existing idempotency check above will naturally fill in
      // (with their own already-correct phase) once they become current.
      const totalWeeks = goals.totalWeeksPlanned && goals.totalWeeksPlanned > 1 ? goals.totalWeeksPlanned : null;
      const blockWeeks = totalWeeks ? computeBlockPhases(totalWeeks) : [singleUnknownLengthWeek()];

      const weekRows = blockWeeks.map((wp) => ({
        plan_id: planId,
        week_number: wp.weekNumber,
        start_date: toDateString(addDays(weekStart, (wp.weekNumber - 1) * 7)),
        focus: wp.phase,
        volume_multiplier: wp.volumeMultiplier,
      }));

      const { data: insertedWeeks, error: weeksError } = await supabase
        .from('training_weeks')
        .insert(weekRows)
        .select('id, week_number, focus, volume_multiplier');
      if (weeksError || !insertedWeeks || insertedWeeks.length === 0) {
        throw weeksError ?? new Error('Failed to create training weeks');
      }

      const thisWeekRow = insertedWeeks.find((w) => w.week_number === 1) ?? insertedWeeks[0];
      weekId = thisWeekRow.id as string;
      weekPlan = {
        weekNumber: thisWeekRow.week_number as number,
        phase: thisWeekRow.focus as BlockPhase,
        volumeMultiplier: Number(thisWeekRow.volume_multiplier),
      };
    }

    // Running-specific zones/fueling: only meaningful for sports where the
    // athlete is actually running under their own aerobic pacing (run,
    // hybrid, ultra, hyrox's run days, triathlon's run leg) — skip for
    // lift-only/rowing/swim/bike-only goals where a running pace is noise.
    const usesRunningPace = ['run', 'hybrid', 'ultra', 'hyrox', 'triathlon', 'weight_loss', 'general_fitness'].includes(
      goals.primaryGoal ?? '',
    );
    let runningZones: ReturnType<typeof formatZonesForPrompt> | null = null;
    if (usesRunningPace) {
      const bestEffort = await fetchBestRunEffort(supabase, userId);
      const thresholdPace = estimateThresholdPaceSecPerMile(bestEffort, goals.fitnessLevel);
      runningZones = formatZonesForPrompt(runningPaceZonesLocal(thresholdPace));
    }

    const bodyWeightKg = await fetchLatestBodyWeightKg(supabase, userId);
    const fueling = bodyWeightKg
      ? {
          easy: dailyCarbGramsLocal('easy', bodyWeightKg),
          moderate: dailyCarbGramsLocal('moderate', bodyWeightKg),
          high: dailyCarbGramsLocal('high', bodyWeightKg),
        }
      : null;

    const days = await generateWeekDays(goals, trainingLoad, recentMemories, weekPlan, runningZones, fueling);

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
      weekNumber: weekPlan.weekNumber,
      phase: weekPlan.phase,
      totalWeeksPlanned: goals.totalWeeksPlanned ?? null,
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
