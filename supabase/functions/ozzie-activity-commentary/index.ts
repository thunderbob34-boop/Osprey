// Ozzie Activity Commentary — a short Ozzie-voiced reaction to a shared
// workout, posted alongside the share in the activity feed. Strava has
// kudos and comments from other humans; this adds the coach's own reaction,
// grounded in the actual workout, right when it's posted.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic.

An athlete just shared a completed workout to their friends' activity feed. Write ONE short reaction comment, like a coach who actually saw the numbers, not a generic "nice job!".

Rules:
- One sentence, max ~25 words. This is a feed comment, not a debrief.
- Ground it in the actual numbers given (session type, duration, distance if present, their caption if they wrote one).
- No hashtags, no emoji spam (one emoji max, optional).
- Output plain text only, no quotes, no markdown.`;

const KM_PER_MILE = 1.609344;

interface WorkoutInfo {
  sessionType: string;
  totalDurationS: number | null;
  totalDistanceKm: number | null;
  caption: string | null;
}

function buildUserMessage(info: WorkoutInfo): string {
  const lines = [`Session type: ${info.sessionType}`];
  if (info.totalDurationS) {
    const min = Math.round(info.totalDurationS / 60);
    lines.push(`Duration: ${min} min`);
  }
  if (info.totalDistanceKm) {
    const miles = Math.round((info.totalDistanceKm / KM_PER_MILE) * 10) / 10;
    lines.push(`Distance: ${miles} miles`);
  }
  if (info.caption) lines.push(`Their caption: "${info.caption}"`);
  return lines.join('\n');
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
    const { shareId } = await req.json();
    if (!shareId || typeof shareId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing shareId' }), { status: 400 });
    }

    const { data: share, error: shareError } = await supabase
      .from('activity_shares')
      .select('id, user_id, caption, workout_logs(session_type, total_duration_s, total_distance_km)')
      .eq('id', shareId)
      .maybeSingle();

    if (shareError || !share) {
      return new Response(JSON.stringify({ error: 'Share not found' }), { status: 404 });
    }

    // Only the athlete who posted the share can trigger commentary on it.
    if (share.user_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const workout = share.workout_logs as unknown as {
      session_type: string;
      total_duration_s: number | null;
      total_distance_km: number | null;
    } | null;

    if (!workout) {
      return new Response(JSON.stringify({ error: 'Workout not found for this share' }), { status: 404 });
    }

    const info: WorkoutInfo = {
      sessionType: workout.session_type,
      totalDurationS: workout.total_duration_s,
      totalDistanceKm: workout.total_distance_km,
      caption: share.caption,
    };

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
          { role: 'user', content: buildUserMessage(info) },
        ],
        max_tokens: 60,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const comment: string = data.choices?.[0]?.message?.content?.trim() ?? '';

    if (comment) {
      await supabase.from('activity_shares').update({ ozzie_comment: comment }).eq('id', shareId);
    }

    return new Response(JSON.stringify({ comment }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
