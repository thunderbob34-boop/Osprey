import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/strength-loads';
import { buildStrengthPrescription, prilepinRange, attemptSelector } from '../src/lib/strength-loads';
import { buildStrengthPrescription as mobileBuild } from '../../OSPREY-app/src/services/coaching/strength';
import { intensityZoneForPercent1RM as mZone, INTENSITY_ZONES as mZones, prilepinRange as mobilePrilepin, attemptSelector as mobileAttempt, powerliftingDailyNutrition as mobilePowerliftingNutrition } from '../../OSPREY-app/src/services/calculators/powerlifting';

describe('strength-loads parity + loads', () => {
  it('intensityZoneForPercent1RM matches OSPREY-app across the range', () => {
    for (const p of [40, 60, 70, 80, 88, 90, 95, 100]) expect(web.intensityZoneForPercent1RM(p)).toEqual(mZone(p));
    expect(web.INTENSITY_ZONES).toEqual(mZones);
  });
  it('phase percents match OSPREY-app coaching/strength.ts:17 (Base80/Build88/Peak95/Taper90)', () => {
    expect(web.STRENGTH_PHASE_PERCENT).toEqual({ Base: 80, Build: 88, Peak: 95, Taper: 90 });
  });
  it('working loads = round(1RM * pct/100); 0 for a missing lift', () => {
    const r = web.strengthWorkingLoads({ squat: 180, bench: 120, deadlift: null }, 'Peak');
    expect(r.workingPercent1RM).toBe(95);
    expect(r.zoneName).toBe('Peak / Test');
    expect(r.loads).toEqual({ squat: 171, bench: 114, deadlift: 0 });
  });
});

// If this ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync buildStrengthPrescription/prilepinRange/attemptSelector in
// webapp/src/lib/strength-loads.ts to the OSPREY-app originals.
describe('buildStrengthPrescription parity (webapp port === OSPREY-app original)', () => {
  it('prilepinRange matches across %1RM values', () => {
    for (const pct of [65, 70, 75, 80, 85, 90, 95]) expect(prilepinRange(pct)).toEqual(mobilePrilepin(pct));
  });

  it('attemptSelector matches across goal-third values', () => {
    for (const goalThirdKg of [100, 150.5, 220]) expect(attemptSelector(goalThirdKg)).toEqual(mobileAttempt(goalThirdKg));
  });

  it('returns null when sport is not lift', () => {
    const input = { sport: 'run', phase: 'Base' as const, bodyWeightKg: 75, strengthParams: null };
    expect(buildStrengthPrescription(input)).toBeNull();
    expect(mobileBuild({ ...input, strengthParams: null } as any)).toBeNull();
  });

  it('returns null when all three 1RMs are 0/absent', () => {
    const input = { sport: 'lift', phase: 'Base' as const, bodyWeightKg: 75, strengthParams: { oneRepMaxKg: { squat: null, bench: null, deadlift: null } } };
    expect(buildStrengthPrescription(input)).toBeNull();
  });

  it('matches mobile across phases with a full set of 1RMs and a goalThirdKg', () => {
    const strengthParams = { oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 }, goalThirdKg: { squat: 150, bench: 105, deadlift: 190 } };
    for (const phase of ['Base', 'Build', 'Peak', 'Taper'] as const) {
      const webResult = buildStrengthPrescription({ sport: 'lift', phase, bodyWeightKg: 82, strengthParams });
      const mobileResult = mobileBuild({ sport: 'lift', phase, bodyWeightKg: 82, strengthParams } as any);
      expect(webResult).toEqual(mobileResult);
    }
  });

  it('matches mobile when goalThirdKg is absent (falls back to oneRepMaxKg, the only case a webapp caller can produce)', () => {
    const strengthParams = { oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 } };
    const webResult = buildStrengthPrescription({ sport: 'lift', phase: 'Peak', bodyWeightKg: 82, strengthParams });
    const mobileResult = mobileBuild({ sport: 'lift', phase: 'Peak', bodyWeightKg: 82, strengthParams } as any);
    expect(webResult).toEqual(mobileResult);
  });

  it('matches mobile with a partial 1RM set (only squat provided)', () => {
    const strengthParams = { oneRepMaxKg: { squat: 140, bench: null, deadlift: null } };
    const webResult = buildStrengthPrescription({ sport: 'lift', phase: 'Base', bodyWeightKg: 82, strengthParams });
    const mobileResult = mobileBuild({ sport: 'lift', phase: 'Base', bodyWeightKg: 82, strengthParams } as any);
    expect(webResult).toEqual(mobileResult);
  });
});

// If this ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync powerliftingDailyNutrition in webapp/src/lib/strength-loads.ts
// to the OSPREY-app original.
describe('powerliftingDailyNutrition parity (webapp port === OSPREY-app original)', () => {
  it('matches mobile across representative body weights', () => {
    for (const bodyWeightKg of [55, 75, 95]) {
      expect(web.powerliftingDailyNutrition(bodyWeightKg)).toEqual(mobilePowerliftingNutrition(bodyWeightKg));
    }
  });
});
