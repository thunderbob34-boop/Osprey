/**
 * Ozzie Audio Service
 *
 * Handles all TTS calls for Ozzie's voice, via the `ozzie-tts` edge function
 * (never calls ElevenLabs directly — EXPO_PUBLIC_* vars ship inside the JS
 * bundle and are trivially extractable, so the ElevenLabs key must stay
 * server-side).
 * Two profiles:
 *   - 'workout'  → Turbo v2.5, Speaker Boost ON  (mid-run cues over music)
 *   - 'ambient'  → Multilingual v2, Speaker Boost OFF (morning brief, debrief)
 *
 * Audio is cached to device storage so repeat cues don't cost API calls.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/services/supabase';

// ─── Config ──────────────────────────────────────────────────────────────────

const CACHE_DIR = `${FileSystem.cacheDirectory}ozzie-audio/`;

type AudioProfile = 'workout' | 'ambient';

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function cacheKey(text: string, profile: AudioProfile): string {
  // Simple hash: profile + first 60 chars of text, sanitized for filename
  const sanitized = text.slice(0, 60).replace(/[^a-zA-Z0-9]/g, '_');
  return `${CACHE_DIR}${profile}_${sanitized}.mp3`;
}

async function getCachedAudio(path: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

// ─── TTS via edge function ────────────────────────────────────────────────────
// Routed through `ozzie-tts` so the ElevenLabs key stays server-side.

async function fetchTTS(text: string, profile: AudioProfile): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ audioBase64: string }>('ozzie-tts', {
    body: { text, profile },
  });

  if (error || !data?.audioBase64) {
    throw error ?? new Error('ozzie-tts returned no audio');
  }

  return data.audioBase64;
}

// ─── Public API ───────────────────────────────────────────────────────────────

let currentSound: Audio.Sound | null = null;

/**
 * Speak a line as Ozzie.
 * Caches to disk — repeat calls with the same text are instant and free.
 *
 * @param text     What Ozzie says
 * @param profile  'workout' (mid-run) or 'ambient' (daily brief, debrief)
 */
export async function ozzieSpeak(text: string, profile: AudioProfile = 'ambient') {
  try {
    await ensureCacheDir();

    // Stop any currently playing audio
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }

    // Check cache first
    const cachePath = cacheKey(text, profile);
    let audioPath = await getCachedAudio(cachePath);

    if (!audioPath) {
      // Fetch from ElevenLabs and cache
      const audioBase64 = await fetchTTS(text, profile);
      await FileSystem.writeAsStringAsync(
        cachePath,
        audioBase64,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      audioPath = cachePath;
    }

    // Play
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: audioPath },
      { shouldPlay: true, volume: 1.0 }
    );
    currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        currentSound = null;
      }
    });

  } catch (err) {
    console.error('[Ozzie] TTS error:', err);
  }
}

/**
 * Stop Ozzie mid-speech (e.g. user pauses workout)
 */
export async function ozzieStop() {
  if (currentSound) {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
    currentSound = null;
  }
}

/**
 * Pre-warm: generate and cache common phrases at app launch
 * so the first mid-run cue is instant.
 */
export async function ozziePrewarm() {
  const commonCues = [
    { text: "Let's get after it.", profile: 'workout' as AudioProfile },
    { text: "Nice work. Keep that pace.", profile: 'workout' as AudioProfile },
    { text: "One mile down.", profile: 'workout' as AudioProfile },
    { text: "Halfway. You've got this.", profile: 'workout' as AudioProfile },
    { text: "Final mile. Empty the tank.", profile: 'workout' as AudioProfile },
  ];

  for (const cue of commonCues) {
    const path = cacheKey(cue.text, cue.profile);
    const cached = await getCachedAudio(path);
    if (!cached) {
      try {
        const audioBase64 = await fetchTTS(cue.text, cue.profile);
        await ensureCacheDir();
        await FileSystem.writeAsStringAsync(
          path,
          audioBase64,
          { encoding: FileSystem.EncodingType.Base64 }
        );
      } catch {
        // Silent fail — prewarm is best-effort
      }
    }
  }
}
