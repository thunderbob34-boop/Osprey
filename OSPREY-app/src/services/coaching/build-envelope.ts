import { supabase } from '@/services/supabase';
import { computeRacePhase, RaceGoal } from '@/services/plan';
import { computeEnvelope, CoachingEnvelope } from './envelope';
import { selectBestRunEffort } from './anchor';

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
  });
}

// Async: gather the athlete's inputs, then invoke generation with the envelope.
export async function invokeGeneratePlan(extraBody: Record<string, unknown> = {}) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  let inputs: EnvelopeInputs = {
    sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
    baselineLoad: 200, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
  };

  if (userId) {
    const [goalsRes, weightRes, runsRes] = await Promise.all([
      supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned').eq('user_id', userId).maybeSingle(),
      supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
      // Recent runs (not the single longest all-time), so the anchor can pick the
      // best-QUALITY effort rather than the slowest long run — see selectBestRunEffort.
      supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
    ]);
    // A failed query silently degrades to generic defaults — surface it so it's diagnosable.
    if (goalsRes.error) console.warn('[build-envelope] user_goals query failed:', goalsRes.error.message);
    if (weightRes.error) console.warn('[build-envelope] body_metrics query failed:', weightRes.error.message);
    if (runsRes.error) console.warn('[build-envelope] workout_logs query failed:', runsRes.error.message);

    const g = goalsRes.data;
    const recentRuns = (runsRes.data ?? [])
      .filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceMiles: (r.total_distance_km as number) * MILES_PER_KM, timeS: r.total_duration_s as number }));
    const bestEffort = selectBestRunEffort(recentRuns);

    inputs = {
      sport: g?.primary_goal ?? 'run',
      race: g?.target_date && g?.total_weeks_planned ? { targetDate: g.target_date, totalWeeksPlanned: g.total_weeks_planned } : null,
      fitnessLevel: g?.fitness_level ?? 'beginner',
      bodyWeightKg: weightRes.data?.weight_kg ?? 70,
      baselineLoad: 200,          // Phase 2 will thread real CTL; Base default for now
      prevWeekLoad: null,
      bestRunMiles: bestEffort?.distanceMiles ?? null,
      bestRunTimeS: bestEffort?.timeS ?? null,
    };
  }

  const envelope = envelopeFromInputs(inputs);
  return supabase.functions.invoke('ozzie-generate-plan', {
    method: 'POST',
    body: { ...extraBody, envelope },
  });
}
