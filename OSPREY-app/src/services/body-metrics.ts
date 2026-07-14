import { supabase } from '@/services/supabase';
import { localDateString } from '@/utils/date';

const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 100) / 100;
}

export interface WeightEntry {
  recordedOn: string;
  weightKg: number;
}

export interface WeightSummary {
  latestKg: number | null;
  /** Weekly change in kg, positive = gaining. Null until there's a trend. */
  kgPerWeek: number | null;
  direction: 'gaining' | 'losing' | 'holding' | null;
  entryCount: number;
}

export interface WeightHistoryPoint {
  recordedOn: string;
  kg: number;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Upserts today's weigh-in (one reading per day). Weight stored in kg. */
export async function logWeight(
  userId: string,
  weightKg: number,
  bodyFatPct?: number | null,
): Promise<void> {
  const { error } = await supabase.from('body_metrics').upsert(
    {
      user_id: userId,
      recorded_on: todayDateString(),
      weight_kg: Math.round(weightKg * 100) / 100,
      body_fat_pct: bodyFatPct ?? null,
    },
    { onConflict: 'user_id,recorded_on' },
  );
  if (error) throw error;
}

/**
 * Mirrors the nutrition coach's trend math on the client for display: recent
 * ~7-day average vs. the prior window, expressed as kg/week.
 */
export async function fetchWeightSummary(userId: string): Promise<WeightSummary> {
  const twentyEightDaysAgo = localDateString(new Date(Date.now() - 28 * 86400000));

  const { data, error } = await supabase
    .from('body_metrics')
    .select('recorded_on, weight_kg')
    .eq('user_id', userId)
    .gte('recorded_on', twentyEightDaysAgo)
    .not('weight_kg', 'is', null)
    .order('recorded_on', { ascending: true });

  if (error) throw error;

  const readings = (data ?? []).map((r) => ({
    date: new Date(r.recorded_on as string),
    kg: Number(r.weight_kg),
  }));

  const latestKg = readings.length > 0 ? readings[readings.length - 1].kg : null;
  if (readings.length < 2) {
    return { latestKg, kgPerWeek: null, direction: null, entryCount: readings.length };
  }

  const latest = readings[readings.length - 1];
  const earliest = readings[0];
  const spanDays = (latest.date.getTime() - earliest.date.getTime()) / 86400000;
  if (spanDays < 4) {
    return { latestKg, kgPerWeek: null, direction: null, entryCount: readings.length };
  }

  const cutoff = new Date(latest.date.getTime() - 7 * 86400000);
  const recent = readings.filter((r) => r.date >= cutoff);
  const prior = readings.filter((r) => r.date < cutoff);
  const avg = (arr: { kg: number }[]) => arr.reduce((s, r) => s + r.kg, 0) / arr.length;

  let kgPerWeek: number;
  if (prior.length > 0) {
    const recentMid = new Date((cutoff.getTime() + latest.date.getTime()) / 2);
    const priorMid = new Date((earliest.date.getTime() + cutoff.getTime()) / 2);
    const weeks = Math.max(0.5, (recentMid.getTime() - priorMid.getTime()) / (7 * 86400000));
    kgPerWeek = (avg(recent) - avg(prior)) / weeks;
  } else {
    const weeks = Math.max(0.5, spanDays / 7);
    kgPerWeek = (latest.kg - earliest.kg) / weeks;
  }

  const rounded = Math.round(kgPerWeek * 100) / 100;
  const direction: WeightSummary['direction'] =
    rounded > 0.1 ? 'gaining' : rounded < -0.1 ? 'losing' : 'holding';

  return { latestKg, kgPerWeek: rounded, direction, entryCount: readings.length };
}

/** Raw weigh-ins (oldest → newest) over the last `days`, for charting progress. */
export async function fetchWeightHistory(userId: string, days = 90): Promise<WeightHistoryPoint[]> {
  const since = localDateString(new Date(Date.now() - days * 86400000));

  const { data, error } = await supabase
    .from('body_metrics')
    .select('recorded_on, weight_kg')
    .eq('user_id', userId)
    .gte('recorded_on', since)
    .not('weight_kg', 'is', null)
    .order('recorded_on', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    recordedOn: r.recorded_on as string,
    kg: Number(r.weight_kg),
  }));
}
