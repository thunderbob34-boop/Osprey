jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { envelopeFromInputs, resolveGoalInputs } from '@/services/coaching/build-envelope';

describe('envelopeFromInputs', () => {
  it('defaults a no-history athlete to a Base maintenance envelope', () => {
    const env = envelopeFromInputs({
      sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
      baselineLoad: 0, prevWeekLoad: null, bestRunMiles: null, bestRunTimeS: null,
      rowingSplitSecPer500: null, selfReportAnchor: null, maxHR: null, ultraParams: null,
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
      ultraParams: null,
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
      rowingSplitSecPer500: 118, selfReportAnchor: null, maxHR: null, ultraParams: null,
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
      selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: 90, splitSecPer500: null, ftpWatts: null }, maxHR: null,
      ultraParams: null,
    });
    expect(env.zones).toMatchObject({ kind: 'swim', cssSecPer100: 90 });
  });

  it('threads observed maxHR into hrZones', () => {
    const env = envelopeFromInputs({
      sport: 'run', race: null, fitnessLevel: 'beginner', bodyWeightKg: 70,
      baselineLoad: 200, prevWeekLoad: null,
      bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
      selfReportAnchor: null, maxHR: 185,
      ultraParams: null,
    });
    expect(env.hrZones).toMatchObject({ maxHR: 185, source: 'observed' });
  });
});

describe('resolveGoalInputs (goal switch: the posted goal wins over the stale DB read)', () => {
  it('switches hybrid → lift and populates strengthParams from goal_params', () => {
    const r = resolveGoalInputs('strength', 'hybrid', { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 } });
    expect(r.sport).toBe('lift');
    expect(r.strengthParams?.oneRepMaxKg).toEqual({ squat: 200, bench: 140, deadlift: 240 });
    expect(r.ultraParams).toBeNull();
  });

  it('switches run → ultra and populates ultraParams from goal_params', () => {
    const r = resolveGoalInputs('ultra', 'run', { raceDistance: '100k', vertGainM: 3000, gutTrained: true });
    expect(r.sport).toBe('ultra');
    expect(r.ultraParams).not.toBeNull();
    expect(r.strengthParams).toBeNull();
  });

  it.each(['triathlon', 'swim', 'rowing'] as const)('switches an endurance goal to %s', (goal) => {
    expect(resolveGoalInputs(goal, 'hybrid', null).sport).toBe(goal);
  });

  it('falls back to the DB goal when no preferences are posted (background regen / race-event)', () => {
    expect(resolveGoalInputs(undefined, 'rowing', null).sport).toBe('rowing');
    expect(resolveGoalInputs(undefined, null, null).sport).toBe('run'); // ultimate default
    // A lift envelope is NOT built off a stale-but-irrelevant DB read when nothing switched:
    expect(resolveGoalInputs(undefined, 'lift', { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 } }).strengthParams).not.toBeNull();
  });
});
