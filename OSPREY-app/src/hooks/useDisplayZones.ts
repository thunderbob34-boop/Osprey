import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { resolveZones, type ZonesConfidence, type HrZoneInfo } from '@/services/coaching/envelope';
import type { ZoneSet } from '@/services/coaching/zones';
import { resolveMaxHR, ultraHRZones } from '@/services/coaching/hr';
import { toSelfReportAnchor, type ThresholdAnchorMap } from '@/services/coaching/baseline';
import { selectBestRunEffort, selectBestRowingSplit } from '@/services/coaching/anchor';

const MILES_PER_KM = 0.621371;
const RECENT_WINDOW_MS = 56 * 24 * 60 * 60 * 1000;

export interface DisplayZones {
  zones: ZoneSet | null;
  hrZones: HrZoneInfo;
  confidence: ZonesConfidence;
}

export function useDisplayZones(): DisplayZones | null {
  const userId = useAuthStore((s) => s.user?.id);
  const [result, setResult] = useState<DisplayZones | null>(null);

  useEffect(() => {
    if (!userId) { setResult(null); return; }
    let cancelled = false;
    (async () => {
      const [goalsRes, weightRes, runsRes, rowsRes, maxHrRes] = await Promise.all([
        supabase.from('user_goals').select('primary_goal, fitness_level, threshold_anchor').eq('user_id', userId).maybeSingle(),
        supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'run').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
        supabase.from('workout_logs').select('total_distance_km, total_duration_s').eq('user_id', userId).eq('session_type', 'rowing').is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).order('started_at', { ascending: false }).limit(30),
        supabase.from('workout_logs').select('max_heart_rate').eq('user_id', userId).is('deleted_at', null).gte('started_at', new Date(Date.now() - RECENT_WINDOW_MS).toISOString()).not('max_heart_rate', 'is', null).order('max_heart_rate', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      const g = goalsRes.data;
      const sport = g?.primary_goal ?? 'run';
      if (sport === 'lift') { setResult(null); return; } // strength has no pace zones — no card

      const bestEffort = selectBestRunEffort(
        (runsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
          .map((r) => ({ distanceMiles: (r.total_distance_km as number) * MILES_PER_KM, timeS: r.total_duration_s as number })),
      );
      const rowingSplit = selectBestRowingSplit(
        (rowsRes.data ?? []).filter((r) => r.total_distance_km && r.total_duration_s)
          .map((r) => ({ distanceKm: r.total_distance_km as number, timeS: r.total_duration_s as number })),
      );

      const input = {
        sport, phase: 'Base' as const, weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
        fitnessLevel: g?.fitness_level ?? 'beginner',
        bodyWeightKg: (weightRes.data?.weight_kg as number | null) ?? 70,
        bestRunMiles: bestEffort?.distanceMiles ?? null,
        bestRunTimeS: bestEffort?.timeS ?? null,
        rowingSplitSecPer500: rowingSplit,
        selfReportAnchor: toSelfReportAnchor(g?.threshold_anchor as ThresholdAnchorMap | null),
        maxHR: (maxHrRes.data?.max_heart_rate as number | null) ?? null,
      };

      const { zones, zonesConfidence } = resolveZones(input);
      const hr = resolveMaxHR(input.maxHR);
      const hrZones: HrZoneInfo = { maxHR: hr.maxHR, source: hr.source, bands: ultraHRZones(hr.maxHR) };
      // When there are pace zones, use their confidence; otherwise the card shows HR, so use the HR source.
      const confidence: ZonesConfidence = zones ? zonesConfidence : hr.source === 'estimated' ? 'estimated' : 'measured';
      setResult({ zones, hrZones, confidence });
    })().catch(() => { if (!cancelled) setResult(null); });
    return () => { cancelled = true; };
  }, [userId]);

  return result;
}
