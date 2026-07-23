// Direct counterpart of OSPREY-app/src/services/coaching/build-envelope.ts's
// invokeGeneratePlan: assembles a real EnvelopeInput from the athlete's DB
// data, then calls computeEnvelope. buildEnvelope performs its OWN direct
// user_goals read (rather than routing through the useUserGoal React Query
// hook) because it runs as a plain async function inside another hook's
// queryFn/mutationFn, outside React's render/hook context — mobile's own
// build-envelope.ts does the same (a direct read, not a shared hook).
// resolveGoalInputs is deliberately narrower than mobile's same-named
// function: mobile's also resolves a posted-preferences override that no
// webapp call site posts today (see this port's design spec, "Explicitly out
// of scope"). Keep in sync; the async DB-orchestration half of this file has
// no automated parity test (needs a real Supabase connection) — see this
// plan's Task 12 for its live-verification coverage.
import { supabase } from './supabase';
import { computeRacePhase } from './race-phase';
import { computeEnvelope, type CoachingEnvelope, type SelfReportAnchor } from './envelope';
import { selectBestRunEffort, selectBestRowingSplit } from './anchor';
import { parseThresholdAnchor, type ThresholdAnchorMap } from './threshold-anchor';
import { parseLiftParams, parseHyroxParams, parseCrossfitParams, type CrossfitGoalParams } from './goal-params';
import type { StrengthGoalParams } from './strength-loads';
import type { HyroxPrescriptionParams } from './hyrox-loads';

const MILES_PER_KM = 0.621371;
const RECENT_WINDOW_MS = 56 * 24 * 60 * 60 * 1000; // 8 weeks

function toSelfReportAnchor(map: ThresholdAnchorMap): SelfReportAnchor {
  return {
    thresholdSecPerMile: map.run?.thresholdSecPerMile ?? null,
    cssSecPer100: map.swim?.cssSecPer100 ?? null,
    splitSecPer500: map.row?.splitSecPer500 ?? null,
    ftpWatts: map.bike?.ftpWatts ?? null,
  };
}

interface ResolvedGoalInputs {
  sport: string;
  strengthParams: StrengthGoalParams | null;
  hyroxParams: HyroxPrescriptionParams | null;
  crossfitParams: CrossfitGoalParams | null;
}

// Pure: maps the raw DB primary_goal + goal_params into computeEnvelope's
// per-sport params shape, adapting goal-params.ts's documented divergences
// from the mobile *-params.ts `to*Params` functions at this boundary
// (goal-params.ts itself is unchanged, per this port's Global Constraints):
//  - lift: parseLiftParams never carries goalThirdKg (webapp never collects
//    it) — passed through as-is; buildStrengthPrescription already falls
//    back to oneRepMaxKg when goalThirdKg is absent.
//  - hyrox: parseHyroxParams always returns an object (division: null when
//    unset) instead of mobile's toHyroxParams returning null outright —
//    passed through as-is; buildHyroxPrescription's own `?.division`
//    optional-chain check handles both shapes identically.
//  - crossfit: parseCrossfitParams always returns a default-filled object,
//    even for a null/absent blob, where mobile's toCrossfitParams returns
//    null for that case. Replicated here by checking goalParamsRaw's own
//    nullness before parsing, so an athlete who never configured crossfit
//    goals gets no crossfit block at all — matching mobile exactly.
export function resolveGoalInputs(dbGoal: string | null | undefined, goalParamsRaw: unknown): ResolvedGoalInputs {
  const sport = dbGoal ?? 'run';
  return {
    sport,
    strengthParams: sport === 'lift' ? parseLiftParams(goalParamsRaw) : null,
    hyroxParams: sport === 'hyrox' ? parseHyroxParams(goalParamsRaw) : null,
    crossfitParams: sport === 'crossfit' && goalParamsRaw != null ? parseCrossfitParams(goalParamsRaw) : null,
  };
}

interface EnvelopeInputs {
  sport: string;
  race: { targetDate: string; totalWeeksPlanned: number } | null;
  fitnessLevel: string;
  bodyWeightKg: number;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  rowingSplitSecPer500: number | null;
  selfReportAnchor: SelfReportAnchor;
  maxHR: number | null;
  strengthParams: StrengthGoalParams | null;
  hyroxParams: HyroxPrescriptionParams | null;
  crossfitParams: CrossfitGoalParams | null;
}

function envelopeFromInputs(i: EnvelopeInputs, now: Date = new Date()): CoachingEnvelope {
  const raceGoal = i.race ? { targetRace: null, targetDate: i.race.targetDate, totalWeeksPlanned: i.race.totalWeeksPlanned } : null;
  const phaseInfo = raceGoal ? computeRacePhase(raceGoal, now) : null;
  return computeEnvelope({
    sport: i.sport,
    phase: phaseInfo?.phase ?? 'Base',
    weekNumber: phaseInfo?.currentWeekNumber ?? 1,
    totalWeeks: phaseInfo?.totalWeeks ?? 8,
    baselineLoad: 200, // Phase 2 will thread real CTL; Base default for now (matches mobile's current behavior)
    prevWeekLoad: null,
    bestRunMiles: i.bestRunMiles,
    bestRunTimeS: i.bestRunTimeS,
    fitnessLevel: i.fitnessLevel,
    bodyWeightKg: i.bodyWeightKg,
    rowingSplitSecPer500: i.rowingSplitSecPer500,
    selfReportAnchor: i.selfReportAnchor,
    maxHR: i.maxHR,
    strengthParams: i.strengthParams,
    hyroxParams: i.hyroxParams,
    crossfitParams: i.crossfitParams,
  });
}

interface UserGoalsRow {
  primary_goal: string | null;
  fitness_level: string | null;
  target_date: string | null;
  total_weeks_planned: number | null;
  threshold_anchor: unknown;
  goal_params: unknown;
}
interface WorkoutLogEffortRow {
  total_distance_km: number | null;
  total_duration_s: number | null;
}

// Assembles a real EnvelopeInput from the athlete's actual data and computes
// their CoachingEnvelope. `postedRaceTarget` lets useBuildPlanForRace's
// just-submitted race win over the (still-stale, not-yet-upserted) DB
// read — mirrors mobile's own postedRaceTarget precedence in
// invokeGeneratePlan. Each DB read degrades independently (log a warning,
// fall back to a safe default) rather than throwing, matching mobile's
// build-envelope.ts resilience exactly.
export async function buildEnvelope(
  userId: string,
  postedRaceTarget?: { raceDate: string; weeksOut: number } | null,
): Promise<CoachingEnvelope | null> {
  const [goalsRes, weightRes, runsRes, rowsRes, maxHrRes] = await Promise.all([
    supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned, threshold_anchor, goal_params').eq('user_id', userId).maybeSingle(),
    supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
    supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'rowing').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
    supabase.from('workout_logs').select('max_heart_rate').eq('user_id', userId).is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).not('max_heart_rate', 'is', null).order('max_heart_rate', { ascending: false }).limit(1).maybeSingle(),
  ]);

  // A failed query silently degrades to generic defaults — surface it so it's diagnosable.
  if (goalsRes.error) console.warn('[build-envelope] user_goals query failed:', goalsRes.error.message);
  if (weightRes.error) console.warn('[build-envelope] body_metrics query failed:', weightRes.error.message);
  if (runsRes.error) console.warn('[build-envelope] workout_logs query failed:', runsRes.error.message);
  if (rowsRes.error) console.warn('[build-envelope] workout_logs (rowing) query failed:', rowsRes.error.message);
  if (maxHrRes.error) console.warn('[build-envelope] workout_logs (maxHR) query failed:', maxHrRes.error.message);

  const g = goalsRes.data as UserGoalsRow | null;

  const recentRuns = ((runsRes.data ?? []) as WorkoutLogEffortRow[])
    .filter((r): r is { total_distance_km: number; total_duration_s: number } => r.total_distance_km != null && r.total_duration_s != null)
    .map((r) => ({ distanceMiles: r.total_distance_km * MILES_PER_KM, timeS: r.total_duration_s }));
  const bestEffort = selectBestRunEffort(recentRuns);

  const recentRows = ((rowsRes.data ?? []) as WorkoutLogEffortRow[])
    .filter((r): r is { total_distance_km: number; total_duration_s: number } => r.total_distance_km != null && r.total_duration_s != null)
    .map((r) => ({ distanceKm: r.total_distance_km, timeS: r.total_duration_s }));
  const rowingSplit = selectBestRowingSplit(recentRows);

  const goalInputs = resolveGoalInputs(g?.primary_goal, g?.goal_params);

  // Ultra has no webapp UI to SELECT it as a goal, but an athlete who onboarded via
  // mobile can already have primary_goal:'ultra' sitting in their user_goals row — and
  // every function this plan ports has no ultra branch, so silently computing an envelope
  // for them would produce wrong-but-not-crashing numbers with no test able to catch it
  // (ultra is deliberately excluded from every parity test in this port). Return null and
  // let the caller post no envelope at all — exactly today's pre-this-plan behavior for
  // every webapp user, so this is not a regression for ultra athletes specifically.
  if (goalInputs.sport === 'ultra') return null;

  let race = g?.target_date && g?.total_weeks_planned ? { targetDate: g.target_date, totalWeeksPlanned: g.total_weeks_planned } : null;
  // A brand-new race target hasn't been persisted to user_goals yet — this very
  // request is what writes target_date/total_weeks_planned (via ozzie-generate-plan's
  // own raceTarget handling) — so prefer the freshly-posted race over the stale DB read.
  if (postedRaceTarget?.raceDate && postedRaceTarget?.weeksOut) {
    race = { targetDate: postedRaceTarget.raceDate, totalWeeksPlanned: postedRaceTarget.weeksOut };
  }

  const inputs: EnvelopeInputs = {
    ...goalInputs,
    race,
    fitnessLevel: g?.fitness_level ?? 'beginner',
    bodyWeightKg: (weightRes.data as { weight_kg: number } | null)?.weight_kg ?? 70,
    bestRunMiles: bestEffort?.distanceMiles ?? null,
    bestRunTimeS: bestEffort?.timeS ?? null,
    rowingSplitSecPer500: rowingSplit,
    selfReportAnchor: toSelfReportAnchor(parseThresholdAnchor(g?.threshold_anchor)),
    maxHR: (maxHrRes.data as { max_heart_rate: number | null } | null)?.max_heart_rate ?? null,
  };

  return envelopeFromInputs(inputs);
}
