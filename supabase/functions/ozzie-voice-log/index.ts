// Ozzie Voice Log — transcribes a spoken set and parses reps/weight
//
// Takes a base64-encoded audio clip (the user saying something like
// "185 for 10" or "bench press, three plates for eight"), transcribes it
// with Whisper, then asks GPT-4o-mini to extract structured weight/reps.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const PARSE_SYSTEM_PROMPT = `You parse a single spoken weightlifting set into structured data. The user might say things like "185 for 10", "bench press, ten reps at 135 pounds", "three plates for eight", or just "12 reps".

Rules:
- Extract weightLbs (number) and reps (number) if mentioned. If either is missing/unclear, use null for that field.
- "plates" means 45lb plates per side typically loaded on a barbell (45 bar + plates*45*2), but if ambiguous just do your best guess or null.
- Respond ONLY with valid JSON matching this shape: {"weightLbs": number | null, "reps": number | null}`;

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

async function parseSet(transcript: string): Promise<{ weightLbs: number | null; reps: number | null }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PARSE_SYSTEM_PROMPT },
        { role: 'user', content: `Transcript: "${transcript}"` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 60,
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
  return { weightLbs: parsed.weightLbs ?? null, reps: parsed.reps ?? null };
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

  try {
    const { audioBase64 } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing audioBase64' }), { status: 400 });
    }

    const transcript = await transcribeAudio(audioBase64);
    const { weightLbs, reps } = await parseSet(transcript);

    return new Response(JSON.stringify({ transcript, weightLbs, reps }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ozzie-voice-log error:', err);
    return new Response(JSON.stringify({ error: 'Failed to process voice log. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
