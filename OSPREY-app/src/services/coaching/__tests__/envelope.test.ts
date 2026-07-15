import { computeEnvelope, EnvelopeInput } from '@/services/coaching/envelope';
import { ultraHRZones } from '@/services/coaching/hr';
import { cyclingPowerZones } from '@/services/calculators/cycling';
import { swimPaceZones } from '@/services/calculators/swimming';
import { runningPaceZones } from '@/services/calculators/running';
import { estimateSwimCssByTier } from '@/services/coaching/anchor';
import { buildStrengthPrescription } from '@/services/coaching/strength';

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
    const env = computeEnvelope({ ...base, sport: 'swim', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: 88, splitSecPer500: null, ftpWatts: null } });
    expect(env.zones).toMatchObject({ kind: 'swim', cssSecPer100: 88 });
  });
  it('prefers a self-reported run threshold over data/tier', () => {
    const env = computeEnvelope({ ...base, sport: 'run', selfReportAnchor: { thresholdSecPerMile: 400, cssSecPer100: null, splitSecPer500: null, ftpWatts: null } });
    expect(env.zones).toMatchObject({ kind: 'run', thresholdSecPerMile: 400 });
  });
  it('prefers a self-reported rowing split over data/tier', () => {
    const env = computeEnvelope({ ...base, sport: 'rowing', selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: 108, ftpWatts: null } });
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

describe('computeEnvelope cycling', () => {
  it('builds cycling power zones from a self-reported FTP', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'cycling', maxHR: 180,
      selfReportAnchor: { thresholdSecPerMile: null, cssSecPer100: null, splitSecPer500: null, ftpWatts: 240 } });
    expect(env.zones).toEqual({ kind: 'cycling', ftpWatts: 240, bands: cyclingPowerZones(240) });
  });
  it('falls to zones:null + HR when a cyclist has no FTP', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'cycling', maxHR: 180, selfReportAnchor: null });
    expect(env.zones).toBeNull();
    expect(env.hrZones.maxHR).toBe(180);
  });
});

describe('computeEnvelope triathlon composite', () => {
  it('resolves swim + run + bike from self-report anchors', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'triathlon', maxHR: 180,
      selfReportAnchor: { thresholdSecPerMile: 440, cssSecPer100: 95, splitSecPer500: null, ftpWatts: 240 } });
    expect(env.zones).toEqual({
      kind: 'triathlon',
      swim: { kind: 'swim', cssSecPer100: 95, bands: swimPaceZones(95) },
      run: { kind: 'run', thresholdSecPerMile: 440, bands: runningPaceZones(440) },
      bike: { kind: 'cycling', ftpWatts: 240, bands: cyclingPowerZones(240) },
    });
  });
  it('leaves bike null when the triathlete has no FTP (→ HR for bikes); swim falls to tier', () => {
    const env = computeEnvelope({ ...hrBase, sport: 'triathlon', fitnessLevel: 'beginner', maxHR: 180,
      selfReportAnchor: { thresholdSecPerMile: 440, cssSecPer100: null, splitSecPer500: null, ftpWatts: null } });
    const z = env.zones as Extract<typeof env.zones, { kind: 'triathlon' }>;
    expect(z.bike).toBeNull();
    expect(z.swim).toEqual({ kind: 'swim', cssSecPer100: estimateSwimCssByTier('beginner'), bands: swimPaceZones(estimateSwimCssByTier('beginner')) });
    expect(env.hrZones.maxHR).toBe(180); // HR still there for the bike sessions
  });
});

function ultraInput(): EnvelopeInput {
  return {
    sport: 'ultra', phase: 'Build', weekNumber: 5, totalWeeks: 16,
    baselineLoad: 400, prevWeekLoad: 400, bestRunMiles: 3.107, bestRunTimeS: 1200,
    fitnessLevel: 'intermediate', bodyWeightKg: 70, rowingSplitSecPer500: null,
    ultraParams: { raceDistance: '50k', vertGainM: null, gutTrained: false },
  };
}

describe('computeEnvelope ultra taper + distance-scaled volume', () => {
  it('scales ultra baseline volume up with race distance', () => {
    const base = computeEnvelope({ ...ultraInput(), phase: 'Build', ultraParams: { raceDistance: '50k', vertGainM: null, gutTrained: false } });
    const long = computeEnvelope({ ...ultraInput(), phase: 'Build', ultraParams: { raceDistance: '100mi', vertGainM: null, gutTrained: false } });
    expect(long.targetWeeklyLoad).toBeGreaterThan(base.targetWeeklyLoad);
  });
  it('applies the progressive ultra taper (race week is the deepest cut)', () => {
    const threeOut = computeEnvelope({ ...ultraInput(), phase: 'Taper', weeksRemaining: 3, prevWeekLoad: 400 });
    const raceWeek = computeEnvelope({ ...ultraInput(), phase: 'Taper', weeksRemaining: 1, prevWeekLoad: 400 });
    expect(raceWeek.targetWeeklyLoad).toBeLessThan(threeOut.targetWeeklyLoad); // 0.70 < 0.75 of baseline
  });
  it('leaves a non-ultra taper on the flat cut (regression)', () => {
    const run = computeEnvelope({ ...ultraInput(), sport: 'run', phase: 'Taper', weeksRemaining: 1, prevWeekLoad: 400 });
    expect(run.targetWeeklyLoad).toBe(Math.round(400 * 0.55)); // applyVolumeCut(prev, 0.45)
  });
});

function liftInput(overrides: Partial<EnvelopeInput> = {}): EnvelopeInput {
  return {
    sport: 'lift', phase: 'Base', weekNumber: 1, totalWeeks: 8,
    baselineLoad: 200, prevWeekLoad: null,
    bestRunMiles: null, bestRunTimeS: null, rowingSplitSecPer500: null,
    fitnessLevel: 'intermediate', bodyWeightKg: 90,
    strengthParams: {
      oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 },
      goalThirdKg: { squat: 210, bench: 145, deadlift: 250 },
    },
    ...overrides,
  };
}

describe('computeEnvelope strength prescription (PL T2)', () => {
  it('populates a non-null strength prescription for a lift sport, wired straight from buildStrengthPrescription', () => {
    const input = liftInput();
    const env = computeEnvelope(input);
    expect(env.strength).not.toBeNull();
    expect(env.strength?.zone.name).toBe('Strength-Volume'); // Base phase → 80% → Strength-Volume
    expect(env.strength).toEqual(buildStrengthPrescription(input));
  });

  it('is null for a non-lift sport and leaves every other envelope field byte-identical (regression)', () => {
    const withStrengthParams = computeEnvelope({
      ...baseInput,
      strengthParams: {
        oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 },
        goalThirdKg: { squat: 210, bench: 145, deadlift: 250 },
      },
    });
    const withoutStrengthParams = computeEnvelope({ ...baseInput });

    expect(withStrengthParams.strength).toBeNull();
    expect(withoutStrengthParams.strength).toBeNull();
    // strengthParams is fully inert for sport: 'run' — zones/hrZones/fuel/targetWeeklyLoad
    // (and every other field) stay byte-identical whether or not strengthParams is present.
    expect(withStrengthParams).toEqual(withoutStrengthParams);
  });
});
