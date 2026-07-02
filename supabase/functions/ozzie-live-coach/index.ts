// Ozzie Live Coach — two-way voice coaching mid-workout.
//
// The athlete taps a push-to-talk button mid-run/lift/endurance session and
// asks a question out loud ("how's my pace looking?", "should I push the
// last mile?"). This transcribes the question with Whisper, then asks
// GPT-4o-mini for a short spoken answer grounded in the live session
// context passed from the client (elapsed time, distance, pace, heart rate)
// — not a general chatbot, a coach who can see the same numbers the athlete
// sees on screen right now.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic.

The athlete is mid-workout right now and just asked you a question out loud. You can see their live session numbers (elapsed time, distance, pace, heart rate if available). Answer their actual question directly using those numbers when relevant — don't just give generic encouragement if they asked something specific.

Rules:
- This is spoken aloud to someone who is actively exercising and out of breath. 1-2 short sentences, max ~40 words. No lists, no markdown.
- Ground every claim in the numbers you were given. If a number wasn't provided (e.g. no heart rate), don't invent one — answer around it.
- If the question is unclear or the transcript seems garbled (exercise audio is noisy), give your best honest read rather than saying you didn't understand — brief and encouraging beats a clarifying question mid-stride.
- Never give medical advice. If something sounds like a real injury concern, say so plainly and suggest stopping/seeing a professional — don't downplay it to stay upbeat.
- Output plain spoken text only. No JSON, no markdown, no stage directions.`;

interface LiveCoachContext {
  sessionType?: string;
  elapsedS?: number;
  distanceKm?: number | null;
  paceMinPerMi?: number | null;
  avgHeartRate?: number | null;
}

const KM_PER_MILE = 1.609344;

function formatContext(ctx: LiveCoachContext): string {
  const lines: string[] = [];
  if (ctx.sessionType) lines.push(`Session type: ${ctx.sessionType}`);
  if (typeof ctx.elapsedS === 'number' && ctx.elapsedS > 0) {
    const m = Math.floor(ctx.elapsedS / 60);
    const s = Math.round(ctx.elapsedS % 60);
    lines.push(`Elapsed time: ${m}:${String(s).padStart(2, '0')}`);
  }
  if (typeof ctx.distanceKm === 'number' && ctx.distanceKm > 0) {
    const miles = Math.round((ctx.distanceKm / KM_PER_MILE) * 100) / 100;
    lines.push(`Distance so far: ${miles} miles`);
  }
  if (typeof ctx.paceMinPerMi === 'number' && ctx.paceMinPerMi > 0) {
    const min = Math.floor(ctx.paceMinPerMi);
    const sec = Math.round((ctx.paceMinPerMi - min) * 60);
    lines.push(`Current pace: ${min}:${String(sec).padStart(2, '0')} /mi`);
  }
  if (typeof ctx.avgHeartRate === 'number' && ctx.avgHeartRate > 0) {
    lines.push(`Heart rate: ${ctx.avgHeartRate} bpm`);
  }
  return lines.length > 0 ? lines.join('\n') : 'No live session numbers were available.';
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

async function generateReply(transcript: string, context: LiveCoachContext): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Live session numbers:\n${formatContext(context)}\n\nAthlete's question: "${transcript}"`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');
  return content.trim();
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
    const { audioBase64, context } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing audioBase64' }), { status: 400 });
    }

    const transcript = await transcribeAudio(audioBase64);
    if (!transcript.trim()) {
      return new Response(
        JSON.stringify({ transcript: '', reply: "Didn't catch that — give it another shot." }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    const reply = await generateReply(transcript, (context ?? {}) as LiveCoachContext);

    return new Response(JSON.stringify({ transcript, reply }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
