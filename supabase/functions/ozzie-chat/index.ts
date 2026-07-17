// Ozzie Chat — a grounded, streaming coaching conversation.
//
// Loads the athlete's real training context, streams gpt-4o-mini's reply to the
// browser as SSE, and persists both turns server-side so a dropped connection
// can't lose the record.
//
// Unlike most Ozzie functions this one is called from a BROWSER, so it must
// answer the CORS preflight (see ozzie-race-briefing for the precedent) — six
// of the eight others omit CORS because React Native doesn't enforce it.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildSystemPrompt,
  computeRacePhase,
  mapThread,
  weekBounds,
  THREAD_MESSAGE_CAP,
  RECENT_LOG_CAP,
  type ChatContext,
} from './context.ts';
import { parseSSEChunk } from './stream.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/**
 * Everything Ozzie is allowed to know, read with the service-role client and
 * scoped by hand (RLS does not apply here).
 *
 * NOTE: goal_params is deliberately NOT selected. That column ships in the
 * pending coaching bundle and does not exist in production yet — selecting it
 * would 400 every chat call.
 */
async function buildContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clientDate: string,
): Promise<ChatContext> {
  const { mondayISO, sundayISO } = weekBounds(clientDate);

  const [userRes, goalsRes, weekRes, logsRes, summaryRes] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', userId).maybeSingle(),
    // threshold_anchor and total_weeks_planned ARE deployed; goal_params is NOT
    // (it ships in the pending coaching bundle) — selecting it would 400.
    supabase
      .from('user_goals')
      .select('primary_goal, target_race, target_date, total_weeks_planned, threshold_anchor')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('training_sessions')
      .select('session_date, session_type, intensity, planned_minutes, planned_distance_km')
      .eq('user_id', userId)
      .gte('session_date', mondayISO)
      .lte('session_date', sundayISO)
      .order('session_date', { ascending: true }),
    supabase
      .from('workout_logs')
      .select('started_at, session_type, total_distance_km, total_duration_s, perceived_effort')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(RECENT_LOG_CAP),
    supabase.from('v_daily_summary').select('recovery_score, tsb').eq('user_id', userId).maybeSingle(),
  ]);

  // Observability only — keep the null/empty fallbacks below exactly as they
  // are (a brand-new athlete with no goals or sessions is a legitimate,
  // expected shape). Without this, a query failure is indistinguishable from
  // "this athlete has no data" and Ozzie confidently coaches from nothing.
  if (userRes.error) console.error('ozzie-chat context error (users)', userRes.error);
  if (goalsRes.error) console.error('ozzie-chat context error (user_goals)', goalsRes.error);
  if (weekRes.error) console.error('ozzie-chat context error (training_sessions)', weekRes.error);
  if (logsRes.error) console.error('ozzie-chat context error (workout_logs)', logsRes.error);
  if (summaryRes.error) console.error('ozzie-chat context error (v_daily_summary)', summaryRes.error);

  const targetDate = (goalsRes.data?.target_date as string | undefined) ?? null;
  const totalWeeksPlanned = (goalsRes.data?.total_weeks_planned as number | undefined) ?? null;

  return {
    displayName: (userRes.data?.display_name as string | undefined) ?? 'there',
    primaryGoal: (goalsRes.data?.primary_goal as string | undefined) ?? null,
    targetRace: (goalsRes.data?.target_race as string | undefined) ?? null,
    targetDate,
    totalWeeksPlanned,
    thresholdAnchor: (goalsRes.data?.threshold_anchor as Record<string, unknown> | undefined) ?? null,
    phase: computeRacePhase(targetDate, totalWeeksPlanned, clientDate),
    recoveryScore: (summaryRes.data?.recovery_score as number | undefined) ?? null,
    tsb: (summaryRes.data?.tsb as number | undefined) ?? null,
    weekSessions: (weekRes.data ?? []).map((r) => ({
      sessionDate: r.session_date as string,
      sessionType: r.session_type as string,
      intensity: (r.intensity as string | null) ?? null,
      plannedMinutes: (r.planned_minutes as number | null) ?? null,
      plannedDistanceKm: (r.planned_distance_km as number | null) ?? null,
    })),
    recentLogs: (logsRes.data ?? []).map((r) => ({
      startedAt: r.started_at as string,
      sessionType: r.session_type as string,
      distanceKm: (r.total_distance_km as number | null) ?? null,
      durationS: (r.total_duration_s as number | null) ?? null,
      perceivedEffort: (r.perceived_effort as number | null) ?? null,
    })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !authData?.user) return json({ error: 'Invalid session' }, 401);
  const userId = authData.user.id;

  let conversationId: string;
  let message: string;
  let clientDate: string;
  try {
    const body = await req.json();
    conversationId = String(body.conversationId ?? '');
    message = String(body.message ?? '').slice(0, 2000);
    clientDate = String(body.clientDate ?? '').slice(0, 10);
    // The regex is a shape check, not a validity check — "2026-02-30" passes it
    // but new Date(...) below turns it into an Invalid Date, whose
    // .toISOString() throws inside weekBounds. Mirrors computeRacePhase's own
    // isNaN(getTime()) guard in context.ts.
    const clientDateValid =
      /^\d{4}-\d{2}-\d{2}$/.test(clientDate) && !isNaN(new Date(`${clientDate}T00:00:00Z`).getTime());
    if (!conversationId || !message.trim() || !clientDateValid) {
      return json({ error: 'conversationId, message and clientDate are required' }, 400);
    }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    // The service-role client bypasses RLS, so this ownership check is the only
    // thing standing between a caller and a stranger's thread. Never drop it.
    const { data: convo } = await supabase
      .from('ozzie_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!convo) return json({ error: 'Conversation not found' }, 404);

    // Persist the question first: the thread read below then already ends with
    // the message we're answering, so there's nothing to append by hand.
    const { error: insertError } = await supabase.from('ozzie_messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: message,
    });
    if (insertError) throw insertError;

    const [context, threadRes] = await Promise.all([
      buildContext(supabase, userId, clientDate),
      supabase
        .from('ozzie_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(THREAD_MESSAGE_CAP),
    ]);

    const thread = mapThread(
      (threadRes.data ?? []) as { role: string; content: string }[],
    );

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      // Hard ceiling on the whole model call so a hung/stalled OpenAI stream
      // can't pin the function open indefinitely. Aborting mid-stream rejects
      // the reader in pull()'s catch, which persists the partial reply and
      // errors the client stream — the same path a real upstream reset takes.
      // The webapp also idle-times-out at 30s, so this is the server-side floor.
      signal: AbortSignal.timeout(90_000),
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...thread],
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      console.error('ozzie-chat upstream error', upstream.status, errText);
      return json({ error: 'Ozzie could not answer right now. Please try again.' }, 502);
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    let assembled = '';
    let persistPromise: Promise<void> | null = null;

    async function doPersistReply(): Promise<void> {
      if (!assembled.trim()) return;
      try {
        const { error: assistantError } = await supabase.from('ozzie_messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: assembled,
        });
        if (assistantError) console.error('ozzie-chat persist error', assistantError);

        const { error: updateError } = await supabase
          .from('ozzie_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
          .eq('user_id', userId);
        if (updateError) console.error('ozzie-chat persist error', updateError);
      } catch (err) {
        // A failed write must not corrupt the response the user is already
        // reading — log and move on rather than throw.
        console.error('ozzie-chat persist error', err);
      }
    }

    // The reply is persisted on both the normal-completion path and the
    // client-disconnect (stream cancel) path, so a dropped connection can't
    // lose what Ozzie already said. Memoized so every caller — pull's done
    // branch, pull's error branch, and cancel — joins the SAME write instead
    // of racing it or (worse) treating a flipped boolean as if the write had
    // already landed.
    function persistReply(): Promise<void> {
      return (persistPromise ??= doPersistReply());
    }

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();

          if (done) {
            await persistReply();
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSSEChunk(buffer);
          buffer = parsed.rest;

          for (const token of parsed.tokens) {
            assembled += token;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }

          if (parsed.done) {
            await reader.cancel();
            await persistReply();
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        } catch (err) {
          // A mid-stream upstream failure (e.g. an OpenAI TCP reset) lands
          // here. Per the Streams spec `cancel` is NOT invoked for this case —
          // only consumer-initiated cancellation runs it — so this is the
          // only path left that can still persist whatever Ozzie had already
          // said, and the only path that releases the upstream reader.
          console.error('ozzie-chat stream error', err);
          await persistReply();
          reader.releaseLock();
          controller.error(err);
        }
      },
      async cancel() {
        // Browser went away mid-reply — keep whatever Ozzie already said.
        // Awaited so the request doesn't finish until the write actually
        // lands; persistReply is memoized, so this joins the same write
        // `pull`'s done-branch may already have started rather than racing it.
        await reader.cancel();
        await persistReply();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...CORS,
      },
    });
  } catch (err) {
    console.error('ozzie-chat error', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
