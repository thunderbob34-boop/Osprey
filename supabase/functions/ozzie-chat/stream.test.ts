// supabase/functions/ozzie-chat/stream.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseSSEChunk } from './stream.ts';

const line = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

Deno.test('extracts content deltas in order', () => {
  const { tokens, done } = parseSSEChunk(line('Yes') + line(' — Wednesday'));
  assertEquals(tokens, ['Yes', ' — Wednesday']);
  assertEquals(done, false);
});

Deno.test('holds a partial trailing line back in rest and emits nothing for it', () => {
  const buffer = line('Yes') + 'data: {"choices":[{"delta":{"con';
  const { tokens, rest } = parseSSEChunk(buffer);
  assertEquals(tokens, ['Yes']);
  assertEquals(rest, 'data: {"choices":[{"delta":{"con');
});

Deno.test('a token split across two chunks is emitted exactly once', () => {
  const whole = line('Wednesday works');
  const cut = 20;
  const first = parseSSEChunk(whole.slice(0, cut));
  assertEquals(first.tokens, []);
  const second = parseSSEChunk(first.rest + whole.slice(cut));
  assertEquals(second.tokens, ['Wednesday works']);
});

Deno.test('[DONE] sets done', () => {
  const { tokens, done } = parseSSEChunk(line('bye') + 'data: [DONE]\n\n');
  assertEquals(tokens, ['bye']);
  assertEquals(done, true);
});

Deno.test('ignores blank lines, comments and non-data lines', () => {
  const { tokens } = parseSSEChunk(': keep-alive\n\nevent: ping\n\n' + line('hi'));
  assertEquals(tokens, ['hi']);
});

Deno.test('a malformed data line is skipped, not fatal', () => {
  const { tokens } = parseSSEChunk('data: {not json}\n\n' + line('still here'));
  assertEquals(tokens, ['still here']);
});

Deno.test('empty deltas (role-only opener) produce no tokens', () => {
  const opener = `data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })}\n\n`;
  const { tokens } = parseSSEChunk(opener);
  assertEquals(tokens, []);
});

Deno.test('a buffer with no newline at all is entirely rest', () => {
  const { tokens, rest } = parseSSEChunk('data: {"cho');
  assert(tokens.length === 0);
  assertEquals(rest, 'data: {"cho');
});
