import { describe, it, expect } from 'vitest';
import * as web from '../src/lib/hyrox-loads';
import { predictCompromisedRunSplit as mSplit, hyroxStationWeights as mW } from '../../OSPREY-app/src/services/calculators/hyrox';

describe('hyrox-loads parity', () => {
  it('compromised split matches OSPREY-app', () => {
    for (const t of [200, 240, 300]) expect(web.predictCompromisedRunSplit(t)).toEqual(mSplit(t));
  });
  it('station weights match OSPREY-app for all divisions', () => {
    for (const d of web.HYROX_DIVISIONS) expect(web.hyroxStationWeights(d)).toEqual(mW(d));
  });
  it('threshold sec/mile → compromised sec/km', () => {
    expect(web.compromisedSplitFromThresholdMile(450)).toEqual(mSplit(Math.round(450 * 0.621371)));
  });
});
