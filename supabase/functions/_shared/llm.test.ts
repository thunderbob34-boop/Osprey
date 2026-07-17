import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseJsonLoose } from './llm.ts';

Deno.test('parseJsonLoose reads clean JSON (the OpenAI path)', () => {
  assertEquals(parseJsonLoose('{"insight_text":"hi","habit_tip":null}'), {
    insight_text: 'hi',
    habit_tip: null,
  });
});

Deno.test('parseJsonLoose extracts JSON wrapped in prose (the open-model path)', () => {
  const t = 'Sure! Here is your brief:\n{"insight_text":"Rest today","why_reasoning":"low recovery"}\nHope that helps!';
  assertEquals(parseJsonLoose(t), { insight_text: 'Rest today', why_reasoning: 'low recovery' });
});

Deno.test('parseJsonLoose extracts JSON from a ```json fence', () => {
  assertEquals(parseJsonLoose('```json\n{"a":1,"b":"two"}\n```'), { a: 1, b: 'two' });
});

Deno.test('parseJsonLoose throws when there is no JSON object at all', () => {
  assertThrows(() => parseJsonLoose('no json here, just words'), Error, 'parseable JSON');
});
