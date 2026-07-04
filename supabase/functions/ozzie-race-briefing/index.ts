// ozzie-race-briefing — generates a personalized race-morning pep talk.
// Called the morning of (or days before) a race to prep the athlete.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is warm, enthusiastic, and unexpectedly wise — think Kronk from The Emperor's New Groove, but with a running coach's brain. You celebrate hard things without being sycophantic. You speak directly to the athlete.

Your job right now: write a race-morning briefing — a short, punchy, motivating paragraph (3-5 sentences) that gets the athlete ready to race. Ground it in the specific race details provided. Mention the distance, goal time, and any logistics they shared.

Rules:
- Speak in second person ("You've got this", "Your goal is…")
- Acknowledge the logistics if provided (pickup time, parking, gear notes) — make the athlete feel organized and prepared
- End with one crisp, specific race-day tip or mantra tied to their goal pace or distance
- No generic hype. No "LET'S GOOOO". No hollow affirmations.
- Output plain text only — no JSON, no markdown, no bullet points. One flowing paragraph.`;

interface BriefingRequest {
  raceName: string;
  eventDate: string;
  distanceKm: number | null;
  goalTimeS: number | null;
  location: string | null;
  daysUntil: number;
  packetPickupTime: string | null;
  parkingNotes: string | null;
  gearNotes: string | null;
}

const KM_PER_MILE = 1.609344;

function formatGoalPace(goalTimeS: number, distanceKm: number): string {
  const miles = distanceKm / KM_PER_MILE;
  const totalSec = Math.round(goalTimeS / miles);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')} /mi`;
}

function formatTime(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildUserMessage(req: BriefingRequest): string {
  const distanceMi = req.distanceKm ? `${Math.round((req.distanceKm / KM_PER_MILE) * 10) / 10} miles` : null;
  const goalTime = req.goalTimeS ? formatTime(req.goalTimeS) : null;
  const goalPace =
    req.goalTimeS && req.distanceKm ? formatGoalPace(req.goalTimeS, req.distanceKm) : null;
  const countdown = req.daysUntil === 0 ? 'today' : req.daysUntil === 1 ? 'tomorrow' : `in ${req.daysUntil} days`;

  const lines = [
    `Race: ${req.raceName}`,
    `Date: ${req.eventDate} (${countdown})`,
  ];
  if (req.location) lines.push(`Location: ${req.location}`);
  if (distanceMi) lines.push(`Distance: ${distanceMi}`);
  if (goalTime) lines.push(`Goal finish time: ${goalTime}`);
  if (goalPace) lines.push(`Target pace: ${goalPace}`);
  if (req.packetPickupTime) lines.push(`Packet pickup: ${req.packetPickupTime}`);
  if (req.parkingNotes) lines.push(`Parking/transit: ${req.parkingNotes}`);
  if (req.gearNotes) lines.push(`Gear notes: ${req.gearNotes}`);

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
    const body: BriefingRequest = await req.json();

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
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const json = await response.json();
    const briefing: string = json.choices?.[0]?.message?.content?.trim() ?? '';

    return new Response(JSON.stringify({ briefing }), {
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
