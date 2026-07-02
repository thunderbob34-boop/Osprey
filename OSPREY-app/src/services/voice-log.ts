import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/services/supabase';

export interface VoiceLogResult {
  transcript: string;
  weightLbs: number | null;
  reps: number | null;
}

let recording: Audio.Recording | null = null;

export async function startVoiceRecording(): Promise<boolean> {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) return false;

  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return true;
}

async function stopVoiceRecordingAndReadBase64(): Promise<string> {
  if (!recording) throw new Error('No active recording');

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;

  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  if (!uri) throw new Error('Recording produced no file');

  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function stopVoiceRecordingAndParse(): Promise<VoiceLogResult> {
  const audioBase64 = await stopVoiceRecordingAndReadBase64();

  const { data, error } = await supabase.functions.invoke<VoiceLogResult>('ozzie-voice-log', {
    method: 'POST',
    body: { audioBase64 },
  });

  if (error || !data) throw error ?? new Error('Failed to parse voice log');
  return data;
}

export interface LiveCoachContext {
  sessionType: string;
  elapsedS: number;
  distanceKm?: number | null;
  paceMinPerMi?: number | null;
  avgHeartRate?: number | null;
}

export interface LiveCoachResult {
  transcript: string;
  reply: string;
}

/** Records a spoken question mid-workout and gets back Ozzie's spoken answer, grounded in live session context. */
export async function stopVoiceRecordingAndAsk(context: LiveCoachContext): Promise<LiveCoachResult> {
  const audioBase64 = await stopVoiceRecordingAndReadBase64();

  const { data, error } = await supabase.functions.invoke<LiveCoachResult>('ozzie-live-coach', {
    method: 'POST',
    body: { audioBase64, context },
  });

  if (error || !data) throw error ?? new Error('Failed to reach Ozzie');
  return data;
}

export function cancelVoiceRecording(): void {
  if (recording) {
    recording.stopAndUnloadAsync().catch(() => undefined);
    recording = null;
  }
}
