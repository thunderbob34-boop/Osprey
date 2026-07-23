jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { buildDisplayEnvelope, type DisplayEnvelopeRawInputs } from '@/hooks/useDisplayEnvelope';

const BASE_RAW: DisplayEnvelopeRawInputs = {
  primaryGoal: 'run',
  fitnessLevel: 'beginner',
  targetDate: null,
  totalWeeksPlanned: null,
  thresholdAnchor: null,
  goalParams: null,
  bodyWeightKg: null,
  bestRunMiles: null,
  bestRunTimeS: null,
  rowingSplitSecPer500: null,
  maxHR: null,
};

describe('buildDisplayEnvelope — phase computation', () => {
  it('falls back to Base/week 1/8 total weeks when no race target is set', () => {
    const env = buildDisplayEnvelope(BASE_RAW);
    expect(env.phase).toBe('Base');
    expect(env.weekNumber).toBe(1);
    expect(env.totalWeeks).toBe(8);
  });

  it('falls back to the same default when totalWeeksPlanned is missing but targetDate is set', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, targetDate: '2026-12-01', totalWeeksPlanned: null });
    expect(env.phase).toBe('Base');
    expect(env.weekNumber).toBe(1);
    expect(env.totalWeeks).toBe(8);
  });

  it('falls back to the same default when targetDate is missing but totalWeeksPlanned is set', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, targetDate: null, totalWeeksPlanned: 12 });
    expect(env.phase).toBe('Base');
    expect(env.weekNumber).toBe(1);
    expect(env.totalWeeks).toBe(8);
  });

  it('computes a real phase from a real race target, via an injected now', () => {
    const now = new Date(2026, 0, 1); // Thu 2026-01-01 local midnight
    const env = buildDisplayEnvelope(
      { ...BASE_RAW, targetDate: '2026-01-08', totalWeeksPlanned: 8 }, // 1 week out of an 8-week plan
      now,
    );
    expect(env.phase).toBe('Taper');
    expect(env.weekNumber).toBe(8);
    expect(env.totalWeeks).toBe(8);
  });
});

describe('buildDisplayEnvelope — wiring (sport, anchors, effort data reach the envelope)', () => {
  it('defaults an unset goal to run', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: null });
    expect(env.sport).toBe('run');
    expect(env.zones).not.toBeNull();
  });

  it('threads a self-reported run anchor into real run zones', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      thresholdAnchor: { run: { thresholdSecPerMile: 480, source: 'self_report' } },
    });
    expect(env.zones).toMatchObject({ kind: 'run', thresholdSecPerMile: 480 });
    expect(env.confidence).toBe('measured');
  });

  it('passes a rowing split through to a rowing envelope', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'rowing', rowingSplitSecPer500: 118 });
    expect(env.zones).toMatchObject({ kind: 'rowing', splitSecPer500: 118 });
  });

  it('threads observed maxHR into hrZones', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, maxHR: 185 });
    expect(env.hrZones).toMatchObject({ maxHR: 185, source: 'observed' });
  });

  it('defaults body weight to 70kg when body_metrics has no row', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      primaryGoal: 'lift',
      bodyWeightKg: null,
      goalParams: { oneRepMaxKg: { squat: 100, bench: 0, deadlift: 0 } },
    });
    expect(env.strength?.fatG).toEqual({ min: Math.round(70 * 0.8), max: Math.round(70 * 1.5) });
  });
});

describe('buildDisplayEnvelope — lift now produces a full envelope (the point of this hook)', () => {
  it('computes zones=null (no pace blueprint) but a real strength/fuel block', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      primaryGoal: 'lift',
      goalParams: { oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 } },
    });
    expect(env.zones).toBeNull(); // lift has no pace/power blueprint — matches today's card behavior
    expect(env.strength).not.toBeNull();
    expect(env.strength?.workingPercent1RM).toBe(80); // STRENGTH_PHASE_PERCENT.Base
    expect(env.fuel.longSessionCarbGPerHour).toBe(0); // no endurance in-session fueling
  });

  it('leaves strength null for a paramless lifter (onboarding "estimate for me")', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'lift', goalParams: null });
    expect(env.strength).toBeNull();
  });
});

describe('buildDisplayEnvelope — hyrox/crossfit goal_params threading', () => {
  it('populates hyrox from goal_params when the goal is hyrox', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'hyrox', goalParams: { division: 'open_men' } });
    expect(env.hyrox?.division).toBe('open_men');
    expect(env.hyrox?.stationWeights.sledPushKg).toBe(152);
  });

  it('leaves hyrox null without a division', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'hyrox', goalParams: null });
    expect(env.hyrox).toBeNull();
  });

  it('populates crossfit from goal_params when the goal is crossfit', () => {
    const env = buildDisplayEnvelope({
      ...BASE_RAW,
      primaryGoal: 'crossfit',
      goalParams: { oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, franSec: 200 },
    });
    expect(env.crossfit).not.toBeNull();
    expect(env.crossfit?.benchmark.franTier).toBe('intermediate'); // 200s: beats the 300s bound, not the 180s one
  });

  it('leaves crossfit null without goal_params', () => {
    const env = buildDisplayEnvelope({ ...BASE_RAW, primaryGoal: 'crossfit', goalParams: null });
    expect(env.crossfit).toBeNull();
  });
});
