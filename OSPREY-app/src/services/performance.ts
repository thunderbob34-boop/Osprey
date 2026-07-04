import { supabase } from '@/services/supabase';

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

function estimateTss(durationS: number, distanceKm: number | null): number {
  // Simple estimate when TSS not stored: (hours * 50) for moderate effort runs
  return (durationS / 3600) * 50;
}

export async function fetchPerformanceData(
  userId: string,
  days = 84,
): Promise<{
  dailyLoads: DailyLoad[];
  bestRunMiles: number;
  bestRunTimeS: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('workout_logs')
    .select('started_at, total_duration_s, total_distance_km, session_type, tss')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as WorkoutRow[];

  // Build a map from date → total TSS
  const tssMap: Record<string, number> = {};
  let bestRunMiles = 0;
  let bestRunTimeS = 0;
  const kmPerMile = 1.609344;

  for (const row of rows) {
    const date = row.started_at.slice(0, 10);
    const tss = row.tss != null ? Number(row.tss) : estimateTss(row.total_duration_s, row.total_distance_km);
    tssMap[date] = (tssMap[date] ?? 0) + tss;

    if (row.session_type === 'run' && row.total_distance_km && row.total_duration_s > 0) {
      const miles = row.total_distance_km / kmPerMile;
      if (miles > bestRunMiles) {
        bestRunMiles = miles;
        bestRunTimeS = row.total_duration_s;
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

  return { dailyLoads, bestRunMiles, bestRunTimeS };
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
  const total = Math.round(totalS);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
