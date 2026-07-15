import { computeEnvelope, EnvelopeInput } from '@/services/coaching/envelope';
import { ultraHRZones } from '@/services/coaching/hr';

const baseInput = {
  sport: 'run', phase: 'Build' as const, weekNumber: 5, totalWeeks: 16,
  baselineLoad: 300, prevWeekLoad: 300, bestRunMiles: 3.107, bestRunTimeS: 1200,
  fitnessLevel: 'intermediate', bodyWeightKg: 70, rowingSplitSecPer500: null,
};

describe('computeEnvelope', () => {
  it('produces run zones from the derived anchor for a running plan', () => {
    const env = computeEnvelope(baseInput);
    expect(env.zones).not.toBeNull();
    expect(env.zones?.kind).toBe('run');
    if (env.zones && env.zones.kind === 'run') {
      expect(env.zones.bands.easy.min).toBeGreaterThan(env.zones.thresholdSecPerMile); // easy is slower
    }
  });

  it('carries a phase-appropriate target load and fuel', () => {
    const env = computeEnvelope(baseInput);
    expect(env.targetWeeklyLoad).toBeGreaterThan(0);
    expect(env.fuel.proteinG.min).toBeGreaterThan(0);
    expect(env.hardSessionShareMax).toBeCloseTo(0.2, 1);
  });

  it('omits run zones for a non-running sport', () => {
    expect(computeEnvelope({ ...baseInput, sport: 'cycling' }).zones).toBeNull();
  });

  it('produces swim zones for a swimming plan', () => {
    const env = computeEnvelope({ ...baseInput, sport: 'swim' });
    expect(env.zones?.kind).toBe('swim');
    if (env.zones?.kind === 'swim') {
      expect(env.zones.bands.z3Threshold.min).toBeLessThan(env.zones.cssSecPer100); // threshold is faster than CSS
    }
  });

  it('produces rowing zones for a rowing plan, using the passed split', () => {
    const env = computeEnvelope({ ...baseInput, sport: 'rowing', rowingSplitSecPer500: 120 });
    expect(env.zones?.kind).toBe('rowing');
    if (env.zones?.kind === 'rowing') {
      expect(env.zones.splitSecPer500).toBe(120);
      expect(env.zones.bands.tr.splitSecPer500.min).toBe(120); // TR band starts at the 2k split
    }
  });
});

const base: EnvelopeInput = {
  sport: 'swim', phase: 'Base' as const, weekNumber: 1, totalWeeks: 8,
  baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
  fitnessLevel: 'beginner', bodyWeightKg: 70,
};

describe('computeEnvelope self-report priority', () => {
  it('prefers a self-reported swim CSS over the tier estimate', () => {
    const env = computeEnvelope({ ...base, sport: 'swim', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: 88, splitSecPer500: null } });
    expect(env.zones).toMatchObject({ kind: 'swim', cssSecPer100: 88 });
  });
  it('prefers a self-reported run threshold over data/tier', () => {
    const env = computeEnvelope({ ...base, sport: 'run', selfReportAnchor: { thresholdSecPerMile: 400, cssSecPer100: null, splitSecPer500: null } });
    expect(env.zones).toMatchObject({ kind: 'run', thresholdSecPerMile: 400 });
  });
  it('prefers a self-reported rowing split over data/tier', () => {
    const env = computeEnvelope({ ...base, sport: 'rowing', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: 108 } });
    expect(env.zones).toMatchObject({ kind: 'rowing', splitSecPer500: 108 });
  });
  it('is unchanged when selfReportAnchor is absent (regression guard)', () => {
    const withField = computeEnvelope({ ...base, sport: 'swim', selfReportAnchor: null });
    const withoutField = computeEnvelope({ ...base, sport: 'swim' });
    expect(withField).toEqual(withoutField);
  });
});

const hrBase: EnvelopeInput = {
  sport: 'run', phase: 'Base', weekNumber: 1, totalWeeks: 8,
  baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
  fitnessLevel: 'beginner', bodyWeightKg: 70,
};

describe('computeEnvelope hrZones (universal HR fallback)', () => {
  it('populates hrZones from a plausible observed max', () => {
    const env = computeEnvelope({ ...hrBase, maxHR: 180 });
    expect(env.hrZones).toEqual({ maxHR: 180, source: 'observed', bands: ultraHRZones(180) });
  });
  it('uses the conservative default when maxHR is null', () => {
    const env = computeEnvelope({ ...hrBase, maxHR: null });
    expect(env.hrZones.maxHR).toBe(190);
    expect(env.hrZones.source).toBe('estimated');
  });
  it('populates hrZones even for a non-pace goal (weight_loss: zones null, hrZones set)', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'weight_loss', maxHR: 175 });
    expect(env.zones).toBeNull();
    expect(env.hrZones.maxHR).toBe(175);
  });
  it('leaves pace zones byte-identical (hrZones is additive)', () => {
    const withHr = computeEnvelope({ ...hrBase, sport: 'run', bestRunMiles: 6.2, bestRunTimeS: 3000, maxHR: 180 });
    const noHr = computeEnvelope({ ...hrBase, sport: 'run', bestRunMiles: 6.2, bestRunTimeS: 3000 });
    expect(withHr.zones).toEqual(noHr.zones);
  });
});
