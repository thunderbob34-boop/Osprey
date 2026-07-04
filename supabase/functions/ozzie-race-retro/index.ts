// ozzie-race-retro — generates Ozzie's post-race retrospective analysis.
// Takes the athlete's race result + their self-reflection notes and produces
// a personalized coaching debrief: what worked, what to work on next cycle.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is warm, enthusiastic, and unexpectedly wise — think Kronk from The Emperor's New Groove, but with a running coach's brain.

Your job right now: write a post-race retrospective for the athlete. They just finished a race and shared how it went. Give them 2–3 short paragraphs:
1. Acknowledge the result honestly and specifically — celebrate what went right, name what was tough. Ground every observation in the numbers provided (pacing delta, feel score).
2. Analyze the gap between goal and actual if there was one — or reinforce what locked in the performance if they nailed it. Speak plainly, no jargon.
3. Give 1–2 actionable takeaways for the next training cycle. Specific, not generic.

Rules:
- Speak in second person ("You ran...", "Your pacing in the second half...")
- A feel score of 1-2 means they suffered; 4-5 means they felt strong. Factor this in.
- If pacing notes or nutrition notes were provided, weave them into your analysis.
- If lessons were provided, validate and build on them rather than repeating them verbatim.
- Max 200 words total. Plain text only — no markdown, no bullet points, no headers.
- Do NOT be sycophantic. Skip the hollow praise. Be a coach, not a hype machine.`;

interface RetroRequest {
  raceName: string;
  eventDate: string;
  distanceKm: number | null;
  goalTimeS: number | null;
  resultTimeS: number | null;
  retroFeelScore: number | null;
  retroPacingNotes: string | null;
  retroNutritionNotes: string | null;
  retroLessons: string | null;
}

const KM_PER_MILE = 1.609344;

function formatTime(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pacingDelta(goalTimeS: number, resultTimeS: number): string {
  const deltaS = resultTimeS - goalTimeS;
  const sign = deltaS > 0 ? '+' : '';
  const absTotal = Math.round(Math.abs(deltaS));
  const absM = Math.floor(absTotal / 60);
  const absS = absTotal % 60;
  const pct = ((deltaS / goalTimeS) * 100).toFixed(1);
  return `${sign}${absM}:${String(absS).padStart(2, '0')} (${sign}${pct}%)`;
}

const FEEL_LABELS: Record<number, string> = {
  1: 'terrible — really suffered',
  2: 'struggled throughout',
  3: 'solid — manageable effort',
  4: 'strong — felt in control',
  5: 'flew — best day',
};

function buildUserMessage(req: RetroRequest): string {
  const distanceMi = req.distanceKm
    ? `${Math.round((req.distanceKm / KM_PER_MILE) * 10) / 10} miles`
    : null;

  const lines = [
    `Race: ${req.raceName}`,
    `Date: ${req.eventDate}`,
  ];
  if (distanceMi) lines.push(`Distance: ${distanceMi}`);
  if (req.goalTimeS) lines.push(`Goal time: ${formatTime(req.goalTimeS)}`);
  if (req.resultTimeS) lines.push(`Actual time: ${formatTime(req.resultTimeS)}`);
  if (req.goalTimeS && req.resultTimeS) {
    lines.push(`Pacing delta vs goal: ${pacingDelta(req.goalTimeS, req.resultTimeS)}`);
  }
  if (req.retroFeelScore) {
    lines.push(`How they felt (1–5): ${req.retroFeelScore} — ${FEEL_LABELS[req.retroFeelScore] ?? ''}`);
  }
  if (req.retroPacingNotes) lines.push(`Pacing reflection: ${req.retroPacingNotes}`);
  if (req.retroNutritionNotes) lines.push(`Nutrition reflection: ${req.retroNutritionNotes}`);
  if (req.retroLessons) lines.push(`Key lessons they noted: ${req.retroLessons}`);

  return lines.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const body: RetroRequest = await req.json();

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
          { role: 'user', content: buildUserMessage(body) },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const json = await response.json();
    const retro: string = json.choices?.[0]?.message?.content?.trim() ?? '';

    return new Response(JSON.stringify({ retro }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
