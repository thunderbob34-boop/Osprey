import { supabase } from '@/services/supabase';
import { localDateString } from '@/utils/date';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'bib',       label: 'Bib pinned on shirt',    done: false },
  { id: 'chip',      label: 'Timing chip attached',   done: false },
  { id: 'gels',      label: 'Fuel / gels packed',     done: false },
  { id: 'shoes',     label: 'Shoes + socks on',       done: false },
  { id: 'hydration', label: 'Hydration bottle/belt',  done: false },
  { id: 'id',        label: 'ID + race confirmation', done: false },
  { id: 'warmup',    label: 'Dynamic warm-up done',   done: false },
];

export interface RaceEvent {
  id: string;
  name: string;
  distanceKm: number | null;
  eventDate: string; // YYYY-MM-DD
  location: string | null;
  raceUrl: string | null;
  goalTimeS: number | null;
  resultTimeS: number | null;
  notes: string | null;
  daysUntil: number; // negative if in the past
  goalPacePerMile: string | null; // mm:ss /mi, derived from goal time + distance
  // logistics
  packetPickupTime: string | null;
  parkingNotes: string | null;
  gearNotes: string | null;
  morningChecklist: ChecklistItem[] | null;
  ozzieBriefingText: string | null;
  // retrospective
  retroFeelScore: number | null; // 1–5
  retroPacingNotes: string | null;
  retroNutritionNotes: string | null;
  retroLessons: string | null;
  ozzieRetroText: string | null;
}

interface RaceEventRow {
  id: string;
  name: string;
  distance_km: number | null;
  event_date: string;
  location: string | null;
  race_url: string | null;
  goal_time_s: number | null;
  result_time_s: number | null;
  notes: string | null;
  packet_pickup_time: string | null;
  parking_notes: string | null;
  gear_notes: string | null;
  morning_checklist: ChecklistItem[] | null;
  ozzie_briefing_text: string | null;
  retro_feel_score: number | null;
  retro_pacing_notes: string | null;
  retro_nutrition_notes: string | null;
  retro_lessons: string | null;
  ozzie_retro_text: string | null;
}

const KM_PER_MILE = 1.609344;

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** mm:ss per mile from a goal finish time + distance, or null if unknown. */
export function goalPacePerMile(goalTimeS: number | null, distanceKm: number | null): string | null {
  if (!goalTimeS || !distanceKm || distanceKm <= 0) return null;
  const miles = distanceKm / KM_PER_MILE;
  // Round the whole pace first — rounding `sec` after the %60 split can push
  // it to exactly 60 (e.g. 5:59.6/mi rounds sec to 60, displaying "5:60").
  const secPerMile = Math.round(goalTimeS / miles);
  const min = Math.floor(secPerMile / 60);
  const sec = secPerMile % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function formatRaceTime(totalSeconds: number | null): string | null {
  if (totalSeconds == null) return null;
  // Round the whole total first, same :60-rollover reasoning as above.
  const rounded = Math.round(totalSeconds);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parses "h:mm:ss" or "mm:ss" into seconds, or null. */
export function parseRaceTime(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60; // bare number = minutes
  return null;
}

function mapRow(row: RaceEventRow): RaceEvent {
  return {
    id: row.id,
    name: row.name,
    distanceKm: row.distance_km,
    eventDate: row.event_date,
    location: row.location,
    raceUrl: row.race_url,
    goalTimeS: row.goal_time_s,
    resultTimeS: row.result_time_s,
    notes: row.notes,
    daysUntil: daysUntil(row.event_date),
    goalPacePerMile: goalPacePerMile(row.goal_time_s, row.distance_km),
    packetPickupTime: row.packet_pickup_time,
    parkingNotes: row.parking_notes,
    gearNotes: row.gear_notes,
    morningChecklist: row.morning_checklist,
    ozzieBriefingText: row.ozzie_briefing_text,
    retroFeelScore: row.retro_feel_score,
    retroPacingNotes: row.retro_pacing_notes,
    retroNutritionNotes: row.retro_nutrition_notes,
    retroLessons: row.retro_lessons,
    ozzieRetroText: row.ozzie_retro_text,
  };
}

const SELECT_COLS =
  'id, name, distance_km, event_date, location, race_url, goal_time_s, result_time_s, notes, packet_pickup_time, parking_notes, gear_notes, morning_checklist, ozzie_briefing_text, retro_feel_score, retro_pacing_notes, retro_nutrition_notes, retro_lessons, ozzie_retro_text';

/** Upcoming + today's races, soonest first. */
export async function fetchUpcomingRaces(userId: string): Promise<RaceEvent[]> {
  const todayStr = localDateString();
  const { data, error } = await supabase
    .from('race_events')
    .select(SELECT_COLS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('event_date', todayStr)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Past races (results), most recent first. */
export async function fetchPastRaces(userId: string): Promise<RaceEvent[]> {
  const todayStr = localDateString();
  const { data, error } = await supabase
    .from('race_events')
    .select(SELECT_COLS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .lt('event_date', todayStr)
    .order('event_date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export interface RaceEventInput {
  name: string;
  distanceKm?: number | null;
  eventDate: string;
  location?: string | null;
  raceUrl?: string | null;
  goalTimeS?: number | null;
  notes?: string | null;
}

export async function createRaceEvent(userId: string, input: RaceEventInput): Promise<RaceEvent> {
  const { data, error } = await supabase
    .from('race_events')
    .insert({
      user_id: userId,
      name: input.name,
      distance_km: input.distanceKm ?? null,
      event_date: input.eventDate,
      location: input.location ?? null,
      race_url: input.raceUrl ?? null,
      goal_time_s: input.goalTimeS ?? null,
      notes: input.notes ?? null,
    })
    .select(SELECT_COLS)
    .single();

  if (error || !data) throw error ?? new Error('Failed to create race');
  return mapRow(data);
}

export async function recordRaceResult(raceId: string, resultTimeS: number): Promise<void> {
  const { data, error } = await supabase
    .from('race_events')
    .update({ result_time_s: resultTimeS })
    .eq('id', raceId)
    .select('user_id, name')
    .single();
  if (error) throw error;

  // Best-effort — coach memory is a nice-to-have, never block on it.
  const row = data as { user_id: string; name: string } | null;
  if (row) {
    try {
      const { error: memErr } = await supabase.from('coach_memory').upsert(
        {
          user_id: row.user_id,
          event_type: 'race_result',
          race_id: raceId,
          summary: `Finished ${row.name} in ${formatRaceTime(resultTimeS)}.`,
          metadata: { raceName: row.name, resultTimeS },
        },
        { onConflict: 'user_id,event_type,race_id' },
      );
      if (memErr) console.error('[coach-memory] race result record failed', memErr);
    } catch {
      // Best-effort — never let a memory-write failure block recording the result.
    }
  }
}

export async function deleteRaceEvent(raceId: string): Promise<void> {
  const { error } = await supabase
    .from('race_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', raceId);
  if (error) throw error;
}

export interface RaceLogisticsUpdate {
  packetPickupTime?: string | null;
  parkingNotes?: string | null;
  gearNotes?: string | null;
  morningChecklist?: ChecklistItem[] | null;
  ozzieBriefingText?: string | null;
}

export async function updateRaceLogistics(
  raceId: string,
  update: RaceLogisticsUpdate,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ('packetPickupTime' in update) payload.packet_pickup_time = update.packetPickupTime;
  if ('parkingNotes' in update) payload.parking_notes = update.parkingNotes;
  if ('gearNotes' in update) payload.gear_notes = update.gearNotes;
  if ('morningChecklist' in update) payload.morning_checklist = update.morningChecklist;
  if ('ozzieBriefingText' in update) payload.ozzie_briefing_text = update.ozzieBriefingText;

  const { error } = await supabase.from('race_events').update(payload).eq('id', raceId);
  if (error) throw error;
}

export async function generateOzzieBriefing(race: RaceEvent): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ozzie-race-briefing', {
    body: {
      raceName: race.name,
      eventDate: race.eventDate,
      distanceKm: race.distanceKm,
      goalTimeS: race.goalTimeS,
      location: race.location,
      daysUntil: race.daysUntil,
      packetPickupTime: race.packetPickupTime,
      parkingNotes: race.parkingNotes,
      gearNotes: race.gearNotes,
    },
  });
  if (error) throw error;
  const text = (data as { briefing: string })?.briefing;
  if (!text) throw new Error('No briefing returned');
  return text;
}

export interface RaceRetroUpdate {
  retroFeelScore?: number | null;
  retroPacingNotes?: string | null;
  retroNutritionNotes?: string | null;
  retroLessons?: string | null;
  ozzieRetroText?: string | null;
}

export async function updateRaceRetro(raceId: string, update: RaceRetroUpdate): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ('retroFeelScore' in update) payload.retro_feel_score = update.retroFeelScore;
  if ('retroPacingNotes' in update) payload.retro_pacing_notes = update.retroPacingNotes;
  if ('retroNutritionNotes' in update) payload.retro_nutrition_notes = update.retroNutritionNotes;
  if ('retroLessons' in update) payload.retro_lessons = update.retroLessons;
  if ('ozzieRetroText' in update) payload.ozzie_retro_text = update.ozzieRetroText;

  const { error } = await supabase.from('race_events').update(payload).eq('id', raceId);
  if (error) throw error;
}

export async function generateOzzieRetro(race: RaceEvent, retroFeelScore: number | null): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ozzie-race-retro', {
    body: {
      raceName: race.name,
      eventDate: race.eventDate,
      distanceKm: race.distanceKm,
      goalTimeS: race.goalTimeS,
      resultTimeS: race.resultTimeS,
      retroFeelScore,
      retroPacingNotes: race.retroPacingNotes,
      retroNutritionNotes: race.retroNutritionNotes,
      retroLessons: race.retroLessons,
    },
  });
  if (error) throw error;
  const text = (data as { retro: string })?.retro;
  if (!text) throw new Error('No retrospective returned');
  return text;
}

/**
 * Points the user's active training plan at this race so the training block is
 * working toward it (training_plans.target_event_id). No-op if no active plan.
 */
export async function linkRaceToActivePlan(userId: string, raceId: string): Promise<boolean> {
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return false;

  const { error } = await supabase
    .from('training_plans')
    .update({ target_event_id: raceId })
    .eq('id', plan.id);

  if (error) throw error;
  return true;
}
