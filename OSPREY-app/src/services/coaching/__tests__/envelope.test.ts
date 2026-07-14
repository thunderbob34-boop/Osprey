import { computeEnvelope } from '@/services/coaching/envelope';

const baseInput = {
  sport: 'run', phase: 'Build' as const, weekNumber: 5, totalWeeks: 16,
  baselineLoad: 300, prevWeekLoad: 300, bestRunMiles: 3.107, bestRunTimeS: 1200,
  fitnessLevel: 'intermediate', bodyWeightKg: 70,
};

describe('computeEnvelope', () => {
  it('produces run zones from the derived anchor for a running plan', () => {
    const env = computeEnvelope(baseInput);
    expect(env.runZones).not.toBeNull();
    expect(env.runZones!.easy.min).toBeGreaterThan(env.runZones!.thresholdSecPerMile); // easy is slower
  });

  it('carries a phase-appropriate target load and fuel', () => {
    const env = computeEnvelope(baseInput);
    expect(env.targetWeeklyLoad).toBeGreaterThan(0);
    expect(env.fuel.proteinG.min).toBeGreaterThan(0);
    expect(env.hardSessionShareMax).toBeCloseTo(0.2, 1);
  });

  it('omits run zones for a non-running sport', () => {
    expect(computeEnvelope({ ...baseInput, sport: 'cycling' }).runZones).toBeNull();
  });
});
