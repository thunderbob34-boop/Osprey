import { supabase } from '@/services/supabase';
import { computeRacePhase, RaceGoal } from '@/services/plan';
import { computeEnvelope, CoachingEnvelope } from './envelope';
import { selectBestRunEffort, selectBestRowingSplit } from './anchor';
import { toSelfReportAnchor, type SelfReportAnchor, type ThresholdAnchorMap } from './baseline';
import { toUltraParams, type UltraGoalParams } from './ultra-params';
import { toStrengthParams, type StrengthGoalParams } from './strength-params';
import { toHyroxParams, type HyroxGoalParams } from './hyrox-params';
import { primaryGoalFromTrainingGoal } from './goal-map';
import type { TrainingGoal, UserPreferences } from '@/types/preferences';

const MILES_PER_KM = 0.621371;
const RECENT_WINDOW_MS = 56 * 24 * 60 * 60 * 1000; // 8 weeks

interface EnvelopeInputs {
  sport: string;
  race: { targetDate: string; totalWeeksPlanned: number } | null;
  fitnessLevel: string;
  bodyWeightKg: number;
  baselineLoad: number;
  prevWeekLoad: number | null;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  rowingSplitSecPer500: number | null;
  selfReportAnchor: SelfReportAnchor | null;
  maxHR: number | null;
  ultraParams: UltraGoalParams | null;
  // Optional (unlike ultraParams above): only 'lift' plans populate it (Step 4), and
  // keeping it optional here avoids forcing every EnvelopeInputs literal (incl. existing
  // envelopeFromInputs tests) to name a field computeEnvelope doesn't consume yet — Task 2
  // wires actual usage into computeEnvelope.
  strengthParams?: StrengthGoalParams | null;
  hyroxParams?: HyroxGoalParams | null;
}

// Pure: inputs → envelope. No-race plans run a Base maintenance macrocycle.
// `now` is injectable so the race→phase branch is deterministic under test;
// real callers rely on the default (current time).
export function envelopeFromInputs(i: EnvelopeInputs, now: Date = new Date()): CoachingEnvelope {
  const raceGoal: RaceGoal | null = i.race
    ? { targetRace: null, targetDate: i.race.targetDate, totalWeeksPlanned: i.race.totalWeeksPlanned }
    : null;
  const phaseInfo = raceGoal ? computeRacePhase(raceGoal, now) : null;
  return computeEnvelope({
    sport: i.sport,
    phase: phaseInfo?.phase ?? 'Base',
    weekNumber: phaseInfo?.currentWeekNumber ?? 1,
    totalWeeks: phaseInfo?.totalWeeks ?? 8,
    baselineLoad: i.baselineLoad || 200,
    prevWeekLoad: i.prevWeekLoad,
    bestRunMiles: i.bestRunMiles,
    bestRunTimeS: i.bestRunTimeS,
    fitnessLevel: i.fitnessLevel,
    bodyWeightKg: i.bodyWeightKg,
    rowingSplitSecPer500: i.rowingSplitSecPer500,
    selfReportAnchor: i.selfReportAnchor,
    maxHR: i.maxHR,
    ultraParams: i.ultraParams,
    strengthParams: i.strengthParams,
    hyroxParams: i.hyroxParams,
    weeksRemaining: phaseInfo?.weeksRemaining ?? null,
  });
}

// Resolve the effective goal for the envelope build. A plan-builder goal SWITCHER posts
// their just-picked goal in preferences.primaryGoal, but user_goals.primary_goal in the DB
// still holds the OLD goal until the edge fn's upsert — which runs AFTER this build. Prefer
// the posted goal so the first generation is built for the new sport; fall back to the DB
// value for background/regen and race-event calls that post no preferences.
export function resolveGoalInputs(
  postedGoal: TrainingGoal | undefined,
  dbGoal: string | null | undefined,
  goalParams: unknown,
): { sport: string; ultraParams: UltraGoalParams | null; strengthParams: StrengthGoalParams | null; hyroxParams: HyroxGoalParams | null } {
  const effectiveGoal = postedGoal ? primaryGoalFromTrainingGoal(postedGoal) : (dbGoal ?? 'run');
  return {
    sport: effectiveGoal,
    ultraParams: effectiveGoal === 'ultra' ? toUltraParams(goalParams) : null,
    strengthParams: effectiveGoal === 'lift' ? toStrengthParams(goalParams) : null,
    hyroxParams: effectiveGoal === 'hyrox' ? toHyroxParams(goalParams) : null,
  };
}

// Async: gather the athlete's inputs, then invoke generation with the envelope.
export async function invokeGeneratePlan(extraBody: Record<string, unknown> = {}) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  const postedGoal = (extraBody.preferences as UserPreferences | undefined)?.primaryGoal;

  let inputs: EnvelopeInputs = {
    sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
    baselineLoad: 200, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
    rowingSplitSecPer500: null, selfReportAnchor: null, maxHR: null,
    ultraParams: null,
    strengthParams: null,
  };

  if (userId) {
    const [goalsRes, weightRes, runsRes, rowsRes, maxHrRes] = await Promise.all([
      supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned, threshold_anchor, goal_params').eq('user_id', userId).maybeSingle(),
      supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
      // Recent runs (not the single longest all-time), so the anchor can pick the
      // best-QUALITY effort rather than the slowest long run — see selectBestRunEffort.
      supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
      // Recent rowing logs, mirrored from the runs query above — selectBestRowingSplit
      // picks the fastest 500m split rather than the longest/slowest piece.
      supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'rowing').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
      supabase.from('workout_logs').select('max_heart_rate').eq('user_id', userId).is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).not('max_heart_rate', 'is', null).order('max_heart_rate', { ascending: false }).limit(1).maybeSingle(),
    ]);
    // A failed query silently degrades to generic defaults — surface it so it's diagnosable.
    if (goalsRes.error) console.warn('[build-envelope] user_goals query failed:', goalsRes.error.message);
    if (weightRes.error) console.warn('[build-envelope] body_metrics query failed:', weightRes.error.message);
    if (runsRes.error) console.warn('[build-envelope] workout_logs query failed:', runsRes.error.message);
    if (rowsRes.error) console.warn('[build-envelope] workout_logs (rowing) query failed:', rowsRes.error.message);
    if (maxHrRes.error) console.warn('[build-envelope] workout_logs (maxHR) query failed:', maxHrRes.error.message);

    const g = goalsRes.data;
    const recentRuns = (runsRes.data ?? [])
      .filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceMiles: (r.total_distance_km as number) * MILES_PER_KM, timeS: r.total_duration_s as number }));
    const bestEffort = selectBestRunEffort(recentRuns);

    const recentRows = (rowsRes.data ?? [])
      .filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceKm: r.total_distance_km as number, timeS: r.total_duration_s as number }));
    const rowingSplit = selectBestRowingSplit(recentRows);

    inputs = {
      ...resolveGoalInputs(postedGoal, g?.primary_goal, g?.goal_params),
      race: g?.target_date && g?.total_weeks_planned ? { targetDate: g.target_date, totalWeeksPlanned: g.total_weeks_planned } : null,
      fitnessLevel: g?.fitness_level ?? 'beginner',
      bodyWeightKg: weightRes.data?.weight_kg ?? 70,
      baselineLoad: 200,          // Phase 2 will thread real CTL; Base default for now
      prevWeekLoad: null,
      bestRunMiles: bestEffort?.distanceMiles ?? null,
      bestRunTimeS: bestEffort?.timeS ?? null,
      rowingSplitSecPer500: rowingSplit,
      selfReportAnchor: toSelfReportAnchor(g?.threshold_anchor as ThresholdAnchorMap | null),
      maxHR: (maxHrRes.data?.max_heart_rate as number | null) ?? null,
    };
  }

  const envelope = envelopeFromInputs(inputs);
  return supabase.functions.invoke('ozzie-generate-plan', {
    method: 'POST',
    body: { ...extraBody, envelope },
  });
}
