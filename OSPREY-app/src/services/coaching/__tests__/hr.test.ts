import { resolveMaxHR, DEFAULT_MAX_HR, ultraHRZones } from '@/services/coaching/hr';

describe('resolveMaxHR', () => {
  it('accepts a physiologically plausible observed max', () => {
    expect(resolveMaxHR(180)).toEqual({ maxHR: 180, source: 'observed' });
    expect(resolveMaxHR(120)).toEqual({ maxHR: 120, source: 'observed' });
    expect(resolveMaxHR(220)).toEqual({ maxHR: 220, source: 'observed' });
  });
  it('falls to the conservative default for null / out-of-range / spurious values', () => {
    expect(resolveMaxHR(null)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
    expect(resolveMaxHR(0)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
    expect(resolveMaxHR(119)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
    expect(resolveMaxHR(240)).toEqual({ maxHR: DEFAULT_MAX_HR, source: 'estimated' });
  });
  it('DEFAULT_MAX_HR is 190', () => {
    expect(DEFAULT_MAX_HR).toBe(190);
  });
});

describe('ultraHRZones re-export (HR band math)', () => {
  it('produces %-max-HR bands', () => {
    // 180 → Z2 70-80% = 126-144, Z4 87-92% = 157-166
    const z = ultraHRZones(180);
    expect(z.z2Endurance).toEqual({ min: 126, max: 144 });
    expect(z.z4Threshold).toEqual({ min: 157, max: 166 });
  });
});
