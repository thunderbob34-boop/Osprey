import { describe, it, expect } from 'vitest';
import { resolveGoalInputs, isUltraGoal } from '../src/lib/build-envelope';

describe('resolveGoalInputs', () => {
  it('defaults to run when dbGoal is null, with no sport-specific params', () => {
    expect(resolveGoalInputs(null, null)).toEqual({ sport: 'run', strengthParams: null, hyroxParams: null, crossfitParams: null });
  });

  it('parses lift params, tolerating the missing goalThirdKg field', () => {
    const result = resolveGoalInputs('lift', { oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 } });
    expect(result.sport).toBe('lift');
    expect(result.strengthParams).toEqual({ oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 } });
    expect(result.hyroxParams).toBeNull();
    expect(result.crossfitParams).toBeNull();
  });

  it('parses hyrox params with a division set', () => {
    const result = resolveGoalInputs('hyrox', { division: 'open_men', targetTimeMinutes: 75 });
    expect(result.hyroxParams).toEqual({ division: 'open_men', targetTimeMinutes: 75 });
  });

  it('parses hyrox params as division:null when goal_params is missing', () => {
    const result = resolveGoalInputs('hyrox', null);
    expect(result.hyroxParams).toEqual({ division: null, targetTimeMinutes: null });
  });

  it('returns crossfitParams:null when goal_params is null (matching mobile toCrossfitParams, not webapp parseCrossfitParams alone)', () => {
    const result = resolveGoalInputs('crossfit', null);
    expect(result.crossfitParams).toBeNull();
  });

  it('parses crossfit params when goal_params is a real (even empty) object', () => {
    const result = resolveGoalInputs('crossfit', {});
    expect(result.crossfitParams).toEqual({ oneRepMaxKg: { backSquat: null, deadlift: null, press: null }, competing: false, franSec: null });
  });
});

describe('isUltraGoal', () => {
  it('returns true for ultra', () => {
    expect(isUltraGoal('ultra')).toBe(true);
  });

  it('returns false for run', () => {
    expect(isUltraGoal('run')).toBe(false);
  });

  it('returns false for lift', () => {
    expect(isUltraGoal('lift')).toBe(false);
  });

  it('returns false for hyrox', () => {
    expect(isUltraGoal('hyrox')).toBe(false);
  });

  it('returns false for crossfit', () => {
    expect(isUltraGoal('crossfit')).toBe(false);
  });
});
