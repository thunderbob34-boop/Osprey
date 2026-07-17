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
 * A send failure that also records whether the user's turn was persisted
 * server-side before it failed. The page uses `persisted` to decide whether to
 * restore the composer: a message that never reached the database should be
 * given back to the athlete; one that was saved (and will reappear via the
 * thread refetch) must NOT be, or they could re-send a duplicate.
 */
export class ChatSendError extends Error {
  readonly persisted: boolean;
  constructor(message: string, persisted: boolean) {
    super(message);
    this.name = 'ChatSendError';
    this.persisted = persisted;
  }
}

/**
 * Given a NON-2xx status from the chat function, did the user's turn get saved?
 * The function inserts it (index.ts:169) only after the 401/400/404 guards and
 * before the model call, so:
 *  - 401 / 400 / 404 → not yet inserted → not persisted.
 *  - 502 → the model call failed AFTER the insert → persisted.
 *  - 500 → ambiguous (an insert failure is pre-persist, a later buildContext
 *    throw is post-persist). We lean persisted: the dominant 500 cause is the
 *    post-insert path, and leaning this way avoids restoring a draft whose
 *    question is already in the thread (which would invite a duplicate). The
 *    rare insert-failure-500 loses the draft — no worse than before this fix.
 */
export function httpFailureWasPersisted(status: number): boolean {
  return status === 502 || status === 500;
}

/**
 * Streams Ozzie's reply, handing each token to `onToken` as it lands.
 *
 * Deliberately NOT supabase.functions.invoke — that buffers the entire response
 * and would defeat the streaming this whole feature exists for.
 *
 * Throws ChatSendError so the caller can tell a lost message (restore the
 * composer) from a saved one (leave it cleared).
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
  // No request left the browser → nothing was saved.
  if (!token) throw new ChatSendError('Your session expired — sign in again.', false);

  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ozzie-chat`, {
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
  } catch {
    // The request never reached the function (offline, DNS, function down), so
    // the user turn was never inserted — the caller should restore the composer.
    throw new ChatSendError('Could not reach Ozzie. Check your connection and try again.', false);
  }

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    // A 2xx means the server reached the streaming stage, which is after the
    // user-turn insert — so an ok-but-bodyless response counts as persisted.
    const persisted = res.ok || httpFailureWasPersisted(res.status);
    throw new ChatSendError(body?.error ?? 'Ozzie could not answer right now. Please try again.', persisted);
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
        // A 200 got us here, so the server already inserted the user turn before
        // streaming — it's saved (and the refetch will show it). Don't restore.
        throw new ChatSendError(
          'The connection to Ozzie dropped before the reply finished. Please try again.',
          true,
        );
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
