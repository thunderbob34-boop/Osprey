import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { TrainingSessionSchema, RaceEventSchema } from '../../lib/schemas';
import { matchTuneUpWeeks, parseGoalDistanceFromText, type TuneUpWeek } from '../../lib/tuneups';
import type { TrainingSession } from '../../lib/schemas';
import { toDateInputValue } from '../../lib/day';

export function useMonthSessions(userId: string, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ['sessions', userId, fromISO],
    queryFn: async () => {
      const { data, error } = await supabase.from('training_sessions').select('*')
        .eq('user_id', userId).gte('session_date', fromISO).lte('session_date', toISO).order('session_date');
      if (error) throw error;
      return z.array(TrainingSessionSchema).parse(data);
    },
  });
}

export function useCompletions(userId: string, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ['completions', userId, fromISO],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('workout_logs').select('session_id')
        .eq('user_id', userId).eq('status', 'completed').is('deleted_at', null)
        .not('session_id', 'is', null)
        .gte('started_at', `${fromISO}T00:00:00Z`).lte('started_at', `${toISO}T23:59:59Z`);
      if (error) throw error;
      return new Set((data as Array<{ session_id: string }>).map((r) => r.session_id));
    },
  });
}

/** Race events (goal race + any tune-up races) falling in the visible month. */
export function useMonthRaceEvents(userId: string, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ['race-events', userId, fromISO],
    queryFn: async () => {
      const { data, error } = await supabase.from('race_events')
        .select('id, user_id, name, distance_km, event_date, goal_time_s, result_time_s, notes')
        .eq('user_id', userId).is('deleted_at', null)
        .gte('event_date', fromISO).lte('event_date', toISO).order('event_date');
      if (error) throw error;
      return z.array(RaceEventSchema).parse(data);
    },
  });
}

/** The next upcoming race event (goal race or otherwise), regardless of month in view. */
export function useNextRaceEvent(userId: string) {
  return useQuery({
    queryKey: ['next-race-event', userId],
    queryFn: async () => {
      const today = toDateInputValue(new Date());
      const { data, error } = await supabase.from('race_events')
        .select('id, user_id, name, distance_km, event_date, goal_time_s, result_time_s, notes')
        .eq('user_id', userId).is('deleted_at', null)
        .gte('event_date', today).order('event_date').limit(1).maybeSingle();
      if (error) throw error;
      return data ? RaceEventSchema.parse(data) : null;
    },
  });
}

/** Best logged run in the last N days — feeds the Riegel race-time predictor. */
export function useBestRun(userId: string, days = 84) {
  return useQuery({
    queryKey: ['best-run', userId, days],
    queryFn: async (): Promise<{ miles: number; timeS: number } | null> => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase.from('workout_logs')
        .select('total_distance_km, total_duration_s')
        .eq('user_id', userId).eq('session_type', 'run').eq('status', 'completed').is('deleted_at', null)
        .gte('started_at', since.toISOString())
        .not('total_distance_km', 'is', null).not('total_duration_s', 'is', null);
      if (error) throw error;
      const KM_TO_MILES = 0.621371;
      let bestMiles = 0, bestTimeS = 0;
      for (const row of (data ?? []) as Array<{ total_distance_km: number; total_duration_s: number }>) {
        const miles = row.total_distance_km * KM_TO_MILES;
        if (row.total_duration_s > 0 && miles > bestMiles) { bestMiles = miles; bestTimeS = row.total_duration_s; }
      }
      return bestMiles > 0 ? { miles: bestMiles, timeS: bestTimeS } : null;
    },
  });
}

/**
 * Resolves the active plan's goal distance: the linked race_events row if
 * training_plans.target_event_id is set, otherwise parsed from
 * user_goals.target_race (the onboarding input that generated the plan —
 * reliably populated even when target_event_id isn't). Returns null if
 * neither source yields a distance.
 */
export function useGoalDistanceKm(userId: string) {
  return useQuery({
    queryKey: ['goal-distance', userId],
    queryFn: async (): Promise<number | null> => {
      const { data: plan, error: planErr } = await supabase.from('training_plans')
        .select('target_event_id')
        .eq('user_id', userId).eq('status', 'active')
        .order('start_date', { ascending: false }).limit(1).maybeSingle();
      if (planErr) throw planErr;
      if (!plan) return null;

      if (plan.target_event_id) {
        const { data: race, error: raceErr } = await supabase.from('race_events')
          .select('distance_km').eq('id', plan.target_event_id).maybeSingle();
        if (raceErr) throw raceErr;
        if (race?.distance_km) return Number(race.distance_km);
      }

      const { data: goal, error: goalErr } = await supabase.from('user_goals')
        .select('target_race').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (goalErr) throw goalErr;
      if (goal?.target_race) return parseGoalDistanceFromText(goal.target_race);
      return null;
    },
  });
}

/** Derived (no network call) — which of the given sessions are tune-up opportunities. */
export function useTuneUpWeeks(sessions: TrainingSession[] | undefined, goalDistanceKm: number | null | undefined): TuneUpWeek[] {
  return useMemo(() => {
    if (!sessions || goalDistanceKm == null) return [];
    return matchTuneUpWeeks(
      sessions.map((s) => ({
        id: s.id, weekId: s.week_id, sessionDate: s.session_date,
        sessionType: s.session_type, plannedDistanceKm: s.planned_distance_km,
      })),
      goalDistanceKm,
    );
  }, [sessions, goalDistanceKm]);
}
