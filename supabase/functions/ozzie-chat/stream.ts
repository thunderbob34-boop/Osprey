// supabase/functions/ozzie-chat/stream.ts
// Pure parsing of OpenAI's streaming chat-completion format.
//
// Network chunks split wherever TCP feels like it — a `data:` line routinely
// arrives cut in half. The caller keeps the returned `rest` and prepends it to
// the next chunk, so a token is never dropped or emitted twice.

export interface ParsedChunk {
  /** Content deltas, in order. */
  tokens: string[];
  /** Trailing partial line to carry into the next chunk. */
  rest: string;
  /** Saw the [DONE] sentinel. */
  done: boolean;
}

export function parseSSEChunk(buffer: string): ParsedChunk {
  const tokens: string[] = [];
  let done = false;

  // Everything up to the last newline is complete; whatever follows is partial.
  const lastNewline = buffer.lastIndexOf('\n');
  if (lastNewline === -1) return { tokens, rest: buffer, done };

  const complete = buffer.slice(0, lastNewline);
  const rest = buffer.slice(lastNewline + 1);

  for (const line of complete.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue; // blank lines, comments, event: lines

    const payload = trimmed.slice('data:'.length).trim();
    if (payload === '[DONE]') {
      done = true;
      continue;
    }

    try {
      const parsed = JSON.parse(payload);
      const token = parsed?.choices?.[0]?.delta?.content;
      if (typeof token === 'string' && token.length > 0) tokens.push(token);
    } catch {
      // A malformed line isn't worth killing the stream over.
    }
  }

  return { tokens, rest, done };
}
