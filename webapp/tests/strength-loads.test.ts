import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/strength-loads';
import { intensityZoneForPercent1RM as mZone, INTENSITY_ZONES as mZones } from '../../OSPREY-app/src/services/calculators/powerlifting';

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
