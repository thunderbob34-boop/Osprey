import { supabase } from '@/services/supabase';
import type { TriathlonDistance } from '@/types/preferences';

export interface DailyLoad {
  date: string; // YYYY-MM-DD
  tss: number;
}

export interface PerformanceSeries {
  date: string;
  atl: number; // Acute Training Load (7-day EWA)
  ctl: number; // Chronic Training Load (42-day EWA)
  tsb: number; // Training Stress Balance = CTL - ATL
}

export interface PerformanceMetrics {
  atl: number;
  ctl: number;
  tsb: number;
  acwr: number;
  injuryRisk: InjuryRisk;
  series: PerformanceSeries[];
  racePredictor: RacePredictor | null;
  triathlonPredictor: TriathlonPredictor | null;
}

export interface InjuryRisk {
  level: 'high' | 'moderate' | 'low' | 'undertrained';
  acwr: number;
  message: string;
}

export interface RacePredictor {
  baseMiles: number;
  basePaceSecPerMile: number;
  predictions: Array<{ label: string; distanceMiles: number; predictedTimeS: number }>;
}

// ── ATL / CTL / TSB computation ───────────────────────────────────────────────

export function computeAtlCtlTsb(dailyLoads: DailyLoad[]): PerformanceSeries[] {
  if (dailyLoads.length === 0) return [];

  const TAU_ATL = 7;
  const TAU_CTL = 42;

  let atl = 0;
  let ctl = 0;

  return dailyLoads.map(({ date, tss }) => {
    atl = atl + (tss - atl) / TAU_ATL;
    ctl = ctl + (tss - ctl) / TAU_CTL;
    const tsb = ctl - atl;
    return { date, atl: Math.round(atl * 10) / 10, ctl: Math.round(ctl * 10) / 10, tsb: Math.round(tsb * 10) / 10 };
  });
}

// ── ACWR + injury risk ────────────────────────────────────────────────────────

export function computeInjuryRisk(dailyLoads: DailyLoad[]): InjuryRisk {
  const recent = dailyLoads.slice(-28);
  const acute = recent.slice(-7);

  const acuteAvg = acute.reduce((s, d) => s + d.tss, 0) / Math.max(1, acute.length);
  const chronicAvg = recent.reduce((s, d) => s + d.tss, 0) / Math.max(1, recent.length);

  if (chronicAvg < 5) {
    return { level: 'undertrained', acwr: 0, message: 'Not enough recent training to assess load.' };
  }

  const acwr = acuteAvg / chronicAvg;

  if (acwr > 1.5) {
    return {
      level: 'high',
      acwr,
      message: `Load spike detected (ACWR ${acwr.toFixed(2)}). Consider an easy day — injury risk is elevated.`,
    };
  }
  if (acwr > 1.3) {
    return {
      level: 'moderate',
      acwr,
      message: `Training load climbing (ACWR ${acwr.toFixed(2)}). Monitor recovery closely this week.`,
    };
  }
  if (acwr < 0.8 && chronicAvg > 10) {
    return {
      level: 'undertrained',
      acwr,
      message: 'Workload dipped below baseline. A light build this week will maintain fitness.',
    };
  }

  return { level: 'low', acwr, message: 'Load in the optimal zone. Keep it up.' };
}

// ── ACWR trend (proactive de-load detection) ─────────────────────────────────

export interface AcwrTrend {
  direction: 'climbing' | 'stable' | 'falling';
  daysToHighRisk: number | null; // linear projection, null if not climbing
}

const TREND_WINDOW_DAYS = 4;
const MODERATE_ACWR_THRESHOLD = 1.3;
const TREND_SLOPE_EPSILON = 0.02; // per-day ACWR change below this counts as "stable"

/**
 * Looks at the ACWR trajectory over the last few days (not just today's single
 * value) so a de-load can be proposed before tsb tips negative.
 */
export function computeAcwrTrend(dailyLoads: DailyLoad[]): AcwrTrend {
  if (dailyLoads.length < TREND_WINDOW_DAYS) {
    return { direction: 'stable', daysToHighRisk: null };
  }

  const acwrSeries: number[] = [];
  for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i--) {
    const trimmed = dailyLoads.slice(0, dailyLoads.length - i);
    const risk = computeInjuryRisk(trimmed);
    if (risk.level === 'undertrained' && risk.acwr === 0) {
      // Not enough training history yet — mirror computeInjuryRisk's own guard.
      return { direction: 'stable', daysToHighRisk: null };
    }
    acwrSeries.push(risk.acwr);
  }

  const n = acwrSeries.length;
  const xMean = (n - 1) / 2;
  const yMean = acwrSeries.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (acwrSeries[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const latest = acwrSeries[n - 1];

  if (slope > TREND_SLOPE_EPSILON) {
    const daysToHighRisk =
      latest >= MODERATE_ACWR_THRESHOLD ? 0 : Math.ceil((MODERATE_ACWR_THRESHOLD - latest) / slope);
    return { direction: 'climbing', daysToHighRisk };
  }
  if (slope < -TREND_SLOPE_EPSILON) {
    return { direction: 'falling', daysToHighRisk: null };
  }
  return { direction: 'stable', daysToHighRisk: null };
}

// ── Riegel race time predictor ────────────────────────────────────────────────

const RIEGEL_EXPONENT = 1.06;

export function riegelPredict(
  sourceDistanceMiles: number,
  sourceTimeS: number,
  targetDistanceMiles: number,
): number {
  return sourceTimeS * Math.pow(targetDistanceMiles / sourceDistanceMiles, RIEGEL_EXPONENT);
}

const RACE_DISTANCES: Array<{ label: string; miles: number }> = [
  { label: '5K', miles: 3.107 },
  { label: '10K', miles: 6.214 },
  { label: 'Half', miles: 13.109 },
  { label: 'Marathon', miles: 26.219 },
];

export function buildRacePredictor(
  dailyLoads: DailyLoad[],
  bestRunMiles: number,
  bestRunTimeS: number,
): RacePredictor | null {
  if (bestRunMiles < 1 || bestRunTimeS <= 0) return null;

  const paceSecPerMile = bestRunTimeS / bestRunMiles;

  const predictions = RACE_DISTANCES
    .filter((d) => d.miles >= bestRunMiles * 0.5)
    .map(({ label, miles }) => ({
      label,
      distanceMiles: miles,
      predictedTimeS: Math.round(riegelPredict(bestRunMiles, bestRunTimeS, miles)),
    }));

  return { baseMiles: bestRunMiles, basePaceSecPerMile: paceSecPerMile, predictions };
}

// ── Data fetching ─────────────────────────────────────────────────────────────

interface WorkoutRow {
  started_at: string;
  total_duration_s: number;
  total_distance_km: number | null;
  session_type: string;
  tss: number | null;
}

function estimateTss(durationS: number): number {
  // Simple estimate when TSS not stored: (hours * 50) for moderate effort runs
  return (durationS / 3600) * 50;
}

export interface BestEffort {
  miles: number;
  timeS: number;
}

export async function fetchPerformanceData(
  userId: string,
  days = 84,
): Promise<{
  dailyLoads: DailyLoad[];
  bestRunMiles: number;
  bestRunTimeS: number;
  bestSwimMiles: number;
  bestSwimTimeS: number;
  bestBikeMiles: number;
  bestBikeTimeS: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('workout_logs')
    // NB: the column is `total_distance_km` — a prior version of this query
    // selected a nonexistent `distance_meters` column, which made Postgrest
    // error on every call and silently broke fitness/fatigue, injury risk,
    // and the race predictor for every OSPREY+ user.
    .select('started_at, total_duration_s, total_distance_km, session_type, tss')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as WorkoutRow[];

  // Build a map from date → total TSS
  const tssMap: Record<string, number> = {};
  const KM_TO_MILES = 0.621371;

  let bestRunMiles = 0;
  let bestRunTimeS = 0;
  let bestSwimMiles = 0;
  let bestSwimTimeS = 0;
  let bestBikeMiles = 0;
  let bestBikeTimeS = 0;

  for (const row of rows) {
    const date = row.started_at.slice(0, 10);
    const tss = row.tss != null ? Number(row.tss) : estimateTss(row.total_duration_s);
    tssMap[date] = (tssMap[date] ?? 0) + tss;

    if (row.total_distance_km && row.total_duration_s > 0) {
      const miles = row.total_distance_km * KM_TO_MILES;
      if (row.session_type === 'run' && miles > bestRunMiles) {
        bestRunMiles = miles;
        bestRunTimeS = row.total_duration_s;
      } else if (row.session_type === 'swim' && miles > bestSwimMiles) {
        bestSwimMiles = miles;
        bestSwimTimeS = row.total_duration_s;
      } else if (row.session_type === 'bike' && miles > bestBikeMiles) {
        bestBikeMiles = miles;
        bestBikeTimeS = row.total_duration_s;
      }
    }
  }

  // Fill every day in the window (0 TSS on rest days)
  const dailyLoads: DailyLoad[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyLoads.push({ date: dateStr, tss: tssMap[dateStr] ?? 0 });
  }

  return {
    dailyLoads,
    bestRunMiles,
    bestRunTimeS,
    bestSwimMiles,
    bestSwimTimeS,
    bestBikeMiles,
    bestBikeTimeS,
  };
}

/** Triathlon goal + target race distance, or null if the user isn't training for one. */
export async function fetchTriathlonPreference(userId: string): Promise<TriathlonDistance | null> {
  const { data: goalRow } = await supabase
    .from('user_goals')
    .select('primary_goal')
    .eq('user_id', userId)
    .maybeSingle();

  if (goalRow?.primary_goal !== 'triathlon') return null;

  // triathlonDistance isn't persisted to user_goals — it lives in the auth
  // user_metadata blob preferences.tsx writes to (no schema change needed).
  const { data: authData } = await supabase.auth.getUser();
  const saved = authData.user?.user_metadata?.osprey_preferences as
    | { triathlonDistance?: TriathlonDistance }
    | undefined;
  return saved?.triathlonDistance ?? 'sprint';
}

// ── Triathlon split predictor (swim/bike/run + transitions) ──────────────────

const TRI_LEGS: Record<
  TriathlonDistance,
  { raceLabel: string; swim: { miles: number; label: string }; bike: { miles: number; label: string }; run: { miles: number; label: string } }
> = {
  sprint: {
    raceLabel: 'Sprint Triathlon',
    swim: { miles: 0.466, label: '750m Swim' },
    bike: { miles: 12.4, label: '20K Bike' },
    run: { miles: 3.107, label: '5K Run' },
  },
  olympic: {
    raceLabel: 'Olympic Triathlon',
    swim: { miles: 0.932, label: '1.5K Swim' },
    bike: { miles: 24.9, label: '40K Bike' },
    run: { miles: 6.214, label: '10K Run' },
  },
  half: {
    raceLabel: 'Half Ironman (70.3)',
    swim: { miles: 1.2, label: '1.2mi Swim' },
    bike: { miles: 56, label: '56mi Bike' },
    run: { miles: 13.109, label: '13.1mi Run' },
  },
  full: {
    raceLabel: 'Ironman (140.6)',
    swim: { miles: 2.4, label: '2.4mi Swim' },
    bike: { miles: 112, label: '112mi Bike' },
    run: { miles: 26.219, label: '26.2mi Run' },
  },
};

const TRANSITION_ESTIMATE_S: Record<TriathlonDistance, number> = {
  sprint: 3 * 60,
  olympic: 4 * 60,
  half: 6 * 60,
  full: 9 * 60,
};

export interface TriSplitPrediction {
  leg: 'swim' | 'bike' | 'run';
  label: string;
  distanceMiles: number;
  /** null when there's no recorded effort yet for this leg — never invented. */
  predictedTimeS: number | null;
}

export interface TriathlonPredictor {
  raceLabel: string;
  splits: TriSplitPrediction[];
  transitionEstimateS: number;
  /** null until every leg has at least one recorded effort to extrapolate from. */
  totalTimeS: number | null;
}

function predictLeg(
  leg: 'swim' | 'bike' | 'run',
  label: string,
  targetMiles: number,
  best: BestEffort | null,
): TriSplitPrediction {
  if (!best || best.miles <= 0 || best.timeS <= 0) {
    return { leg, label, distanceMiles: targetMiles, predictedTimeS: null };
  }
  return {
    leg,
    label,
    distanceMiles: targetMiles,
    predictedTimeS: Math.round(riegelPredict(best.miles, best.timeS, targetMiles)),
  };
}

/**
 * Predicts swim/bike/run splits and a total finish time for the athlete's
 * target triathlon distance, extrapolating from their own best recorded
 * effort in each discipline (Riegel scaling, same as the run-only predictor).
 * A leg with no logged history yet returns `predictedTimeS: null` rather than
 * a guessed number — consistent with how Ozzie never invents data elsewhere.
 */
export function buildTriathlonPredictor(
  distance: TriathlonDistance,
  swimBest: BestEffort | null,
  bikeBest: BestEffort | null,
  runBest: BestEffort | null,
): TriathlonPredictor {
  const config = TRI_LEGS[distance];

  const splits: TriSplitPrediction[] = [
    predictLeg('swim', config.swim.label, config.swim.miles, swimBest),
    predictLeg('bike', config.bike.label, config.bike.miles, bikeBest),
    predictLeg('run', config.run.label, config.run.miles, runBest),
  ];

  const transitionEstimateS = TRANSITION_ESTIMATE_S[distance];
  const allHaveData = splits.every((s) => s.predictedTimeS != null);
  const totalTimeS = allHaveData
    ? splits.reduce((sum, s) => sum + (s.predictedTimeS ?? 0), 0) + transitionEstimateS
    : null;

  return { raceLabel: config.raceLabel, splits, transitionEstimateS, totalTimeS };
}

// ── Training readiness label ──────────────────────────────────────────────────

import { Colors } from '@/constants/colors';
import type { TrainingReadiness } from '@/types/daily-summary';

export function readinessFromTsb(tsb: number, ctl: number): TrainingReadiness {
  let label: string;
  let color: string;
  if (tsb > 15) {
    label = 'Peak Fresh';
    color = Colors.teal;
  } else if (tsb > 5) {
    label = 'Fresh';
    color = Colors.green;
  } else if (tsb >= -5) {
    label = 'Ready';
    color = Colors.teal;
  } else if (tsb >= -15) {
    label = 'Carrying Load';
    color = Colors.amber;
  } else if (tsb >= -25) {
    label = 'Fatigued';
    color = Colors.amber;
  } else {
    label = 'Overreached';
    color = Colors.red;
  }
  return { tsb: Math.round(tsb * 10) / 10, ctl: Math.round(ctl * 10) / 10, label, color };
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function formatRaceTimeSec(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.round(totalS % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
