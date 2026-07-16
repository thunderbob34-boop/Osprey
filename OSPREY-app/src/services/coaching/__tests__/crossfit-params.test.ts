import { toCrossfitParams, parseCrossfitParams } from '@/services/coaching/crossfit-params';

describe('toCrossfitParams', () => {
  it('reads a stored blob (1RMs + compete + fran)', () => {
    expect(toCrossfitParams({ oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, competing: true, franSec: 200 }))
      .toEqual({ oneRepMaxKg: { backSquat: 140, deadlift: 180, press: 60 }, competing: true, franSec: 200 });
  });
  it('is null only when the blob is absent (onboarding skip → generic plan)', () => {
    expect(toCrossfitParams(null)).toBeNull();
  });
  it('keeps a general-fitness crossfitter (competing:false, no 1RMs) as valid params', () => {
    expect(toCrossfitParams({ competing: false })).toEqual({ oneRepMaxKg: { backSquat: null, deadlift: null, press: null }, competing: false, franSec: null });
  });
  it('drops implausible numbers to null', () => {
    expect(toCrossfitParams({ oneRepMaxKg: { backSquat: -5, deadlift: 9999, press: 60 }, competing: false, franSec: 99999 }))
      .toEqual({ oneRepMaxKg: { backSquat: null, deadlift: null, press: 60 }, competing: false, franSec: null });
  });
});

describe('parseCrossfitParams', () => {
  it('accepts all-blank (general fitness needs no 1RM)', () => {
    expect(parseCrossfitParams({ backSquat: '', deadlift: '', press: '', competing: false, fran: '' }))
      .toEqual({ ok: true, value: { oneRepMaxKg: { backSquat: null, deadlift: null, press: null }, competing: false, franSec: null } });
  });
  it('rejects a non-numeric 1RM', () => {
    expect(parseCrossfitParams({ backSquat: 'heavy', deadlift: '', press: '', competing: true, fran: '' }).ok).toBe(false);
  });
});
