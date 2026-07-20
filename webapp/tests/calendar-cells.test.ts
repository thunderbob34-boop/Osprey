import { describe, it, expect } from 'vitest';
import { isBeyondGeneratedHorizon, latestGeneratedDate } from '../src/lib/calendar-cells';

describe('latestGeneratedDate', () => {
  it('is null when there are no sessions at all', () => {
    expect(latestGeneratedDate([])).toBeNull();
  });
  it('finds the latest date regardless of array order', () => {
    expect(latestGeneratedDate(['2026-07-25', '2026-07-20', '2026-07-22'])).toBe('2026-07-25');
  });
});

describe('isBeyondGeneratedHorizon', () => {
  it('is true for every date when nothing has been generated', () => {
    expect(isBeyondGeneratedHorizon('2026-07-21', null)).toBe(true);
  });
  it('is false for a date on or before the latest generated date', () => {
    expect(isBeyondGeneratedHorizon('2026-07-21', '2026-07-25')).toBe(false);
    expect(isBeyondGeneratedHorizon('2026-07-25', '2026-07-25')).toBe(false);
  });
  it('is true for a date after the latest generated date', () => {
    expect(isBeyondGeneratedHorizon('2026-07-26', '2026-07-25')).toBe(true);
  });
});
