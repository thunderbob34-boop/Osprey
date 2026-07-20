import { describe, it, expect } from 'vitest';
import { isBeyondGeneratedHorizon } from '../src/lib/calendar-cells';

describe('isBeyondGeneratedHorizon', () => {
  it('is true for every date when there are no sessions at all', () => {
    expect(isBeyondGeneratedHorizon('2026-07-21', [])).toBe(true);
  });
  it('is false for a date on or before the latest generated session', () => {
    const dates = ['2026-07-20', '2026-07-22', '2026-07-25'];
    expect(isBeyondGeneratedHorizon('2026-07-21', dates)).toBe(false);
    expect(isBeyondGeneratedHorizon('2026-07-25', dates)).toBe(false);
  });
  it('is true for a date after the latest generated session', () => {
    const dates = ['2026-07-20', '2026-07-22', '2026-07-25'];
    expect(isBeyondGeneratedHorizon('2026-07-26', dates)).toBe(true);
  });
  it('does not depend on array order', () => {
    const dates = ['2026-07-25', '2026-07-20', '2026-07-22'];
    expect(isBeyondGeneratedHorizon('2026-07-24', dates)).toBe(false);
    expect(isBeyondGeneratedHorizon('2026-07-26', dates)).toBe(true);
  });
});
