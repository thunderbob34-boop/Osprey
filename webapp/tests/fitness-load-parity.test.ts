import { describe, it, expect } from 'vitest';
import { computeAtlCtlTsb as webCompute, type DailyLoad } from '../src/lib/fitness-load';
import { computeAtlCtlTsb as mobileCompute } from '../../OSPREY-app/src/services/performance';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync webapp/src/lib/fitness-load.ts to OSPREY-app/src/services/performance.ts.
describe('computeAtlCtlTsb parity (webapp port === OSPREY-app original)', () => {
  function days(tssValues: number[]): DailyLoad[] {
    const start = new Date('2026-01-01T00:00:00Z');
    return tssValues.map((tss, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().slice(0, 10), tss };
    });
  }

  it('matches on an empty series', () => {
    expect(webCompute([])).toEqual(mobileCompute([]));
  });

  it('matches on a flat load (steady-state EWA convergence)', () => {
    const loads = days(new Array(60).fill(50));
    expect(webCompute(loads)).toEqual(mobileCompute(loads));
  });

  it('matches on a realistic varying 90-day series', () => {
    const tssValues = Array.from({ length: 90 }, (_, i) => (i % 7 === 0 ? 0 : 40 + (i % 5) * 15));
    const loads = days(tssValues);
    expect(webCompute(loads)).toEqual(mobileCompute(loads));
  });

  it('matches a single day\'s closed-form EWA', () => {
    expect(webCompute(days([70]))).toEqual(mobileCompute(days([70])));
  });
});
