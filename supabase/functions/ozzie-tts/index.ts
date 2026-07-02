// Ozzie TTS — proxies ElevenLabs text-to-speech so the ElevenLabs API key
// never ships inside the client bundle. EXPO_PUBLIC_* vars are embedded in
// the JS bundle and trivially extractable, so this call must be server-side.
//
// Takes { text, profile } and returns { audioBase64 }.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') ?? '';
const OZZIE_VOICE_ID = Deno.env.get('OZZIE_VOICE_ID') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  if (!ELEVENLABS_API_KEY || !OZZIE_VOICE_ID) {
    return new Response(JSON.stringify({ error: 'TTS not configured' }), { status: 503 });
  }

  try {
    const { text, profile } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 });
    }
    if (text.length > 2000) {
      return new Response(JSON.stringify({ error: 'text too long' }), { status: 400 });
    }

    const config = PROFILES[profile as AudioProfile] ?? PROFILES.ambient;

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
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs error: ${response.status} ${errText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = bytesToBase64(new Uint8Array(audioBuffer));

    return new Response(JSON.stringify({ audioBase64 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
