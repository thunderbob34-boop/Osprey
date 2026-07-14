jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { envelopeFromInputs } from '@/services/coaching/build-envelope';

describe('envelopeFromInputs', () => {
  it('defaults a no-history athlete to a Base maintenance envelope', () => {
    const env = envelopeFromInputs({
      sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
      baselineLoad: 0, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
    });
    expect(env.phase).toBe('Base');
    expect(env.runZones).not.toBeNull(); // estimate anchor still yields zones
  });
});
