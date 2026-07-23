import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { computeEnvelope, resolveZones, type CoachingEnvelope, type ZonesConfidence } from '@/services/coaching/envelope';
import { computeRacePhase, type RaceGoal } from '@/services/plan';
import { resolveGoalInputs } from '@/services/coaching/build-envelope';
import { toSelfReportAnchor, type ThresholdAnchorMap } from '@/services/coaching/baseline';
import { selectBestRunEffort, selectBestRowingSplit } from '@/services/coaching/anchor';

const MILES_PER_KM = 0.621371;
const RECENT_WINDOW_MS = 56 * 24 * 60 * 60 * 1000;

export interface DisplayEnvelope extends CoachingEnvelope {
  confidence: ZonesConfidence;
}

export interface DisplayEnvelopeRawInputs {
  primaryGoal: string | null | undefined;
  fitnessLevel: string | null | undefined;
  targetDate: string | null | undefined;
  totalWeeksPlanned: number | null | undefined;
  thresholdAnchor: ThresholdAnchorMap | null | undefined;
  goalParams: unknown;
  bodyWeightKg: number | null | undefined;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  rowingSplitSecPer500: number | null;
  maxHR: number | null;
}

// Pure: raw DB-shaped inputs -> a full DisplayEnvelope. Mirrors build-envelope.ts's
// envelopeFromInputs (same "pure core, thin I/O shell" split), so this is directly
// unit-testable without mocking Supabase's query chain — `now` is injectable for
// the same reason that file's is (deterministic phase math under test).
export function buildDisplayEnvelope(raw: DisplayEnvelopeRawInputs, now: Date = new Date()): DisplayEnvelope {
  const { sport, ultraParams, strengthParams, hyroxParams, crossfitParams } = resolveGoalInputs(
    undefined,
    raw.primaryGoal,
    raw.goalParams,
  );

  const raceGoal: RaceGoal | null =
    raw.targetDate && raw.totalWeeksPlanned
      ? { targetRace: null, targetDate: raw.targetDate, totalWeeksPlanned: raw.totalWeeksPlanned }
      : null;
  const phaseInfo = raceGoal ? computeRacePhase(raceGoal, now) : null;

  const input = {
    sport,
    phase: phaseInfo?.phase ?? ('Base' as const),
    weekNumber: phaseInfo?.currentWeekNumber ?? 1,
    totalWeeks: phaseInfo?.totalWeeks ?? 8,
    baselineLoad: 200,
    prevWeekLoad: null,
    fitnessLevel: raw.fitnessLevel ?? 'beginner',
    bodyWeightKg: raw.bodyWeightKg ?? 70,
    bestRunMiles: raw.bestRunMiles,
    bestRunTimeS: raw.bestRunTimeS,
    rowingSplitSecPer500: raw.rowingSplitSecPer500,
    selfReportAnchor: toSelfReportAnchor(raw.thresholdAnchor ?? null),
    maxHR: raw.maxHR,
    ultraParams,
    strengthParams,
    hyroxParams,
    crossfitParams,
    weeksRemaining: phaseInfo?.weeksRemaining ?? null,
  };

  const { zonesConfidence } = resolveZones(input);
  const envelope = computeEnvelope(input);
  const confidence: ZonesConfidence =
    envelope.zones ? zonesConfidence : envelope.hrZones.source === 'estimated' ? 'estimated' : 'measured';
  return { ...envelope, confidence };
}

async function fetchDisplayEnvelope(userId: string): Promise<DisplayEnvelope | null> {
  const [goalsRes, weightRes, runsRes, rowsRes, maxHrRes] = await Promise.all([
    supabase.from('user_goals').select('primary_goal, fitness_level, target_date, total_weeks_planned, threshold_anchor, goal_params').eq('user_id', userId).maybeSingle(),
    supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
    supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'rowing').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
    supabase.from('workout_logs').select('max_heart_rate').eq('user_id', userId).is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).not('max_heart_rate', 'is', null).order('max_heart_rate', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const g = goalsRes.data;

  const bestEffort = selectBestRunEffort(
    (runsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceMiles: (r.total_distance_km as number) * MILES_PER_KM, timeS: r.total_duration_s as number })),
  );
  const rowingSplit = selectBestRowingSplit(
    (rowsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
      .map((r) => ({ distanceKm: r.total_distance_km as number, timeS: r.total_duration_s as number })),
  );

  return buildDisplayEnvelope({
    primaryGoal: g?.primary_goal,
    fitnessLevel: g?.fitness_level,
    targetDate: g?.target_date,
    totalWeeksPlanned: g?.total_weeks_planned,
    thresholdAnchor: g?.threshold_anchor as ThresholdAnchorMap | null,
    goalParams: g?.goal_params,
    bodyWeightKg: weightRes.data?.weight_kg as number | null,
    bestRunMiles: bestEffort?.distanceMiles ?? null,
    bestRunTimeS: bestEffort?.timeS ?? null,
    rowingSplitSecPer500: rowingSplit,
    maxHR: (maxHrRes.data?.max_heart_rate as number | null) ?? null,
  });
}

export function useDisplayEnvelope(): DisplayEnvelope | null {
  const userId = useAuthStore((s) => s.user?.id);

  const { data } = useQuery({
    queryKey: ['display-envelope', userId],
    queryFn: () => fetchDisplayEnvelope(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  return data ?? null;
}
