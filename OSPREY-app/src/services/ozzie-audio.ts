/**
 * Ozzie Audio Service
 *
 * Handles all ElevenLabs TTS calls for Ozzie's voice.
 * Two profiles:
 *   - 'workout'  → Turbo v2.5, Speaker Boost ON  (mid-run cues over music)
 *   - 'ambient'  → Multilingual v2, Speaker Boost OFF (morning brief, debrief)
 *
 * Audio is cached to device storage so repeat cues don't cost API calls.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// ─── Config ──────────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const OZZIE_VOICE_ID = process.env.EXPO_PUBLIC_OZZIE_VOICE_ID ?? 'REPLACE_AFTER_CASTING';

const CACHE_DIR = `${FileSystem.cacheDirectory}ozzie-audio/`;

type AudioProfile = 'workout' | 'ambient';

const PROFILES: Record<AudioProfile, {
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}> = {
  workout: {
    modelId: 'eleven_turbo_v2_5',
    stability: 0.50,
    similarityBoost: 0.80,
    style: 0.25,
    useSpeakerBoost: true,
  },
  ambient: {
    modelId: 'eleven_multilingual_v2',
    stability: 0.45,
    similarityBoost: 0.80,
    style: 0.30,
    useSpeakerBoost: false,
  },
};

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(text: string, profile: AudioProfile): string {
  // Truncated text for a readable filename + a full-text hash so two cues
  // that only differ after char 60 don't collide on the same cache file.
  const sanitized = text.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_');
  return `${CACHE_DIR}${profile}_${sanitized}_${hashText(text)}.mp3`;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes has no global `Buffer` — encode raw bytes to base64 by hand. */
function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b3 & 63] : '=';
  }
  return result;
}

async function getCachedAudio(path: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

// ─── ElevenLabs API call ──────────────────────────────────────────────────────

async function fetchTTS(text: string, profile: AudioProfile): Promise<Uint8Array> {
  const config = PROFILES[profile];

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${OZZIE_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: config.modelId,
        voice_settings: {
          stability: config.stability,
          similarity_boost: config.similarityBoost,
          style: config.style,
          use_speaker_boost: config.useSpeakerBoost,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs error: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
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
  if (!ELEVENLABS_API_KEY || !OZZIE_VOICE_ID || OZZIE_VOICE_ID === 'REPLACE_AFTER_CASTING') {
    console.warn('[Ozzie] ElevenLabs not configured — skipping TTS');
    return;
  }

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
      const audioData = await fetchTTS(text, profile);
      await FileSystem.writeAsStringAsync(
        cachePath,
        bytesToBase64(audioData),
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
    const sound = currentSound;
    currentSound = null;
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      // Already unloaded (e.g. playback finished right as stop was requested) — fine.
    }
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
        const audioData = await fetchTTS(cue.text, cue.profile);
        await ensureCacheDir();
        await FileSystem.writeAsStringAsync(
          path,
          bytesToBase64(audioData),
          { encoding: FileSystem.EncodingType.Base64 }
        );
      } catch {
        // Silent fail — prewarm is best-effort
      }
    }
  }
}
