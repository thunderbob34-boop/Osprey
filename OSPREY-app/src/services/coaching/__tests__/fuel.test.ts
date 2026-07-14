import { computeRunningFuel } from '@/services/coaching/fuel';

describe('computeRunningFuel', () => {
  it('scales daily carbs and protein with bodyweight', () => {
    const f = computeRunningFuel({ bodyWeightKg: 70, hardWeek: true });
    expect(f.dailyCarbG.min).toBeGreaterThan(0);
    expect(f.proteinG.min).toBeCloseTo(70 * 1.6, 0);
    expect(f.proteinG.max).toBeCloseTo(70 * 2.2, 0);
  });

  it('prescribes in-session carbs for long runs', () => {
    const f = computeRunningFuel({ bodyWeightKg: 70, hardWeek: true });
    expect(f.longSessionCarbGPerHour).toBeGreaterThan(0);
  });
});
