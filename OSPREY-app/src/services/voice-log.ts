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

/** Stop the active recording and return the clip as base64 — shared by the
 * set-parsing voice log and the morning check-in. */
export async function stopVoiceRecordingBase64(): Promise<string> {
  if (!recording) throw new Error('No active recording');

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;

  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  if (!uri) throw new Error('Recording produced no file');

  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function stopVoiceRecordingAndParse(): Promise<VoiceLogResult> {
  const audioBase64 = await stopVoiceRecordingBase64();

  const { data, error } = await supabase.functions.invoke<VoiceLogResult>('ozzie-voice-log', {
    method: 'POST',
    body: { audioBase64 },
  });

  if (error || !data) throw error ?? new Error('Failed to parse voice log');
  return data;
}

export function cancelVoiceRecording(): void {
  if (recording) {
    recording.stopAndUnloadAsync().catch(() => undefined);
    recording = null;
  }
}
