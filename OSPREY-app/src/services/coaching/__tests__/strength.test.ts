import { buildStrengthPrescription } from '@/services/coaching/strength';

const base = () => ({
  sport: 'lift', phase: 'Base', weekNumber: 1, totalWeeks: 8, baselineLoad: 200, prevWeekLoad: null,
  bestRunMiles: null, bestRunTimeS: null, fitnessLevel: 'intermediate', bodyWeightKg: 90,
  rowingSplitSecPer500: null,
  strengthParams: { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 }, goalThirdKg: { squat: 210, bench: 145, deadlift: 250 } },
} as any);

describe('buildStrengthPrescription', () => {
  it('maps Base → the Strength-Volume zone at 80% with Prilepin caps', () => {
    const s = buildStrengthPrescription(base())!;
    expect(s.workingPercent1RM).toBe(80);
    expect(s.zone.name).toBe('Strength-Volume');
    expect(s.zone.percent1RM).toEqual([75, 85]);
    expect(s.prilepin.repsPerSet).toEqual([2, 4]); // Prilepin @80%
    expect(s.oneRepMaxKg).toEqual({ squat: 200, bench: 140, deadlift: 240 });
    expect(s.attempts).toBeNull(); // no attempts outside Peak/Taper
    expect(s.fatG).toEqual({ min: 72, max: 135 }); // bodyWeightKg 90 → round(90*0.8), round(90*1.5)
  });
  it('maps Build → Max Strength (88%) and Peak → Peak/Test (95%) with an attempt card', () => {
    expect(buildStrengthPrescription({ ...base(), phase: 'Build' })!.zone.name).toBe('Max Strength');
    const peak = buildStrengthPrescription({ ...base(), phase: 'Peak' })!;
    expect(peak.zone.name).toBe('Peak / Test');
    expect(peak.attempts).not.toBeNull();
    expect(peak.attempts!.squat.opener.min).toBeCloseTo(210 * 0.89, 1); // opener off the goal third
  });
  it('is null for a non-lift sport', () => {
    expect(buildStrengthPrescription({ ...base(), sport: 'run' })).toBeNull();
  });
  it('returns null when strengthParams is absent (paramless lifter → general strength plan)', () => {
    expect(buildStrengthPrescription({ ...base(), strengthParams: undefined })).toBeNull();
  });
  it('returns null when all three maxes are null (onboarding "Skip — estimate for me")', () => {
    expect(buildStrengthPrescription({ ...base(), strengthParams: { oneRepMaxKg: { squat: null, bench: null, deadlift: null } } })).toBeNull();
  });
  it('still builds when at least one max is present (partial provide → per-lift 0 handled downstream)', () => {
    const s = buildStrengthPrescription({ ...base(), strengthParams: { oneRepMaxKg: { squat: 200, bench: null, deadlift: null } } })!;
    expect(s.oneRepMaxKg).toEqual({ squat: 200, bench: 0, deadlift: 0 });
  });
  it('Taper → Max Strength zone (90%) with an attempt card', () => {
    const taper = buildStrengthPrescription({ ...base(), phase: 'Taper' })!;
    expect(taper.zone.name).toBe('Max Strength');
    expect(taper.attempts).not.toBeNull();
  });
});
