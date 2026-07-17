import { describe, it, expect } from 'vitest';
import { parseTokenStream } from '../src/features/chat/send';

const line = (token: string) => `data: ${JSON.stringify({ token })}\n\n`;

describe('parseTokenStream', () => {
  it('extracts tokens in order', () => {
    const { tokens, done } = parseTokenStream(line('Yes') + line(' — Wednesday'));
    expect(tokens).toEqual(['Yes', ' — Wednesday']);
    expect(done).toBe(false);
  });

  it('holds a partial trailing line in rest', () => {
    const { tokens, rest } = parseTokenStream(line('Yes') + 'data: {"tok');
    expect(tokens).toEqual(['Yes']);
    expect(rest).toBe('data: {"tok');
  });

  it('emits a split token exactly once when resumed', () => {
    const whole = line('Wednesday works');
    const first = parseTokenStream(whole.slice(0, 12));
    expect(first.tokens).toEqual([]);
    const second = parseTokenStream(first.rest + whole.slice(12));
    expect(second.tokens).toEqual(['Wednesday works']);
  });

  it('recognises [DONE]', () => {
    const { tokens, done } = parseTokenStream(line('bye') + 'data: [DONE]\n\n');
    expect(tokens).toEqual(['bye']);
    expect(done).toBe(true);
  });

  it('skips a malformed line without dying', () => {
    const { tokens } = parseTokenStream('data: {oops}\n\n' + line('ok'));
    expect(tokens).toEqual(['ok']);
  });
});
