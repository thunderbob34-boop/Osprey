import { supabase } from '@/services/supabase';
import { computeRacePhase } from '@/services/plan';
import { computeEnvelope, CoachingEnvelope } from './envelope';

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
export function envelopeFromInputs(i: EnvelopeInputs): CoachingEnvelope {
  const phaseInfo = i.race
    ? computeRacePhase({ targetDate: i.race.targetDate, totalWeeksPlanned: i.race.totalWeeksPlanned } as never)
    : null;
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
    const [goalsRes, weightRes, bestRes] = await Promise.all([
      supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned').eq('user_id', userId).maybeSingle(),
      supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).order('total_distance_km', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const g = goalsRes.data;
    inputs = {
      sport: g?.primary_goal ?? 'run',
      race: g?.target_date && g?.total_weeks_planned ? { targetDate: g.target_date, totalWeeksPlanned: g.total_weeks_planned } : null,
      fitnessLevel: g?.fitness_level ?? 'beginner',
      bodyWeightKg: weightRes.data?.weight_kg ?? 70,
      baselineLoad: 200,          // Phase 2 will thread real CTL; Base default for now
      prevWeekLoad: null,
      bestRunMiles: bestRes.data?.total_distance_km ? bestRes.data.total_distance_km * 0.621371 : null,
      bestRunTimeS: bestRes.data?.total_duration_s ?? null,
    };
  }

  const envelope = envelopeFromInputs(inputs);
  return supabase.functions.invoke('ozzie-generate-plan', {
    method: 'POST',
    body: { ...extraBody, envelope },
  });
}
