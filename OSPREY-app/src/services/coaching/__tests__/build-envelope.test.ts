jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { envelopeFromInputs } from '@/services/coaching/build-envelope';

describe('envelopeFromInputs', () => {
  it('defaults a no-history athlete to a Base maintenance envelope', () => {
    const env = envelopeFromInputs({
      sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
      baselineLoad: 0, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
      rowingSplitSecPer500: null, selfReportAnchor: null, maxHR: null,
    });
    expect(env.phase).toBe('Base');
    expect(env.zones).not.toBeNull(); // estimate anchor still yields zones
  });

  it('derives a Taper envelope from a race 1 week out in an 8-week plan, via an injected now', () => {
    // Fixed local time so this doesn't depend on the real clock — computeRacePhase
    // is deterministic once `now` is threaded through instead of defaulting internally.
    const now = new Date(2026, 0, 1); // Thu 2026-01-01 local midnight
    const env = envelopeFromInputs({
      sport: 'run',
      race: { targetDate: '2026-01-08', totalWeeksPlanned: 8 }, // exactly 1 week after `now`
      fitnessLevel: 'intermediate',
      bodyWeightKg: 70,
      baselineLoad: 200,
      prevWeekLoad: null,
      bestRunMiles: null,
      bestRunTimeS: null,
      rowingSplitSecPer500: null,
      selfReportAnchor: null,
      maxHR: null,
    }, now);

    expect(env.phase).toBe('Taper');
    expect(env.weekNumber).toBe(8);
    expect(env.totalWeeks).toBe(8);
    expect(env.zones).not.toBeNull();
  });

  it('passes a rowing split through to a rowing envelope', () => {
    const env = envelopeFromInputs({
      sport: 'rowing', race: null, fitnessLevel: 'intermediate', bodyWeightKg: 80,
      baselineLoad: 200, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
      rowingSplitSecPer500: 118, selfReportAnchor: null, maxHR: null,
    });
    expect(env.zones?.kind).toBe('rowing');
    // Pin the actual value, not just the zone kind: the 'intermediate' tier fallback is
    // 120 (see estimateRowingSplitByTier), so 118 only appears if the split was threaded
    // through rather than silently dropped in favor of the fallback.
    if (env.zones?.kind === 'rowing') {
      expect(env.zones.splitSecPer500).toBe(118);
    }
  });

  it('threads a self-reported swim CSS into the envelope', () => {
    const env = envelopeFromInputs({
      sport: 'swim', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
      baselineLoad: 200, prevWeekLoad: null,
      bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
      selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: 90, splitSecPer500: null }, maxHR: null,
    });
    expect(env.zones).toMatchObject({ kind: 'swim', cssSecPer100: 90 });
  });

  it('threads observed maxHR into hrZones', () => {
    const env = envelopeFromInputs({
      sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
      baselineLoad: 200, prevWeekLoad: null,
      bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
      selfReportAnchor: null, maxHR: 185,
    });
    expect(env.hrZones).toMatchObject({ maxHR: 185, source: 'observed' });
  });
});
