import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/training-zones';
// The OSPREY-app originals (pure; import only their local ./types).
import { swimPaceZones as mSwim } from '../../OSPREY-app/src/services/calculators/swimming';
import { runningPaceZones as mRun } from '../../OSPREY-app/src/services/calculators/running';
import { rowingTrainingZones as mRow } from '../../OSPREY-app/src/services/calculators/rowing';

// If this test ever fails, the webapp port has DRIFTED from the mobile source of
// truth. Re-sync webapp/src/lib/training-zones.ts to the OSPREY-app original.
describe('zone calculator parity (webapp port === OSPREY-app original)', () => {
  it('swimPaceZones matches across CSS values', () => {
    for (const css of [70, 88, 95, 130]) expect(web.swimPaceZones(css)).toEqual(mSwim(css));
  });
  it('runningPaceZones matches across thresholds', () => {
    for (const t of [360, 443, 570, 700]) expect(web.runningPaceZones(t)).toEqual(mRun(t));
  });
  it('rowingTrainingZones matches across splits', () => {
    for (const s of [95, 108, 120, 150]) expect(web.rowingTrainingZones(s)).toEqual(mRow(s));
  });
});
