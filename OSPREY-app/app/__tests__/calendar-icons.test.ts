import { SESSION_ICON } from '../calendar';

// calendar.tsx and plan-preview.tsx must agree on session iconography — they
// render the same plan. plan-preview gained rowing/hyrox during REC-002 and
// calendar was missed, so hyrox sessions (live in production since the
// 2026-07-21 Phase-3 deploy) rendered as a bare fallback dot.
describe('calendar SESSION_ICON', () => {
  it('covers every session type the plan generator can emit', () => {
    for (const type of ['run', 'lift', 'swim', 'bike', 'rowing', 'hyrox', 'cross', 'race', 'rest']) {
      expect(SESSION_ICON[type]).toBeTruthy();
    }
  });

  it('uses the same rowing and hyrox glyphs as plan-preview', () => {
    expect(SESSION_ICON.rowing).toBe('🚣');
    expect(SESSION_ICON.hyrox).toBe('🏋️‍♂️');
  });
});
