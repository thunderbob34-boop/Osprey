// Ozzie Check-In — a spoken morning "how are you actually feeling?"
//
// Takes a base64 audio clip of the athlete answering out loud (or plain
// text as a fallback), transcribes it with Whisper, extracts structured
// subjective signal (energy, soreness, mood, sentiment) with GPT-4o-mini,
// stores it in subjective_checkins, and blends it into today's
// recovery_scores row: HRV/sleep are objective but blind to "my knee's
// been weird" and "mentally fried" — the exact things a coach asks about.
//
// Blend rules (bounded so a grumpy morning can't nuke a good HRV day):
//   subjective modifier = (energy - 3) * 4  minus 5 per sore area (max -10)
//   clamped to [-12, +8], applied to the existing score if one exists,
//   or to a neutral 70 base when there's no HealthKit data at all.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const EXTRACT_SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app — warm, Kronk-spirited, genuinely kind. The athlete just answered your morning check-in out loud ("how'd you sleep, anything sore, how are you feeling?"). You are given the raw transcript.

Extract what they actually said — never invent symptoms or feelings they didn't express:
- energyLevel: 1-5 (1 = wrecked/exhausted, 3 = normal, 5 = fantastic). If they don't address energy at all, use 3.
- sorenessAreas: array of lowercase body areas they mention as sore/tight/hurting (e.g. ["left knee", "lower back"]). Empty array if none. Aches described as fully resolved don't count.
- mood: one lowercase word capturing their state ("good", "tired", "stressed", "fired-up", "flat", ...).
- sentimentScore: -1.0 (very negative) to 1.0 (very positive) overall tone.
- ozzieReply: 1-2 sentences back to them in Ozzie's voice. Acknowledge specifics they shared. If they mention pain that sounds like injury (sharp, worsening, persistent), gently suggest easing off and seeing a professional if it lingers — never diagnose.

Respond ONLY with valid JSON: {"energyLevel": number, "sorenessAreas": string[], "mood": string, "sentimentScore": number, "ozzieReply": string}`;

interface CheckinExtraction {
  energyLevel: number;
  sorenessAreas: string[];
  mood: string;
  sentimentScore: number;
  ozzieReply: string;
}

async function transcribeAudio(audioBase64: string): Promise<string> {
  const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const formData = new FormData();
  formData.append('file', new Blob([audioBytes], { type: 'audio/m4a' }), 'audio.m4a');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Whisper error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.text ?? '';
}

async function extractCheckin(transcript: string): Promise<CheckinExtraction> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: `Transcript: "${transcript}"` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 250,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');
  const parsed = JSON.parse(content);

  const energy = Number(parsed.energyLevel);
  const sentiment = Number(parsed.sentimentScore);
  return {
    energyLevel: isFinite(energy) ? Math.min(5, Math.max(1, Math.round(energy))) : 3,
    sorenessAreas: Array.isArray(parsed.sorenessAreas)
      ? parsed.sorenessAreas.filter((a: unknown) => typeof a === 'string').slice(0, 8)
      : [],
    mood: typeof parsed.mood === 'string' ? parsed.mood.slice(0, 32) : 'unknown',
    sentimentScore: isFinite(sentiment) ? Math.min(1, Math.max(-1, Math.round(sentiment * 100) / 100)) : 0,
    ozzieReply:
      typeof parsed.ozzieReply === 'string' && parsed.ozzieReply.trim()
        ? parsed.ozzieReply.trim()
        : 'Got it — thanks for checking in. Let\'s make today count.',
  };
}

function subjectiveModifier(extraction: CheckinExtraction): number {
  const energyPart = (extraction.energyLevel - 3) * 4; // -8 .. +8
  const sorenessPart = -Math.min(10, extraction.sorenessAreas.length * 5); // 0 .. -10
  return Math.max(-12, Math.min(8, energyPart + sorenessPart));
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

  const userId = authData.user.id;

  try {
    const body = await req.json();
    // Client sends its LOCAL date so the check-in lands on the user's morning.
    const checkinDate: string =
      typeof body?.checkinDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.checkinDate)
        ? body.checkinDate
        : new Date().toISOString().slice(0, 10);

    let transcript: string;
    if (typeof body?.audioBase64 === 'string' && body.audioBase64.length > 0) {
      transcript = await transcribeAudio(body.audioBase64);
    } else if (typeof body?.text === 'string' && body.text.trim()) {
      transcript = body.text.trim();
    } else {
      return new Response(JSON.stringify({ error: 'Missing audioBase64 or text' }), { status: 400 });
    }

    if (!transcript.trim()) {
      return new Response(
        JSON.stringify({ error: "Didn't catch that — try again a little closer to the mic." }),
        { status: 422 },
      );
    }

    const extraction = await extractCheckin(transcript);

    await supabase.from('subjective_checkins').upsert(
      {
        user_id: userId,
        checkin_date: checkinDate,
        transcript,
        energy_level: extraction.energyLevel,
        soreness_areas: extraction.sorenessAreas,
        mood: extraction.mood,
        sentiment_score: extraction.sentimentScore,
        ozzie_reply: extraction.ozzieReply,
      },
      { onConflict: 'user_id,checkin_date' },
    );

    // Blend into today's recovery score. If HealthKit already wrote a row,
    // nudge it; if not, the check-in alone seeds one from a neutral base so
    // non-HealthKit users still get a recommendation.
    const modifier = subjectiveModifier(extraction);
    const { data: existing } = await supabase
      .from('recovery_scores')
      .select('score')
      .eq('user_id', userId)
      .eq('score_date', checkinDate)
      .maybeSingle();

    const baseScore = existing ? Number(existing.score) : 70;
    const blended = Math.max(0, Math.min(100, Math.round(baseScore + modifier)));
    const recommendation = blended >= 65 ? 'train' : blended >= 40 ? 'easy' : 'rest';

    await supabase.from('recovery_scores').upsert(
      {
        user_id: userId,
        score_date: checkinDate,
        score: blended,
        recommendation,
      },
      { onConflict: 'user_id,score_date' },
    );

    return new Response(
      JSON.stringify({
        transcript,
        energyLevel: extraction.energyLevel,
        sorenessAreas: extraction.sorenessAreas,
        mood: extraction.mood,
        sentimentScore: extraction.sentimentScore,
        ozzieReply: extraction.ozzieReply,
        recoveryScore: blended,
        recommendation,
        subjectiveModifier: modifier,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('ozzie-checkin error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
