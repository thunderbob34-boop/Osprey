// supabase/functions/_shared/llm.ts
//
// Provider-agnostic chat completion for Ozzie's edge functions. Today every
// Ozzie function calls OpenAI directly and identically; routing that through
// one helper means swapping the LLM backend — or A/B-ing a free one — is a
// single env-var flip instead of a rewrite in nine places.
//
//   OZZIE_LLM_PROVIDER = 'openai' (default) | 'cloudflare'
//
//   openai      → OPENAI_API_KEY            (+ optional OPENAI_MODEL, default gpt-4o-mini)
//   cloudflare  → CLOUDFLARE_ACCOUNT_ID
//                 + CLOUDFLARE_API_TOKEN     (a token with the "Workers AI" Run permission)
//                 (+ optional CLOUDFLARE_LLM_MODEL, default @cf/meta/llama-3.1-8b-instruct —
//                  a free-tier open Llama model; Cloudflare doesn't train on your data)
//
// SPIKE STATUS: only ozzie-daily-brief is wired to this so far, so the two
// backends can be compared on real output before committing to a migration.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * Ask the model for a JSON object. On OpenAI this sets response_format so the
   * output is guaranteed parseable; Cloudflare's open models have no such mode,
   * so JSON there is prompt-driven — the caller's prompt must request JSON and
   * should pair this with parseJsonLoose() to tolerate stray prose.
   */
  json?: boolean;
}

// Read the provider lazily (inside the call), NOT at module load — so importing
// this file for its pure helpers (parseJsonLoose in tests) needs no env access,
// and there are no import-time side effects.
function providerName(fallback = 'openai'): string {
  return (Deno.env.get('OZZIE_LLM_PROVIDER') ?? fallback).toLowerCase();
}

/**
 * Which backend a caller should use. `fallback` is the default when
 * OZZIE_LLM_PROVIDER is unset, so a function can pick its own default — the
 * daily brief passes 'template' to run free by default — while chatComplete's
 * own LLM dispatch still falls back to openai.
 */
export function activeProvider(fallback = 'openai'): string {
  return providerName(fallback);
}

export async function chatComplete(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  return providerName() === 'cloudflare' ? cloudflareChat(messages, opts) : openaiChat(messages, opts);
}

async function openaiChat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY') ?? '';
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 300,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text().catch(() => '')}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) throw new Error('OpenAI returned no content');
  return content;
}

async function cloudflareChat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const account = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '';
  const token = Deno.env.get('CLOUDFLARE_API_TOKEN') ?? '';
  const model = Deno.env.get('CLOUDFLARE_LLM_MODEL') ?? '@cf/meta/llama-3.1-8b-instruct';
  if (!account || !token) {
    throw new Error('Cloudflare Workers AI not configured: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN');
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // Workers AI's chat models take the same {messages:[{role,content}]} shape
    // as OpenAI, so the same prompt flows through unchanged.
    body: JSON.stringify({
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 300,
    }),
  });
  if (!res.ok) throw new Error(`Cloudflare Workers AI error: ${res.status} ${await res.text().catch(() => '')}`);
  const data = await res.json();
  // Workers AI shape: { result: { response: "..." }, success: true, errors: [] }
  const content = data.result?.response;
  if (typeof content !== 'string' || !content) throw new Error('Cloudflare Workers AI returned no content');
  return content;
}

/**
 * JSON.parse, but tolerant of a model wrapping the object in prose or ```json
 * fences. OpenAI's response_format prevents that; open Llama models do not, so
 * the cloudflare path needs the fallback. Ozzie's payloads are flat objects, so
 * grabbing the first `{` through the last `}` is sufficient.
 */
export function parseJsonLoose(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        // fall through to the throw below
      }
    }
    throw new Error('Model did not return parseable JSON');
  }
}
