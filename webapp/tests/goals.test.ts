import { describe, it, expect } from 'vitest';
import { PrimaryGoalSchema, PRIMARY_GOALS } from '../src/lib/goals';

describe('PrimaryGoal', () => {
  it('mirrors the OSPREY-app union exactly (12 goals)', () => {
    expect([...PRIMARY_GOALS].sort()).toEqual(
      ['crossfit', 'cycling', 'general_fitness', 'hybrid', 'hyrox', 'lift', 'rowing', 'run', 'swim', 'triathlon', 'ultra', 'weight_loss'],
    );
  });
  it('parses a known goal and rejects junk', () => {
    expect(PrimaryGoalSchema.parse('crossfit')).toBe('crossfit');
    expect(PrimaryGoalSchema.safeParse('parkour').success).toBe(false);
  });
});
