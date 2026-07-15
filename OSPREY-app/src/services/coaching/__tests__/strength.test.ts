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
});
