import { supabase } from '../../lib/supabase';
import { toDateInputValue } from '../../lib/day';

export interface TokenChunk {
  tokens: string[];
  rest: string;
  done: boolean;
}

/**
 * Parses the chat function's SSE envelope (`data: {"token":"..."}`). Chunks
 * split mid-line, so the caller carries `rest` into the next read — the same
 * discipline the function uses on OpenAI's stream.
 */
export function parseTokenStream(buffer: string): TokenChunk {
  const tokens: string[] = [];
  let done = false;

  const lastNewline = buffer.lastIndexOf('\n');
  if (lastNewline === -1) return { tokens, rest: buffer, done };

  const complete = buffer.slice(0, lastNewline);
  const rest = buffer.slice(lastNewline + 1);

  for (const line of complete.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice('data:'.length).trim();
    if (payload === '[DONE]') {
      done = true;
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as { token?: unknown };
      if (typeof parsed.token === 'string' && parsed.token.length > 0) tokens.push(parsed.token);
    } catch {
      // Ignore a malformed line rather than dropping the whole reply.
    }
  }

  return { tokens, rest, done };
}

/**
 * Streams Ozzie's reply, handing each token to `onToken` as it lands.
 *
 * Deliberately NOT supabase.functions.invoke — that buffers the entire response
 * and would defeat the streaming this whole feature exists for.
 */
export async function sendChatMessage({
  conversationId,
  message,
  onToken,
}: {
  conversationId: string;
  message: string;
  onToken: (token: string) => void;
}): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Your session expired — sign in again.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ozzie-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      message,
      // The function has no idea what day it is where the athlete lives.
      clientDate: toDateInputValue(new Date()),
    }),
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Ozzie could not answer right now. Please try again.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      // The transport ended without us ever seeing the [DONE] sentinel —
      // a dropped connection or a crash mid-generation, not a finished
      // reply. Resolving normally here would let the caller mistake a
      // truncated reply for a complete one, so surface it instead.
      if (!completed) {
        throw new Error('The connection to Ozzie dropped before the reply finished. Please try again.');
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseTokenStream(buffer);
    buffer = parsed.rest;
    parsed.tokens.forEach(onToken);
    if (parsed.done) {
      completed = true;
      break;
    }
  }
}
