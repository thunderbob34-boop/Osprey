import { describe, it, expect } from 'vitest';
import { titleFromFirstMessage } from '../src/features/chat/model';

describe('titleFromFirstMessage', () => {
  it('uses a short message verbatim', () => {
    expect(titleFromFirstMessage('Why is Tuesday intervals?')).toBe('Why is Tuesday intervals?');
  });

  it('collapses whitespace and trims', () => {
    expect(titleFromFirstMessage('  Why   is\nTuesday intervals? ')).toBe('Why is Tuesday intervals?');
  });

  it('falls back for an empty or whitespace-only message', () => {
    expect(titleFromFirstMessage('')).toBe('New chat');
    expect(titleFromFirstMessage('   \n  ')).toBe('New chat');
  });

  it('truncates a long message on a word boundary with an ellipsis', () => {
    const long = 'Can you explain why my marathon plan has me running intervals on Tuesday instead of an easy run';
    const title = titleFromFirstMessage(long);
    expect(title.length).toBeLessThanOrEqual(49); // 48 + the ellipsis
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/); // no space before the ellipsis
    expect(long).toContain(title.slice(0, -1)); // the kept part is a real prefix
  });

  it('hard-cuts a single unbroken word rather than returning almost nothing', () => {
    const title = titleFromFirstMessage('a'.repeat(80));
    expect(title).toBe('a'.repeat(48) + '…');
  });
});
