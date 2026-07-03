import { format } from 'date-fns';
import { supabase } from '@/services/supabase';

export interface CheckinResult {
  transcript: string;
  energyLevel: number;
  sorenessAreas: string[];
  mood: string;
  sentimentScore: number;
  ozzieReply: string;
  recoveryScore: number;
  recommendation: 'train' | 'easy' | 'rest';
}

function todayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Send this morning's spoken check-in for transcription + extraction. */
export async function submitCheckinAudio(audioBase64: string): Promise<CheckinResult> {
  const { data, error } = await supabase.functions.invoke<CheckinResult & { error?: string }>(
    'ozzie-checkin',
    { method: 'POST', body: { audioBase64, checkinDate: todayLocal() } },
  );
  if (error || !data) throw error ?? new Error('Check-in failed');
  if ((data as { error?: string }).error) throw new Error((data as { error?: string }).error);
  return data;
}

/** Has the user already checked in today? Used to hide the Home prompt. */
export async function fetchTodayCheckin(userId: string): Promise<CheckinResult | null> {
  const { data, error } = await supabase
    .from('subjective_checkins')
    .select('transcript, energy_level, soreness_areas, mood, sentiment_score, ozzie_reply')
    .eq('user_id', userId)
    .eq('checkin_date', todayLocal())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    transcript: data.transcript,
    energyLevel: data.energy_level ?? 3,
    sorenessAreas: data.soreness_areas ?? [],
    mood: data.mood ?? 'unknown',
    sentimentScore: data.sentiment_score != null ? Number(data.sentiment_score) : 0,
    ozzieReply: data.ozzie_reply ?? '',
    recoveryScore: 0,
    recommendation: 'train',
  };
}
