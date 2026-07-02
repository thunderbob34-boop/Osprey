// Ozzie Challenge Recap — an on-demand weekly recap for a group challenge,
// narrated in Ozzie's voice. Strava challenges are just a leaderboard;
// this turns the same numbers into something that reads like a coach
// actually watched the week happen ("Alice took the lead with a big Sunday
// long run — Bob, 12 miles to catch up by Friday").
//
// Triggered on-demand (a button in the challenge detail view) rather than
// on a schedule — this environment has no cron/pg_net infra to verify
// against, and an on-demand generate is a reasonable v1.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic.

You're writing a recap of a group challenge's standings for its members. Make it feel like a coach who watched the week happen, not a leaderboard readout.

Rules:
- 3-5 sentences.
- Call out the leader by name and what specifically put them ahead if the data suggests it (e.g., a big total vs. the field).
- If it's close, say so — name who's within striking distance of whom.
- If someone's fallen behind, be encouraging about it, not shaming.
- Ground every claim in the numbers provided. Don't invent specific workouts you weren't told about.
- Plain text only, no markdown, no headers.`;

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  value: number;
}

async function computeLeaderboard(
  supabase: ReturnType<typeof createClient>,
  challengeId: string,
): Promise<{ challenge: { name: string; type: string; startsOn: string; endsOn: string } | null; leaderboard: LeaderboardEntry[] }> {
  const { data: challenge } = await supabase
    .from('challenges')
    .select('name, type, starts_on, ends_on')
    .eq('id', challengeId)
    .maybeSingle();

  if (!challenge) return { challenge: null, leaderboard: [] };

  const { data: members } = await supabase
    .from('challenge_members')
    .select('user_id, users(display_name)')
    .eq('challenge_id', challengeId);

  const memberRows = (members ?? []) as unknown as { user_id: string; users: { display_name: string } | null }[];
  if (memberRows.length === 0) {
    return {
      challenge: { name: challenge.name, type: challenge.type, startsOn: challenge.starts_on, endsOn: challenge.ends_on },
      leaderboard: [],
    };
  }

  const memberIds = memberRows.map((m) => m.user_id);
  const { data: workouts } = await supabase
    .from('workout_logs')
    .select('user_id, total_distance_km, total_duration_s')
    .in('user_id', memberIds)
    .in('status', ['completed', 'partial'])
    .is('deleted_at', null)
    .gte('started_at', `${challenge.starts_on}T00:00:00Z`)
    .lte('started_at', `${challenge.ends_on}T23:59:59Z`);

  const KM_PER_MILE = 1.609344;
  const totals = new Map<string, number>();
  for (const m of memberIds) totals.set(m, 0);

  for (const w of workouts ?? []) {
    const current = totals.get(w.user_id) ?? 0;
    if (challenge.type === 'mileage') {
      totals.set(w.user_id, current + (w.total_distance_km ? w.total_distance_km / KM_PER_MILE : 0));
    } else if (challenge.type === 'workouts') {
      totals.set(w.user_id, current + 1);
    } else if (challenge.type === 'duration') {
      totals.set(w.user_id, current + (w.total_duration_s ? w.total_duration_s / 60 : 0));
    }
  }

  const leaderboard: LeaderboardEntry[] = memberRows
    .map((m) => ({
      userId: m.user_id,
      displayName: m.users?.display_name ?? 'Someone',
      value: Math.round((totals.get(m.user_id) ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    challenge: { name: challenge.name, type: challenge.type, startsOn: challenge.starts_on, endsOn: challenge.ends_on },
    leaderboard,
  };
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
    const { challengeId } = await req.json();
    if (!challengeId || typeof challengeId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing challengeId' }), { status: 400 });
    }

    // Manual membership check — this runs on the service-role client so
    // RLS/auth.uid() don't apply here the way they do for a client-side
    // call; scope is enforced explicitly instead (same pattern the other
    // Ozzie functions use to check ownership before touching user data).
    const { data: challengeRow } = await supabase
      .from('challenges')
      .select('creator_user_id')
      .eq('id', challengeId)
      .maybeSingle();

    if (!challengeRow) {
      return new Response(JSON.stringify({ error: 'Challenge not found' }), { status: 404 });
    }

    let isMember = challengeRow.creator_user_id === authData.user.id;
    if (!isMember) {
      const { data: memberRow } = await supabase
        .from('challenge_members')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('user_id', authData.user.id)
        .maybeSingle();
      isMember = Boolean(memberRow);
    }

    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const { challenge, leaderboard } = await computeLeaderboard(supabase, challengeId);
    if (!challenge) {
      return new Response(JSON.stringify({ error: 'Challenge not found' }), { status: 404 });
    }

    const unit = challenge.type === 'mileage' ? 'miles' : challenge.type === 'duration' ? 'minutes' : 'workouts';

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
            content: `Challenge: "${challenge.name}" (${challenge.type}, ${challenge.startsOn} to ${challenge.endsOn})\nStandings (${unit}):\n${leaderboard
              .map((e, i) => `${i + 1}. ${e.displayName} — ${e.value} ${unit}`)
              .join('\n')}`,
          },
        ],
        max_tokens: 220,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const recapText: string = data.choices?.[0]?.message?.content?.trim() ?? '';

    if (recapText) {
      await supabase.from('challenge_recaps').insert({ challenge_id: challengeId, recap_text: recapText });
    }

    return new Response(JSON.stringify({ recap: recapText, leaderboard }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
